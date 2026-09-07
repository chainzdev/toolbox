"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface AlertRow {
  id: string;
  domain: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string | null;
  created_at: string;
}

const DOT: Record<AlertRow["severity"], string> = {
  critical: "var(--color-fail)",
  warning: "var(--color-warn)",
  info: "var(--color-signal)",
};

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function dismiss(id: string) {
    setDismissing(id);
    setError(null);
    const { error: updateError } = await supabase
      .from("alerts")
      .update({ acknowledged: true })
      .eq("id", id);
    // A failed dismiss used to look identical to a successful one until the
    // alert reappeared on the next render, with no explanation.
    if (updateError) setError("Could not dismiss that alert. Try again.");
    else router.refresh();
    setDismissing(null);
  }

  if (alerts.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" className="eyebrow">
        Alerts
      </h2>
      <div aria-live="polite">
        {error && (
          <p className="mono mt-3 rounded-md bg-fail-wash px-3.5 py-2.5 text-xs text-fail-ink">
            {error}
          </p>
        )}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 border-b border-line-soft px-5 py-4 last:border-0"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: DOT[a.severity] }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-ink">{a.title}</p>
              {a.detail && (
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{a.detail}</p>
              )}
              <p className="mono mt-1 text-2xs text-mute">{ago(a.created_at)}</p>
            </div>
            <button
              onClick={() => dismiss(a.id)}
              disabled={dismissing === a.id}
              className="mono shrink-0 rounded border border-line px-2.5 py-1 text-2xs text-mute transition-colors hover:border-signal hover:text-signal disabled:opacity-50"
            >
              {dismissing === a.id ? "…" : "Dismiss"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
