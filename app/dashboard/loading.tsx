import { Wordmark } from "@/components/Nav";

/**
 * The dashboard is force-dynamic and fans out to four Supabase queries, so
 * there is a real gap before anything paints. This holds the exact shape of
 * the page so the layout does not jump when the data lands.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <div className="skeleton h-6 w-24 rounded-md" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <span className="sr-only" role="status">
          Loading your monitored domains
        </span>

        <div className="eyebrow">Monitored domains</div>
        <div className="skeleton mt-4 h-9 w-3/4 max-w-md" />

        <div className="mt-10 flex flex-col gap-2 sm:flex-row">
          <div className="skeleton h-12 flex-1 rounded-lg" />
          <div className="skeleton h-12 w-32 rounded-lg" />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-line-soft px-5 py-4 last:border-0"
            >
              <div className="skeleton h-7 w-9" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-3.5 w-48 max-w-full" />
                <div className="skeleton h-2.5 w-28" />
              </div>
              <div className="skeleton h-9 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
