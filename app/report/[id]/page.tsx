import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Nav, Footer } from "@/components/Nav";
import { Results } from "@/components/Results";
import type { ScanResult } from "@/lib/scanner";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { hasSessionCookie } from "@/lib/session-hint";

export const dynamic = "force-dynamic";

interface ReportRow {
  id: string;
  domain: string;
  score: number;
  grade: string;
  results: ScanResult;
  created_at: string;
}

async function loadReport(id: string): Promise<ReportRow | null> {
  const db = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
  const { data } = await db.rpc("get_scan_report", { p_id: id });
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ReportRow) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) return { title: "Report not found" };

  const title = `${report.domain} scored ${report.score}/100 (${report.grade})`;
  const description = `Email authentication audit for ${report.domain}: SPF, DKIM, DMARC, MX and TLS.`;
  return {
    title,
    description,
    openGraph: { title, description },
    // Shareable by link, but not crawlable: these are per-visitor snapshots,
    // and indexing thousands of them would bury the pages that should rank.
    robots: { index: false, follow: true },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Guard against non-UUID paths reaching Postgres.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [report, signedIn] = await Promise.all([loadReport(id), hasSessionCookie()]);
  if (!report) notFound();

  return (
    <div className="min-h-screen">
      <Nav signedIn={signedIn} />

      <main id="main" className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8">
          <span className="eyebrow">Authentication report</span>
          <h1 className="display mt-3 text-d2 sm:text-d3">{report.domain}</h1>
          <p className="mono mt-2 text-xs text-mute">
            Scanned {new Date(report.created_at).toLocaleString()}
          </p>
        </div>

        <Results result={report.results} compact />

        <div className="mt-8 rounded-xl border border-ink bg-surface px-6 py-6 shadow-[0_2px_0_var(--color-ink)]">
          <p className="font-display text-xl font-bold tracking-tight text-ink">
            This report is a snapshot.
          </p>
          <p className="mt-2 max-w-lg text-base leading-relaxed text-ink-soft">
            DNS changes without telling anyone. Add this domain to monitoring and we will
            re-check it every day, then email you the moment a record moves.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/login?mode=signup&next=${encodeURIComponent(
                `/dashboard?add=${report.domain}`,
              )}`}
              className="rounded-lg bg-ink px-5 py-2.5 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal"
            >
              Monitor {report.domain}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-line px-5 py-2.5 font-display text-base font-bold tracking-tight text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Scan another domain
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
