"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cleanDomain } from "@/lib/dns";
import type { ScanResult } from "@/lib/scanner";
import { Results } from "./Results";

export interface DomainRow {
  id: string;
  domain: string;
  last_score: number | null;
  last_grade: string | null;
  last_scanned_at: string | null;
}

function gradeColor(score: number | null) {
  if (score === null) return "var(--color-mute)";
  if (score >= 85) return "var(--color-pass)";
  if (score >= 60) return "var(--color-signal)";
  if (score >= 40) return "var(--color-warn)";
  return "var(--color-fail)";
}

function ago(iso: string | null) {
  if (!iso) return "never scanned";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DomainManager({
  domains,
  limit,
  plan,
  prefill = "",
}: {
  domains: DomainRow[];
  limit: number;
  plan: string;
  /** Domain carried over from "Monitor <domain>" on a scan result. */
  prefill?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState(prefill);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; result: ScanResult } | null>(null);

  const atLimit = domains.length >= limit;
  const alreadyAdded =
    prefill.length > 0 && domains.some((d) => d.domain === prefill.toLowerCase());

  // Someone arriving from "Monitor acme.com" should not have to retype it.
  useEffect(() => {
    if (prefill && !alreadyAdded && !atLimit) inputRef.current?.focus();
  }, [prefill, alreadyAdded, atLimit]);

  /** Score a domain and fold the result open underneath its row. */
  async function scan(id: string, domain: string) {
    setScanning(id);
    setError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, domainId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The scan failed.");
      setOpen({ id, result: data });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan failed.");
    } finally {
      setScanning(null);
    }
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;

    setError(null);
    setNotice(null);

    // Validate with the same parser the scanner uses, rather than a bare
    // protocol strip — this table used to accept "my email is broken" as a
    // monitored domain, and the daily cron would then try to resolve it.
    const domain = cleanDomain(input);
    if (!domain) {
      setError("That does not look like a domain. Try something like acme.com.");
      return;
    }

    setAdding(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Sign in again.");
      setAdding(false);
      return;
    }

    const { data: created, error: insertError } = await supabase
      .from("domains")
      .insert({ domain, user_id: user.id })
      .select("id, domain")
      .single();

    if (insertError) {
      setError(
        insertError.message.includes("DOMAIN_LIMIT_REACHED")
          ? `Your ${plan} plan covers ${limit} domain${limit === 1 ? "" : "s"}. Upgrade to add more.`
          : insertError.message.includes("duplicate")
            ? "That domain is already on your list."
            : insertError.message,
      );
      setAdding(false);
      return;
    }

    setInput("");
    setAdding(false);
    router.refresh();

    // The empty state promises "We will score it now", so do that rather than
    // leaving a new row sitting at "never scanned" until someone clicks.
    if (created) await scan(created.id, created.domain);
  }

  async function remove(row: DomainRow) {
    setError(null);
    const { error: deleteError } = await supabase.from("domains").delete().eq("id", row.id);
    if (deleteError) {
      setError(`Could not remove ${row.domain}. ${deleteError.message}`);
      return;
    }
    if (open?.id === row.id) setOpen(null);
    setConfirmRemove(null);
    setNotice(`${row.domain} is no longer monitored.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addDomain} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="new-domain" className="sr-only">
          Domain to monitor
        </label>
        <input
          id="new-domain"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={atLimit}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          inputMode="url"
          aria-invalid={Boolean(error)}
          placeholder={atLimit ? "Domain limit reached for your plan" : "Add a domain to monitor"}
          className="mono min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-signal disabled:bg-line-soft disabled:text-mute"
        />
        <button
          type="submit"
          disabled={adding || atLimit || !input.trim()}
          className="rounded-lg bg-ink px-5 py-3 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal disabled:opacity-40"
        >
          {adding ? "Adding…" : "Add domain"}
        </button>
      </form>

      {prefill && alreadyAdded && (
        <p className="mono rounded-md bg-signal-wash px-3.5 py-2.5 text-xs text-signal-deep">
          {prefill} is already on your list.
        </p>
      )}

      {atLimit && prefill && !alreadyAdded && (
        <p className="mono rounded-md bg-warn-wash px-3.5 py-2.5 text-xs text-warn-ink">
          Your {plan} plan is full at {limit} domain{limit === 1 ? "" : "s"}.{" "}
          <Link href="/pricing" className="font-semibold underline underline-offset-4">
            See plans
          </Link>{" "}
          to monitor {prefill} as well.
        </p>
      )}

      <div aria-live="polite">
        {error && (
          <p className="mono rounded-md bg-fail-wash px-3.5 py-2.5 text-xs text-fail-ink">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mono rounded-md bg-line-soft px-3.5 py-2.5 text-xs text-ink-soft">
            {notice}
          </p>
        )}
      </div>

      {domains.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="font-display text-xl font-bold tracking-tight text-ink">
            No domains yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-base leading-relaxed text-ink-soft">
            Add the domain you send mail from. We will score it now and re-check it every day.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {domains.map((row) => (
            <div key={row.id} className="border-b border-line-soft last:border-0">
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div
                  className="display w-11 shrink-0 text-d1 leading-none"
                  style={{ color: gradeColor(row.last_score) }}
                >
                  {row.last_grade ?? "–"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mono text-sm font-semibold text-ink">{row.domain}</div>
                  <div className="mono mt-0.5 text-2xs text-mute">
                    {row.last_score !== null ? `${row.last_score}/100 · ` : ""}
                    {ago(row.last_scanned_at)}
                  </div>
                </div>

                {confirmRemove === row.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-ink-soft">Stop monitoring?</span>
                    <button
                      onClick={() => remove(row)}
                      className="rounded-md bg-fail px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="rounded-md border border-line px-3 py-2 text-sm text-ink-soft transition-colors hover:border-signal hover:text-signal"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => scan(row.id, row.domain)}
                      disabled={scanning === row.id}
                      className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-50"
                    >
                      {scanning === row.id ? "Scanning…" : "Rescan"}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(row.id)}
                      aria-label={`Stop monitoring ${row.domain}`}
                      className="rounded-md p-2 text-mute transition-colors hover:text-fail-ink"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                        <path
                          d="M3.5 4h8m-6.5 0V3a1 1 0 011-1h3a1 1 0 011 1v1m1 0v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {open?.id === row.id && (
                <div className="border-t border-line-soft bg-paper p-4">
                  <Results result={open.result} compact />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mono text-2xs text-mute">
        {domains.length} of {limit} domain{limit === 1 ? "" : "s"} used on the {plan} plan.
      </p>
    </div>
  );
}
