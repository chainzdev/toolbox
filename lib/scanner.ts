import { query, queryOrThrow, txt, txtProbe, pooled } from "./dns";

export type Status = "pass" | "warn" | "fail" | "info";

/**
 * Raised when the domain itself is not registered. Without this an unregistered
 * name scored 0/F with "No SPF record", which reads as a damning verdict on a
 * domain rather than a typo — the single most misleading output this tool
 * could produce.
 */
export class DomainNotFound extends Error {
  constructor(public readonly domain: string) {
    super(`${domain} is not registered`);
    this.name = "DomainNotFound";
  }
}

export interface Check {
  id: string;
  /** Short label, e.g. "SPF" */
  label: string;
  name: string;
  status: Status;
  /** Points earned out of `max` */
  score: number;
  max: number;
  /** The raw DNS record, shown verbatim to the user */
  record?: string;
  summary: string;
  /** What to do about it, in plain terms */
  fix?: string;
  meta?: Record<string, string | number | boolean>;
}

export interface Priority {
  severity: "critical" | "warning";
  title: string;
  fix: string;
  /** Which check raised it. Optional: scans stored before this existed lack it. */
  label?: string;
  /** Points still on the table, so the list can say what fixing it is worth. */
  points?: number;
}

export interface ScanResult {
  domain: string;
  score: number;
  grade: string;
  scannedAt: string;
  checks: Check[];
  provider?: string;
  /** Ranked to-do list, worst first */
  priorities: Priority[];
}

/* ------------------------------------------------------------------ */
/* SPF                                                                 */
/* ------------------------------------------------------------------ */

const LOOKUP_MECHANISMS = ["include:", "a:", "mx:", "ptr:", "exists:", "redirect="];

/**
 * SPF permits at most 10 DNS-querying mechanisms across the whole
 * evaluation, including everything reached through include: and
 * redirect=. Exceeding it makes the record a PERMERROR, so receivers
 * treat the domain as unauthenticated. It is a silent, total failure
 * and it is the single most common broken-SPF cause we see.
 */
async function countSpfLookups(
  record: string,
  depth = 0,
  seen = new Set<string>(),
): Promise<{ count: number; complete: boolean }> {
  if (depth > 5) return { count: 0, complete: true };

  let complete = true;
  let count = 0;
  const terms = record.split(/\s+/).filter(Boolean);

  for (const term of terms) {
    const bare = term.toLowerCase().replace(/^[+\-~?]/, "");

    const isLookup =
      LOOKUP_MECHANISMS.some((m) => bare.startsWith(m)) ||
      bare === "a" ||
      bare === "mx" ||
      bare === "ptr";

    if (!isLookup) continue;
    count += 1;

    const nested =
      bare.startsWith("include:") || bare.startsWith("redirect=")
        ? bare.split(/[:=]/).slice(1).join(":")
        : null;

    if (nested && !seen.has(nested)) {
      seen.add(nested);
      const probe = await txtProbe(nested);
      if (!probe.ok) {
        // We could not follow this include, so the total is a lower bound.
        complete = false;
        continue;
      }
      const spf = probe.records.find((r) => r.toLowerCase().startsWith("v=spf1"));
      if (spf) {
        const inner = await countSpfLookups(spf, depth + 1, seen);
        count += inner.count;
        if (!inner.complete) complete = false;
      }
    }
  }

  return { count, complete };
}

async function checkSpf(domain: string): Promise<Check> {
  const records = (await txt(domain)).filter((r) =>
    r.toLowerCase().startsWith("v=spf1"),
  );

  const base = {
    id: "spf",
    label: "SPF",
    name: "Sender Policy Framework",
    max: 25,
  };

  if (records.length === 0) {
    return {
      ...base,
      status: "fail",
      score: 0,
      summary:
        "No SPF record. Receivers have no list of servers allowed to send as this domain.",
      fix: `Publish a TXT record at ${domain} listing your senders, ending in -all. For example: v=spf1 include:_spf.google.com -all`,
    };
  }

  if (records.length > 1) {
    return {
      ...base,
      status: "fail",
      score: 6,
      record: records.join("\n"),
      summary: `${records.length} SPF records found. More than one is invalid, so receivers discard the whole evaluation.`,
      fix: "Merge every sender into a single SPF TXT record and delete the others.",
    };
  }

  const record = records[0];
  const { count: lookups, complete: lookupsComplete } = await countSpfLookups(record);
  const allMatch = record.match(/([+\-~?])all\b/i);
  const qualifier = allMatch ? allMatch[1] : null;

  let score = 12;
  let status: Status = "pass";
  const problems: string[] = [];
  let fix: string | undefined;

  if (qualifier === "-") {
    score += 13;
  } else if (qualifier === "~") {
    score += 9;
    status = "warn";
    problems.push("ends in ~all (softfail), so forged mail is accepted and only flagged");
    fix =
      "Once every legitimate sender is listed, change ~all to -all so receivers reject forgeries outright.";
  } else if (qualifier === "?") {
    score += 3;
    status = "warn";
    problems.push("ends in ?all (neutral), which asserts nothing at all");
    fix = "Replace ?all with -all so receivers reject mail from servers you have not listed.";
  } else if (qualifier === "+") {
    status = "fail";
    problems.push("ends in +all, which authorizes the entire internet to send as this domain");
    fix = "Replace +all with -all now. As written, anyone can pass SPF as this domain.";
  } else {
    score += 2;
    status = "warn";
    problems.push("has no all mechanism, leaving the default policy undefined");
    fix = "Append -all to the end of the record.";
  }

  if (lookups > 10 && lookupsComplete) {
    score = Math.max(0, score - 8);
    status = "fail";
    problems.push(
      `needs ${lookups} DNS lookups, past the hard limit of 10, so the record is a PERMERROR and gets ignored entirely`,
    );
    fix = `Flatten or remove include: entries to get under 10 lookups. This record is ${lookups - 10} over.`;
  } else if (lookups === 10 && lookupsComplete) {
    if (status === "pass") status = "warn";
    problems.push("uses all 10 permitted DNS lookups, so adding any sender will break it");
    fix = fix ?? "This record is at the 10-lookup ceiling. Consolidate includes before adding another sender.";
  }

  return {
    ...base,
    status,
    score,
    record,
    summary:
      problems.length === 0
        ? lookupsComplete
          ? `Valid, strict, and using ${lookups} of the 10 permitted DNS lookups.`
          : `Valid and strict. At least ${lookups} of the 10 permitted DNS lookups are used, though one include could not be followed just now.`
        : `SPF ${problems.join("; ")}.`,
    fix,
    meta: { lookups, qualifier: qualifier ?? "none" },
  };
}

/* ------------------------------------------------------------------ */
/* DKIM                                                                */
/* ------------------------------------------------------------------ */

/** Selectors used by the major providers, probed in parallel. */
const SELECTORS = [
  "google", "selector1", "selector2", "k1", "k2", "k3", "s1", "s2",
  "dkim", "default", "mail", "email", "smtp", "mandrill", "sendgrid",
  "zoho", "mailjet", "sm", "pm", "pic", "fd", "fd1", "fd2",
  "everlytickey1", "mxvault", "protonmail", "zmail", "cm", "mc",
  "1", "2", "20230601", "20221208", "beta", "key1", "key2", "ctct1",
];

async function checkDkim(domain: string): Promise<Check> {
  const base = {
    id: "dkim",
    label: "DKIM",
    name: "DomainKeys Identified Mail",
    max: 25,
  };

  // Pooled rather than all-at-once: 36 simultaneous queries gets us throttled,
  // and a throttled lookup used to read as "this domain has no DKIM".
  const probes = await pooled(SELECTORS, 6, async (sel) => {
    const { ok, records } = await txtProbe(`${sel}._domainkey.${domain}`);
    if (!ok) return { ok: false, hit: null };
    const key = records.find(
      (r) => r.includes("p=") && (r.includes("v=DKIM1") || r.includes("k=rsa")),
    );
    return { ok: true, hit: key ? { selector: sel, record: key } : null };
  });

  const answered = probes.filter((p) => p.ok).length;
  const found = probes
    .map((p) => p.hit)
    .filter((h): h is { selector: string; record: string } => h !== null);

  // If most of the sweep never came back, we cannot claim anything about DKIM.
  if (found.length === 0 && answered < SELECTORS.length / 2) {
    return {
      ...base,
      status: "info",
      score: 0,
      summary:
        "DKIM could not be checked — too many selector lookups went unanswered. Rescan in a moment.",
    };
  }

  if (found.length === 0) {
    return {
      ...base,
      status: "fail",
      score: 0,
      summary:
        "No DKIM key on any common selector. Without a signature receivers cannot verify the mail was not altered in transit, and DMARC cannot pass on DKIM.",
      fix: `Turn on DKIM signing in your email provider, then publish the TXT record it gives you at <selector>._domainkey.${domain}`,
    };
  }

  // Estimate modulus size from the length of the base64 public key.
  const keyBits = found.map((f) => {
    const p = f.record.match(/p=([A-Za-z0-9+/=]+)/)?.[1] ?? "";
    const bytes = (p.length * 3) / 4;
    return bytes > 300 ? 2048 : bytes > 150 ? 1024 : 512;
  });

  const strongest = Math.max(...keyBits);
  const revoked = found.filter((f) => /p=(\s*;|\s*$)/.test(f.record));
  const selectorList = found.map((f) => f.selector).join(", ");

  let score = 20;
  let status: Status = "pass";
  let summary = `Signing key found on ${selectorList} (${strongest}-bit).`;
  let fix: string | undefined;

  if (strongest >= 2048) {
    score += 5;
  } else {
    status = "warn";
    summary = `Signing key found on ${selectorList}, but the strongest is only ${strongest}-bit.`;
    fix = "Rotate to a 2048-bit DKIM key. Gmail and Outlook are phasing out 1024-bit keys.";
  }

  if (revoked.length === found.length) {
    score = 4;
    status = "fail";
    summary = "The DKIM record exists but its public key is empty, which marks the key revoked.";
    fix = "Republish the DKIM TXT record with the full public key from your provider.";
  }

  return {
    ...base,
    status,
    score,
    record: found[0].record,
    summary,
    fix,
    meta: { selectors: selectorList, bits: strongest },
  };
}

/* ------------------------------------------------------------------ */
/* DMARC                                                               */
/* ------------------------------------------------------------------ */

async function checkDmarc(domain: string): Promise<Check> {
  const base = {
    id: "dmarc",
    label: "DMARC",
    name: "Domain-based Message Authentication",
    max: 35,
  };

  const records = (await txt(`_dmarc.${domain}`)).filter((r) =>
    r.toLowerCase().startsWith("v=dmarc1"),
  );

  if (records.length === 0) {
    return {
      ...base,
      status: "fail",
      score: 0,
      summary:
        "No DMARC record. Google and Yahoo require one from every bulk sender, and without it nothing stops anyone spoofing this domain.",
      fix: `Publish a TXT record at _dmarc.${domain} to start collecting reports: v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    };
  }

  const record = records[0];
  const tags: Record<string, string> = {};
  for (const part of record.split(";")) {
    const s = part.trim();
    if (!s) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    tags[s.slice(0, i).trim().toLowerCase()] = s.slice(i + 1).trim();
  }

  const policy = (tags["p"] ?? "").toLowerCase();
  const pct = tags["pct"] ? parseInt(tags["pct"], 10) : 100;
  const rua = tags["rua"];

  let score = 12;
  let status: Status = "pass";
  const notes: string[] = [];
  let fix: string | undefined;

  if (policy === "reject") {
    score += 15;
    notes.push("policy is p=reject, the strongest setting");
  } else if (policy === "quarantine") {
    score += 10;
    status = "warn";
    notes.push("policy is p=quarantine, so spoofed mail lands in spam rather than being refused");
    fix = "Once your reports are clean, move to p=reject for full protection.";
  } else if (policy === "none") {
    score += 3;
    status = "warn";
    notes.push("policy is p=none, which only monitors, so spoofed mail is still delivered");
    fix =
      "p=none enforces nothing. Once your reports show all legitimate mail passing, move to p=quarantine and then p=reject.";
  } else {
    status = "fail";
    notes.push("the p tag is missing or invalid, so the record does nothing");
    fix = "Add a valid policy tag: p=none to start, then tighten to p=reject.";
  }

  if (rua) {
    score += 5;
    notes.push("aggregate reports are being collected");
  } else {
    if (status === "pass") status = "warn";
    notes.push("there is no rua address, so no reports arrive and nobody can see who is sending as this domain");
    fix = fix ?? `Add rua=mailto:dmarc@${domain} to start receiving aggregate reports.`;
  }

  if (pct === 100) {
    score += 3;
  } else {
    if (status === "pass") status = "warn";
    notes.push(`pct=${pct}, so the policy covers only ${pct}% of the mail`);
    fix = fix ?? "Raise pct to 100 so the policy applies to all of your mail.";
  }

  return {
    ...base,
    status,
    score,
    record,
    summary: `DMARC ${notes.join("; ")}.`,
    fix,
    meta: { policy: policy || "none", pct, reporting: Boolean(rua) },
  };
}

/* ------------------------------------------------------------------ */
/* MX and provider detection                                           */
/* ------------------------------------------------------------------ */

const PROVIDERS: [RegExp, string][] = [
  [/google|googlemail/i, "Google Workspace"],
  [/outlook|microsoft|office365/i, "Microsoft 365"],
  [/zoho/i, "Zoho Mail"],
  [/protonmail|proton\.me/i, "Proton Mail"],
  [/fastmail|messagingengine/i, "Fastmail"],
  [/mimecast/i, "Mimecast"],
  [/proofpoint|pphosted/i, "Proofpoint"],
  [/barracuda/i, "Barracuda"],
  [/amazonaws|amazonses/i, "Amazon SES"],
  [/mailgun/i, "Mailgun"],
  [/sendgrid/i, "SendGrid"],
  [/yandex/i, "Yandex"],
  [/ionos|1and1/i, "IONOS"],
  [/secureserver|godaddy/i, "GoDaddy"],
  [/improvmx/i, "ImprovMX"],
  [/titan|flockmail/i, "Titan"],
];

interface MxCheck extends Check {
  provider?: string;
}

async function checkMx(domain: string): Promise<MxCheck> {
  const base = { id: "mx", label: "MX", name: "Mail exchange routing", max: 5 };
  const r = await queryOrThrow(domain, "MX");

  if (r.answers.length === 0) {
    return {
      ...base,
      status: "warn",
      score: 0,
      summary:
        "No MX records, so this domain cannot receive email. DMARC reports sent to it would bounce.",
      fix: "Add MX records from your email provider, or point DMARC reporting at a domain that can receive mail.",
    };
  }

  const hosts = r.answers
    .map((a) => a.data.replace(/\.$/, ""))
    .sort()
    .slice(0, 5);
  const provider = PROVIDERS.find(([re]) => re.test(hosts.join(" ")))?.[1];

  return {
    ...base,
    status: "pass",
    score: 5,
    record: hosts.join("\n"),
    summary: provider
      ? `Mail is routed to ${provider}.`
      : `${r.answers.length} mail server${r.answers.length === 1 ? "" : "s"} configured.`,
    provider,
  };
}

/* ------------------------------------------------------------------ */
/* Transport hardening: MTA-STS, TLS-RPT, BIMI, DNSSEC                 */
/* ------------------------------------------------------------------ */

async function checkHardening(domain: string): Promise<Check> {
  const base = {
    id: "hardening",
    label: "TLS",
    name: "Transport security and brand",
    max: 10,
  };

  const [mtaSts, tlsRpt, bimi, ds] = await Promise.all([
    txtProbe(`_mta-sts.${domain}`),
    txtProbe(`_smtp._tls.${domain}`),
    txtProbe(`default._bimi.${domain}`),
    query(domain, "DS"),
  ]);

  const hasMtaSts = mtaSts.records.some((r) => r.toLowerCase().startsWith("v=stsv1"));
  const hasTlsRpt = tlsRpt.records.some((r) => r.toLowerCase().startsWith("v=tlsrptv1"));
  const hasBimi = bimi.records.some((r) => r.toLowerCase().startsWith("v=bimi1"));
  const hasDnssec = ds.answers.length > 0;

  let score = 0;
  if (hasMtaSts) score += 4;
  if (hasTlsRpt) score += 3;
  if (hasBimi) score += 3;

  const present: string[] = [];
  const missing: string[] = [];
  (hasMtaSts ? present : missing).push("MTA-STS");
  (hasTlsRpt ? present : missing).push("TLS reporting");
  (hasBimi ? present : missing).push("BIMI");

  const status: Status = score >= 7 ? "pass" : score > 0 ? "warn" : "info";

  return {
    ...base,
    status,
    score,
    record: bimi.records.find((r) => r.toLowerCase().startsWith("v=bimi1")),
    summary:
      present.length > 0
        ? `${present.join(" and ")} configured. Missing: ${missing.join(", ") || "nothing"}.`
        : "No transport hardening. These are optional, but they lift inbox placement and put your logo next to your mail.",
    fix:
      missing.length > 0
        ? `Add ${missing.join(", ")}. BIMI shows your logo in Gmail and Apple Mail, though it needs DMARC at p=quarantine or stricter first.`
        : undefined,
    meta: { mtaSts: hasMtaSts, tlsRpt: hasTlsRpt, bimi: hasBimi, dnssec: hasDnssec },
  };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

/**
 * A one-line headline for the to-do list. Takes the first clause of the
 * summary and drops a leading repeat of the check's own label, which the
 * previous `replace(/^\w+\s/, "")` turned into titles like "SPF: SPF record".
 */
function priorityTitle(check: Check): string {
  const clause = check.summary
    .split(". ")[0]
    .split(";")[0]
    .trim()
    .replace(/\.$/, "")
    .replace(new RegExp(`^${check.label}\\s+`, "i"), "");
  return clause.charAt(0).toUpperCase() + clause.slice(1);
}

export function gradeFor(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Does this zone exist at all? NXDOMAIN on the apex SOA is the authoritative
 * "no such domain". Anything else — including a lookup we could not complete —
 * falls through to the real scan, because refusing to scan a live domain is a
 * worse failure than scanning a dead one.
 */
async function assertDomainExists(domain: string): Promise<void> {
  const soa = await query(domain, "SOA");
  if (soa.ok && soa.status === 3) throw new DomainNotFound(domain);
}

export async function scanDomain(domain: string): Promise<ScanResult> {
  await assertDomainExists(domain);

  const [dmarc, spf, dkim, mx, hardening] = await Promise.all([
    checkDmarc(domain),
    checkSpf(domain),
    checkDkim(domain),
    checkMx(domain),
    checkHardening(domain),
  ]);

  const checks: Check[] = [dmarc, spf, dkim, mx, hardening];
  const score = Math.round(
    Math.min(100, Math.max(0, checks.reduce((sum, c) => sum + c.score, 0))),
  );

  const priorities: Priority[] = checks
    .filter((c) => c.fix && (c.status === "fail" || c.status === "warn"))
    .sort((a, b) => {
      const rank = (c: Check) => (c.status === "fail" ? 0 : 1);
      return rank(a) - rank(b) || b.max - b.score - (a.max - a.score);
    })
    .map((c) => ({
      severity: (c.status === "fail" ? "critical" : "warning") as "critical" | "warning",
      title: priorityTitle(c),
      fix: c.fix as string,
      label: c.label,
      points: c.max - c.score,
    }));

  return {
    domain,
    score,
    grade: gradeFor(score),
    scannedAt: new Date().toISOString(),
    checks,
    provider: mx.provider,
    priorities,
  };
}
