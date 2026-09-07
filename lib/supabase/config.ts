/**
 * Supabase connection details.
 *
 * Both values are public by design — the publishable key ships inside the
 * browser bundle on every Supabase app. Row Level Security is what protects
 * the data, and every table has it enabled. Env vars still win when set, so
 * pointing a deployment at a different project needs no code change.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qupnbuhijoivjoqdbwxk.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_OQuUDHQjOCia2CMSZf8Oxw_0qLmF-B9";
