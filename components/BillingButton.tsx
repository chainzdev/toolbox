"use client";

import { useState } from "react";

export function BillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Every failure here used to be swallowed: a non-ok response fell through
   * the `if`, the finally cleared the spinner, and the button just went back
   * to idle. Clicking "Manage billing" and having nothing happen, forever, is
   * indistinguishable from a broken page.
   */
  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not open the billing portal.");
    } catch {
      setError("Could not reach Stripe. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="mono rounded border border-line px-2.5 py-1 text-2xs font-medium text-ink-soft transition-colors hover:border-signal hover:text-signal disabled:opacity-50"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {error && (
        <span
          role="alert"
          className="mono absolute top-full right-0 z-10 mt-2 w-60 rounded-md border border-line bg-surface px-3 py-2 text-2xs leading-relaxed text-fail-ink shadow-[0_8px_24px_-8px_rgba(15,28,46,0.25)]"
        >
          {error}
        </span>
      )}
    </span>
  );
}
