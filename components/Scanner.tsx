"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ScanResult } from "@/lib/scanner";
import { Results } from "./Results";

const STAGES = [
  "Resolving nameservers",
  "Reading DMARC policy",
  "Counting SPF lookups",
  "Probing DKIM selectors",
  "Checking MX and TLS",
];

export function Scanner({
  initialDomain = "",
  autoRun = false,
}: {
  initialDomain?: string;
  autoRun?: boolean;
}) {
  const [domain, setDomain] = useState(initialDomain);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ScanResult & { scanId?: string }) | null>(null);
  // The landing page mounts two Scanners, so ids must be per-instance or
  // the label and aria-describedby both bind to the wrong one.
  const uid = useId();
  const inputId = `domain-${uid}`;
  const statusId = `scan-status-${uid}`;
  const panelRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  async function run(target?: string) {
    const value = (target ?? domain).trim();
    if (busy) return;
    if (!value) {
      setError("Enter a domain to scan, like acme.com.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    setStage(0);

    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      620,
    );

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The scan failed.");
      setResult(data);
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan failed.");
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoRun && initialDomain && !started.current) {
      started.current = true;
      run(initialDomain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, initialDomain]);

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="relative"
      >
        <div
          className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface transition-colors sm:flex-row sm:items-center ${
            busy ? "border-signal" : "border-ink focus-within:border-signal"
          } shadow-[0_2px_0_var(--color-ink)]`}
        >
          <label htmlFor={inputId} className="sr-only">
            Your sending domain
          </label>
          <input
            id={inputId}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={busy}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="url"
            inputMode="url"
            aria-invalid={Boolean(error)}
            aria-describedby={statusId}
            placeholder="yourcompany.com"
            className="mono min-w-0 flex-1 bg-transparent px-5 py-4 text-lg text-ink outline-none placeholder:text-mute sm:py-5 sm:text-xl"
          />
          <button
            type="submit"
            disabled={busy}
            className="m-2 shrink-0 rounded-lg bg-ink px-6 py-3.5 font-display text-md font-bold tracking-tight text-white transition-colors hover:bg-signal disabled:cursor-wait disabled:opacity-70 sm:py-4"
          >
            {busy ? "Scanning…" : "Run free scan"}
          </button>

          {busy && (
            <span
              className="sweep pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-signal-wash"
              aria-hidden
            />
          )}
        </div>
      </form>

      {/* aria-live so the scan sequence and any failure are announced. Without
          it a screen-reader user pressed the button and heard nothing at all,
          neither progress nor the reason it failed. */}
      <div
        id={statusId}
        className="mt-3 flex min-h-[22px] flex-wrap items-center gap-x-4 gap-y-1.5"
        aria-live="polite"
        aria-atomic="true"
      >
        {busy ? (
          <span className="mono flex items-center gap-2 text-xs text-signal">
            <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
            {STAGES[stage]}…
          </span>
        ) : error ? (
          <span className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fail-ink">
            {error}
            <button
              type="button"
              onClick={() => run()}
              className="font-semibold text-signal underline underline-offset-4"
            >
              Try again
            </button>
          </span>
        ) : (
          <>
            <span className="mono text-2xs text-mute">
              No signup. Results in about three seconds.
            </span>
            <span className="hidden items-center gap-3 sm:flex">
              {["DMARC", "SPF", "DKIM", "MX", "BIMI", "MTA-STS"].map((t) => (
                <span key={t} className="mono text-2xs tracking-wide text-mute">
                  {t}
                </span>
              ))}
            </span>
          </>
        )}
      </div>

      <div ref={panelRef} className="scroll-mt-24">
        {result && (
          <div className="mt-8">
            <Results result={result} scanId={result.scanId} />
          </div>
        )}
      </div>
    </div>
  );
}
