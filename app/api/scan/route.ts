import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { cleanDomain, DnsUnavailable } from "@/lib/dns";
import { scanDomain, DomainNotFound } from "@/lib/scanner";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Non-reversible bucket key for rate limiting; we never store the address.
 * SHA-256 rather than the djb2 this used to use: djb2 lands in a 32-bit
 * space, so the whole IPv4 range can be enumerated against it in seconds.
 */
function hashIp(ip: string): string {
  return createHash("sha256").update(`inboxproof:${ip}`).digest("base64url").slice(0, 24);
}

export async function POST(request: NextRequest) {
  let body: { domain?: string; domainId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const domain = cleanDomain(body.domain ?? "");
  if (!domain) {
    return NextResponse.json(
      { error: "That does not look like a domain. Try something like acme.com." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = hashIp(ip);

  // Signed-in users are identified so the scan lands in their history.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  if (!user) {
    const { data: allowed } = await db.rpc("check_scan_quota", {
      p_ip_hash: ipHash,
    });
    if (allowed === false) {
      return NextResponse.json(
        {
          error:
            "You have used the 12 free scans for this hour. Create an account for unlimited scans.",
        },
        { status: 429 },
      );
    }
  }

  /**
   * A caller may only attach a scan to a domain row they own. RLS on `scans`
   * checks user_id but says nothing about domain_id, so without this a signed-in
   * user could file scans against someone else's monitored domain.
   */
  let domainId: string | null = null;
  if (user && body.domainId) {
    const { data: owned } = await supabase
      .from("domains")
      .select("id")
      .eq("id", body.domainId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "That domain is not on your list." }, { status: 403 });
    }
    domainId = owned.id;
  }

  let result;
  try {
    result = await scanDomain(domain);
  } catch (e) {
    if (e instanceof DomainNotFound) {
      return NextResponse.json(
        {
          error: `${domain} is not registered — DNS has no record of it. Check the spelling.`,
        },
        { status: 404 },
      );
    }
    if (e instanceof DnsUnavailable) {
      return NextResponse.json(
        {
          error:
            "The DNS resolvers did not answer in time. Nothing is wrong with your domain — try again in a moment.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "The lookup failed. Check the domain and try again." },
      { status: 502 },
    );
  }

  const scanId = crypto.randomUUID();

  // Persist for the shareable report. A failure here must not break the scan.
  try {
    if (user) {
      await supabase.from("scans").insert({
        id: scanId,
        domain,
        domain_id: domainId,
        user_id: user.id,
        score: result.score,
        grade: result.grade,
        results: result,
        ip_hash: ipHash,
      });

      if (domainId) {
        await supabase
          .from("domains")
          .update({
            last_score: result.score,
            last_grade: result.grade,
            last_scanned_at: new Date().toISOString(),
          })
          .eq("id", domainId)
          .eq("user_id", user.id);
      }
    } else {
      await db.from("scans").insert({
        id: scanId,
        domain,
        score: result.score,
        grade: result.grade,
        results: result,
        ip_hash: ipHash,
      });
    }
  } catch {
    // Reporting is best-effort; the user still gets their result.
  }

  return NextResponse.json({ ...result, scanId });
}
