"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanId } from "@/lib/plans";

export function PlanButton({
  plan,
  href,
  signedIn,
  featured,
  children,
}: {
  plan: PlanId;
  href: string;
  signedIn: boolean;
  featured: boolean;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const className = `mt-7 block rounded-lg py-3 text-center font-display text-base font-bold tracking-tight transition-colors disabled:opacity-50 ${
    featured
      ? "bg-ink text-white hover:bg-signal"
      : "border border-line text-ink hover:border-signal hover:text-signal"
  }`;

  // Free (or signed-out) visitors just follow the link to signup/login.
  if (plan === "free" || !signedIn) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));

      /**
       * `signedIn` is read from cookie presence, so it can be optimistic — an
       * expired session lands here. Sending them to sign in with the plan
       * still attached is the useful response; an error message telling
       * someone to sign in, on a page with no sign-in button, is not.
       */
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${plan}`)}`;
        return;
      }

      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={upgrade} disabled={busy} className={`w-full ${className}`}>
        {busy ? "Redirecting…" : children}
      </button>
      {error && (
        <p role="alert" className="mono mt-2 text-xs text-fail-ink">
          {error}
        </p>
      )}
    </div>
  );
}
