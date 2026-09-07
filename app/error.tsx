"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level failure. It names what broke and what the reader can do, rather
 * than the default "Something went wrong" — which tells someone staring at a
 * failed audit nothing about whether their DNS or our page is at fault.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden">
      <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />

      <div className="relative mx-auto w-full max-w-2xl px-5 py-24 sm:px-8">
        <div className="mono text-xs tracking-wide text-fail-ink">
          Error · this page failed to load
        </div>
        <h1 className="display mt-4 text-d3">This page did not come back.</h1>
        <p className="mt-5 max-w-lg text-xl leading-relaxed text-ink-soft">
          Your domain and its DNS records are untouched — the failure is on our side.
          Retrying usually clears it.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-ink px-5 py-2.5 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-line px-5 py-2.5 font-display text-base font-bold tracking-tight text-ink transition-colors hover:border-signal hover:text-signal"
          >
            Back to the scanner
          </Link>
        </div>

        {error.digest && (
          <p className="mono mt-8 text-2xs text-mute">
            Reference {error.digest} — quote this if you get in touch.
          </p>
        )}
      </div>
    </div>
  );
}
