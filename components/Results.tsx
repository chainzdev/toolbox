"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { Check, ScanResult, Status } from "@/lib/scanner";
import { Meter } from "./Meter";
import { Record } from "./Record";

const STATUS_STYLE: Record<Status, { dot: string; label: string; text: string }> = {
  pass: { dot: "bg-pass", label: "Pass", text: "text-pass-ink" },
  warn: { dot: "bg-warn", label: "Needs work", text: "text-warn-ink" },
  fail: { dot: "bg-fail", label: "Failing", text: "text-fail-ink" },
  info: { dot: "bg-mute", label: "Not set", text: "text-mute" },
};

function CheckRow({
  check,
  index,
  open,
  onToggle,
}: {
  check: Check;
  index: number;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const style = STATUS_STYLE[check.status];
  const pctOfMax = Math.round((check.score / check.max) * 100);

  return (
    <div
      id={`check-${check.id}`}
      className="rise scroll-mt-20 border-b border-line-soft last:border-0"
      style={{ animationDelay: `${240 + index * 90}ms` }}
    >
      <button
        onClick={() => onToggle(check.id)}
        aria-expanded={open}
        aria-controls={`panel-${check.id}`}
        className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-sunken sm:px-6"
      >
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="mono text-sm font-semibold tracking-wide text-ink">
              {check.label}
            </span>
            <span className="text-sm text-mute">{check.name}</span>
            <span className={`mono text-2xs font-semibold ${style.text}`}>
              {style.label}
            </span>
            {/* The score is off-screen on mobile, so carry it in the label row. */}
            <span className="mono text-2xs text-mute sm:hidden">
              {check.score}/{check.max}
            </span>
          </span>
          <span className="mt-1.5 block text-base leading-relaxed text-ink-soft">
            {check.summary}
          </span>
        </span>

        <span className="ml-1 flex shrink-0 items-center gap-3">
          <span className="hidden w-24 sm:block">
            <span className="mono block text-right text-2xs text-mute">
              {check.score}/{check.max}
            </span>
            <span className="mt-1 block h-1 w-full rounded-full bg-line">
              <span
                className={`block h-1 rounded-full ${style.dot}`}
                style={{ width: `${pctOfMax}%` }}
              />
            </span>
          </span>
          <svg
            className={`h-4 w-4 text-mute transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div
          id={`panel-${check.id}`}
          className="space-y-3 px-5 pb-5 sm:px-6 sm:pl-[3.1rem]"
        >
          {check.record && (
            <div>
              <div className="eyebrow mb-1.5">Published record</div>
              <Record value={check.record} />
            </div>
          )}
          {check.fix && (
            <div className="rounded-md border-l-2 border-signal bg-signal-wash px-4 py-3">
              <div className="eyebrow mb-1 text-signal-deep">How to fix it</div>
              <p className="text-sm leading-relaxed text-ink-soft">{check.fix}</p>
            </div>
          )}
          {!check.record && !check.fix && (
            <p className="text-sm text-mute">Nothing to change here.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The ranked to-do list. The scanner has always produced `priorities` — worst
 * first, weighted by points left on the table — and nothing rendered it, so
 * the answer to "what do I actually do about this?" was buried in whichever
 * accordion rows the reader thought to open. Each entry opens and scrolls to
 * the check it came from rather than repeating the fix text.
 */
function FixFirst({
  result,
  onJump,
}: {
  result: ScanResult;
  onJump: (label: string) => void;
}) {
  if (result.priorities.length === 0) return null;

  return (
    <div className="border-b border-line bg-sunken px-5 py-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-base font-bold tracking-tight text-ink">
          Fix these first
        </h3>
        <span className="mono text-2xs text-mute">Worst first</span>
      </div>

      <ol className="mt-3.5 space-y-1">
        {result.priorities.map((p, i) => (
          <li key={`${p.label ?? ""}-${p.title}`}>
            <button
              type="button"
              onClick={() => onJump(p.label ?? "")}
              className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface"
            >
              <span className="mono w-4 shrink-0 text-2xs text-mute">{i + 1}</span>
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  p.severity === "critical" ? "bg-fail" : "bg-warn"
                }`}
                aria-hidden
              />
              {/* The fix, not the symptom. The check row immediately below
                  already states what is wrong; repeating it here made the
                  block pure duplication. What it can add is the action. */}
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink-soft">
                {p.label && (
                  <span className="mono font-semibold text-ink">{p.label} </span>
                )}
                {p.fix || p.title}
              </span>
              {typeof p.points === "number" && p.points > 0 && (
                <span className="mono shrink-0 text-2xs text-mute">+{p.points}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Results({
  result,
  scanId,
  compact = false,
}: {
  result: ScanResult;
  scanId?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(result.checks.filter((c) => c.status === "fail").map((c) => c.id)),
  );

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Open the check a priority came from and bring it into view. */
  const jumpTo = useCallback(
    (label: string) => {
      const check = result.checks.find((c) => c.label === label);
      if (!check) return;
      setOpen((prev) => new Set(prev).add(check.id));
      requestAnimationFrame(() => {
        document
          .getElementById(`check-${check.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [result.checks],
  );

  const critical = result.priorities.filter((p) => p.severity === "critical").length;

  return (
    <div className="rise overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_3px_rgba(15,28,46,0.04),0_12px_36px_-12px_rgba(15,28,46,0.12)]">
      {/* Readout header */}
      <div className="border-b border-line px-5 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="mono text-sm font-semibold text-ink">{result.domain}</div>
          {result.provider && (
            <div className="mono text-2xs text-mute">via {result.provider}</div>
          )}
        </div>

        <Meter score={result.score} grade={result.grade} />

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
          {critical > 0 ? (
            <>
              <strong className="font-semibold text-ink">
                {critical} critical {critical === 1 ? "problem" : "problems"}
              </strong>{" "}
              {critical === 1 ? "is" : "are"} costing this domain inbox placement right now.
              Every fix below is a DNS record you can publish today.
            </>
          ) : result.priorities.length > 0 ? (
            <>
              The essentials are in place. {result.priorities.length}{" "}
              {result.priorities.length === 1 ? "setting is" : "settings are"} still short of
              full protection.
            </>
          ) : (
            <>
              Fully authenticated. Nothing needs changing — the risk now is silent drift, when
              someone edits DNS and nobody notices.
            </>
          )}
        </p>
      </div>

      <FixFirst result={result} onJump={jumpTo} />

      {/* Per-check readout */}
      <div>
        {result.checks.map((check, i) => (
          <CheckRow
            key={check.id}
            check={check}
            index={i}
            open={open.has(check.id)}
            onToggle={toggle}
          />
        ))}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken px-5 py-4 sm:px-6">
          <p className="text-sm text-mute">
            DNS changes silently. Monitoring re-checks every day and tells you the moment
            something breaks.
          </p>
          <div className="flex items-center gap-3">
            {scanId && (
              <Link
                href={`/report/${scanId}`}
                className="mono text-xs font-medium text-signal underline-offset-4 hover:underline"
              >
                Share this report
              </Link>
            )}
            <Link
              href={`/login?mode=signup&next=${encodeURIComponent(
                `/dashboard?add=${result.domain}`,
              )}`}
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal"
            >
              Monitor {result.domain}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
