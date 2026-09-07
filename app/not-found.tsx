import Link from "next/link";
import { Nav, Footer } from "@/components/Nav";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main id="main" className="relative flex flex-1 items-center overflow-hidden">
        <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />

        <div className="relative mx-auto w-full max-w-2xl px-5 py-24 sm:px-8">
          <div className="mono text-xs tracking-wide text-mute">404 · no such page</div>
          <h1 className="display mt-4 text-d3">Nothing is published here.</h1>
          <p className="mt-5 max-w-lg text-xl leading-relaxed text-ink-soft">
            The link may be mistyped, or it pointed at a scan report that has since been
            removed. The scanner itself is one click away.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg bg-ink px-5 py-2.5 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal"
            >
              Scan a domain
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-line px-5 py-2.5 font-display text-base font-bold tracking-tight text-ink transition-colors hover:border-signal hover:text-signal"
            >
              See pricing
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
