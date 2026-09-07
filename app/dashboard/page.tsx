import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cleanDomain } from "@/lib/dns";
import { domainLimitFor } from "@/lib/plans";
import { DomainManager, type DomainRow } from "@/components/DomainManager";
import { AlertsPanel, type AlertRow } from "@/components/AlertsPanel";
import { BillingButton } from "@/components/BillingButton";
import { Wordmark } from "@/components/Nav";
import { SignOut } from "@/components/SignOut";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; upgraded?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  // Carried over from "Monitor <domain>" on a scan result. Re-parsed rather
  // than trusted, since it arrives from the query string.
  const prefill = cleanDomain(params.add ?? "") ?? "";
  const justUpgraded = params.upgraded === "1";

  const [{ data: profile }, { data: domains }, { data: recent }, { data: alerts }] =
    await Promise.all([
      supabase.from("profiles").select("plan, email").eq("id", user.id).single(),
      supabase
        .from("domains")
        .select("id, domain, last_score, last_grade, last_scanned_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("scans")
        .select("id, domain, score, grade, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("alerts")
        .select("id, domain, severity, title, detail, created_at")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const plan = profile?.plan ?? "free";
  const limit = domainLimitFor(plan);
  const rows = (domains ?? []) as DomainRow[];

  const scored = rows.filter((r) => r.last_score !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.last_score ?? 0), 0) / scored.length)
    : null;
  const failing = scored.filter((r) => (r.last_score ?? 0) < 60).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
        {/* h-auto with vertical padding: at 375px the plan badge, billing and
            sign-out used to push past the fixed 4rem bar and clip. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="mono hidden max-w-[16ch] truncate text-2xs text-mute md:block">
              {profile?.email ?? user.email}
            </span>
            <span className="mono rounded border border-line px-2 py-1 text-2xs font-semibold tracking-wider text-signal uppercase">
              {plan}
            </span>
            {plan !== "free" && <BillingButton />}
            <SignOut />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {justUpgraded && (
          <p
            role="status"
            className="mb-8 rounded-lg border border-pass bg-pass-wash px-5 py-3.5 text-base text-ink"
          >
            <strong className="font-semibold">You are on {plan}.</strong> Daily re-scans start
            tomorrow morning, and alerts arrive by email the moment a record moves.
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Monitored domains</span>
            <h1 className="display mt-3 text-d2 sm:text-d3">
              {avg === null
                ? "Nothing is being watched yet."
                : failing > 0
                  ? `${failing} domain${failing === 1 ? "" : "s"} need attention.`
                  : "Everything is holding."}
            </h1>
          </div>

          {avg !== null && (
            <div className="text-right">
              <div className="display text-d3 leading-none">{avg}</div>
              <div className="eyebrow mt-1.5">Average score</div>
            </div>
          )}
        </div>

        <div className="mt-10">
          <DomainManager domains={rows} limit={limit} plan={plan} prefill={prefill} />
        </div>

        <AlertsPanel alerts={(alerts ?? []) as AlertRow[]} />

        {plan === "free" && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink bg-surface px-6 py-5 shadow-[0_2px_0_var(--color-ink)]">
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-ink">
                Daily monitoring is not on
              </p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
                Manual scans tell you about today. Pro re-checks every domain each morning and
                emails you when a record changes.
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 rounded-lg bg-ink px-5 py-2.5 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal"
            >
              See plans
            </Link>
          </div>
        )}

        <section className="mt-14">
          <span className="eyebrow">Scan history</span>
          {recent && recent.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  href={`/report/${s.id}`}
                  className="flex items-center gap-4 border-b border-line-soft px-5 py-3 transition-colors last:border-0 hover:bg-sunken"
                >
                  <span className="mono w-9 shrink-0 text-sm font-semibold text-signal">
                    {s.grade}
                  </span>
                  <span className="mono min-w-0 flex-1 truncate text-sm text-ink">
                    {s.domain}
                  </span>
                  <span className="mono shrink-0 text-2xs text-mute">{s.score}/100</span>
                  <span className="mono hidden shrink-0 text-2xs text-mute sm:block">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            /* The section used to vanish entirely with no scans, so a new
               account saw a page that just stopped. */
            <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-6 py-8 text-center text-base text-ink-soft">
              No scans yet. Add a domain above and we will score it straight away.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
