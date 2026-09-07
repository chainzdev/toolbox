import { NextRequest, NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { pooled } from "@/lib/dns";
import { scanDomain } from "@/lib/scanner";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Driven by vercel.json's cron schedule. Vercel signs its own cron
 * invocations with this bearer token when CRON_SECRET is set on the
 * project, which is what makes this endpoint safe to leave public.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rpcSecret = process.env.INTERNAL_RPC_SECRET;
  if (!rpcSecret) {
    return NextResponse.json({ error: "INTERNAL_RPC_SECRET not set" }, { status: 500 });
  }

  const db = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: domains, error } = await db.rpc("list_monitored_domains", {
    p_secret: rpcSecret,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = (domains ?? []) as { id: string; domain: string }[];

  /**
   * maxDuration is 60s and a scan takes a few seconds, so beyond roughly this
   * many domains the function is killed mid-run. Oldest-first ordering comes
   * from the RPC; taking a prefix and SAYING SO in the response is better than
   * being cut off and reporting nothing. Raise BATCH once monitoring outgrows
   * one daily invocation and this needs to become a queue.
   */
  const BATCH = 40;
  const targets = all.slice(0, BATCH);
  const deferred = all.length - targets.length;

  const results = await pooled(targets, 4, async (d) => {
    try {
      const scan = await scanDomain(d.domain);
      const { error: rpcError } = await db.rpc("record_scan_result", {
        p_secret: rpcSecret,
        p_domain_id: d.id,
        p_score: scan.score,
        p_grade: scan.grade,
        p_results: scan,
      });
      if (rpcError) throw new Error(rpcError.message);
      return { domain: d.domain, ok: true, score: scan.score, grade: scan.grade };
    } catch (e) {
      return { domain: d.domain, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  return NextResponse.json({
    scanned: results.length,
    succeeded: results.filter((r) => r.ok).length,
    deferred,
    results,
  });
}
