import { cookies } from "next/headers";
import { SUPABASE_URL } from "./supabase/config";

/**
 * A display-only guess at whether the visitor is signed in.
 *
 * NEVER use this for authorization. It reads for the presence of Supabase's
 * auth cookie and does not validate it, so a stale or forged cookie reads as
 * "signed in". Everything that grants access — the dashboard, the API routes,
 * the RLS policies — still calls auth.getUser() and verifies for real.
 *
 * The point is latency. The landing and pricing pages used getUser(), which
 * is a network round trip to the Supabase auth server on every render, sitting
 * in front of the first byte of the marketing page purely to choose between
 * the words "Sign in" and "Dashboard". Getting that label wrong for someone
 * with an expired cookie costs them one redirect; getting the TTFB wrong costs
 * every visitor.
 */
export async function hasSessionCookie(): Promise<boolean> {
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const store = await cookies();
  return store
    .getAll()
    .some((c) => c.name.startsWith(`sb-${projectRef}-auth-token`) && c.value.length > 0);
}
