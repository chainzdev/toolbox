/**
 * DNS-over-HTTPS resolver.
 *
 * We use DoH rather than node:dns because serverless DNS is inconsistent
 * across regions, and because we need record types (DS) plus the DNSSEC
 * AD flag that node:dns will not return.
 *
 * The central rule here: "the record does not exist" and "we could not ask"
 * are different answers, and must never collapse into each other. Reporting
 * a healthy domain as unauthenticated is the worst failure this product can
 * have, so a lookup that fails raises DnsUnavailable rather than returning
 * an empty result.
 */

const RESOLVERS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

const TIMEOUT_MS = 8000;
const ATTEMPTS_PER_RESOLVER = 2;

export class DnsUnavailable extends Error {
  constructor(name: string, type: string) {
    super(`Could not resolve ${type} for ${name}`);
    this.name = "DnsUnavailable";
  }
}

export type RecordType = "A" | "TXT" | "MX" | "NS" | "CNAME" | "DS" | "SOA";

const TYPE_CODES: Record<RecordType, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  DS: 43,
};

export interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DnsResult {
  /** False means the question was never answered — not that the record is absent. */
  ok: boolean;
  /** NOERROR=0, NXDOMAIN=3 */
  status: number;
  authenticated: boolean;
  answers: DnsAnswer[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One DoH question, retried across resolvers. Returns ok:false only when
 * every resolver failed to answer.
 */
export async function query(name: string, type: RecordType): Promise<DnsResult> {
  const code = TYPE_CODES[type];

  for (let attempt = 0; attempt < ATTEMPTS_PER_RESOLVER; attempt++) {
    for (const resolver of RESOLVERS) {
      try {
        const url = `${resolver}?name=${encodeURIComponent(name)}&type=${code}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const res = await fetch(url, {
          headers: { accept: "application/dns-json" },
          signal: controller.signal,
          cache: "no-store",
        }).finally(() => clearTimeout(timer));

        // 429/5xx means "ask again", not "no record".
        if (!res.ok) continue;

        const json = (await res.json()) as {
          Status?: number;
          AD?: boolean;
          Answer?: DnsAnswer[];
        };

        const status = json.Status ?? 0;

        // SERVFAIL and friends are also transport failures, not answers.
        // NOERROR (0) and NXDOMAIN (3) are real answers.
        if (status !== 0 && status !== 3) continue;

        return {
          ok: true,
          status,
          authenticated: Boolean(json.AD),
          answers: (json.Answer ?? []).filter((a) => a.type === code),
        };
      } catch {
        // timeout or network error — fall through and retry
      }
    }
    if (attempt < ATTEMPTS_PER_RESOLVER - 1) await sleep(250 * (attempt + 1));
  }

  return { ok: false, status: -1, authenticated: false, answers: [] };
}

/** Like `query`, but a failed lookup raises instead of looking like an empty zone. */
export async function queryOrThrow(
  name: string,
  type: RecordType,
): Promise<DnsResult> {
  const r = await query(name, type);
  if (!r.ok) throw new DnsUnavailable(name, type);
  return r;
}

/**
 * TXT records arrive as one or more quoted strings. A record longer than
 * 255 bytes is split across several, and they must be concatenated with no
 * separator before parsing.
 */
export function normalizeTxt(data: string): string {
  const parts = data.match(/"([^"]*)"/g);
  if (!parts) return data.trim();
  return parts.map((p) => p.slice(1, -1)).join("");
}

/** TXT lookup that raises on failure. Use for anything that affects scoring. */
export async function txt(name: string): Promise<string[]> {
  const r = await queryOrThrow(name, "TXT");
  return r.answers.map((a) => normalizeTxt(a.data));
}

/**
 * TXT lookup for probes where an individual failure is tolerable, such as
 * sweeping DKIM selectors. Reports whether the answer is trustworthy so the
 * caller can tell "no key here" from "never got a reply".
 */
export async function txtProbe(
  name: string,
): Promise<{ ok: boolean; records: string[] }> {
  const r = await query(name, "TXT");
  return {
    ok: r.ok,
    records: r.ok ? r.answers.map((a) => normalizeTxt(a.data)) : [],
  };
}

/** Run promise-returning tasks at limited concurrency, to stay under resolver rate limits. */
export async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

/** Normalize user input ("https://Example.com/path", "a@example.com") to a hostname. */
export function cleanDomain(input: string): string | null {
  let d = (input || "").trim().toLowerCase();
  if (!d) return null;

  if (d.includes("@")) d = d.split("@").pop() as string;
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  d = d.split(":")[0];
  d = d.replace(/\.$/, "");

  const valid =
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(d) &&
    /\.[a-z]{2,}$/.test(d) &&
    d.length <= 253;

  return valid ? d : null;
}
