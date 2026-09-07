import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanDomain } from "@/lib/dns";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export const runtime = "nodejs";

/**
 * Email capture. Nothing in the UI calls this yet — see the README — but it is
 * a live, unauthenticated insert reachable by anyone, so the fields it accepts
 * are bounded here rather than passed through. The `leads` RLS policy is
 * `with check (true)`, which means this route's validation is the only filter
 * in front of the table.
 */
const MAX_EMAIL = 254; // RFC 5321 maximum
const MAX_SOURCE = 40;

export async function POST(request: NextRequest) {
  const { email, domain, score, source } = await request.json().catch(() => ({}));

  if (
    typeof email !== "string" ||
    email.length > MAX_EMAIL ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error } = await db.from("leads").insert({
    email: email.toLowerCase().trim(),
    // Parsed rather than stored verbatim, so this column cannot be used as
    // free-form storage by anyone posting at the endpoint.
    domain: typeof domain === "string" ? cleanDomain(domain) : null,
    score: typeof score === "number" && score >= 0 && score <= 100 ? Math.round(score) : null,
    source:
      typeof source === "string" && source.length <= MAX_SOURCE
        ? source.replace(/[^a-z0-9_-]/gi, "")
        : "scanner",
  });

  if (error) {
    return NextResponse.json({ error: "Could not save that. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
