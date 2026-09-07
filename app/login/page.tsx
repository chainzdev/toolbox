"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Nav";

type Mode = "signin" | "signup" | "forgot";

/** Supabase's raw messages are terse; these are the three people actually hit. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password do not match an account. Check the password, or create an account below.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That email already has an account. Sign in instead, or reset the password.";
  }
  if (m.includes("email not confirmed")) {
    return "This account still needs its email confirmed. Check your inbox for the confirmation link.";
  }
  return message;
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rawNext = params.get("next");
  // Only same-origin absolute paths, so ?next= cannot become an open redirect.
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : "/dashboard";
  const plan = params.get("plan");

  function switchMode(to: Mode) {
    setMode(to);
    setError(null);
    setNotice(null);
  }

  async function afterAuth() {
    if (plan === "pro" || plan === "agency") {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
      } catch {
        // fall through to the dashboard — they can upgrade from there instead
      }
    }
    router.push(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(friendlyAuthError(error.message));
      else {
        setNotice(
          `If ${email} has an account, a reset link is on its way. The link expires in an hour.`,
        );
      }
      setBusy(false);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(friendlyAuthError(error.message));
      } else if (data.session) {
        await afterAuth();
        return;
      } else {
        setNotice("Check your email to confirm the address, then sign in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(friendlyAuthError(error.message));
      } else {
        await afterAuth();
        return;
      }
    }
    setBusy(false);
  }

  const heading =
    mode === "signup" ? "Start monitoring" : mode === "forgot" ? "Reset password" : "Welcome back";
  const blurb =
    mode === "signup"
      ? "Free account, no card. Save a domain and keep its scan history."
      : mode === "forgot"
        ? "Enter the email on the account and we will send a link to set a new password."
        : "Sign in to your monitored domains and alerts.";

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />

      <main id="main" className="relative flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Wordmark className="mb-10 justify-center" />

          <div className="rounded-xl border border-line bg-surface p-7 shadow-[0_1px_3px_rgba(15,28,46,0.04),0_16px_40px_-16px_rgba(15,28,46,0.14)]">
            <h1 className="display text-d1">{heading}</h1>
            <p className="mt-2 text-base leading-relaxed text-ink-soft">{blurb}</p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <div>
                <label htmlFor="email" className="eyebrow mb-1.5 block">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mono w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink outline-none transition-colors focus:border-signal"
                  placeholder="you@company.com"
                />
              </div>

              {mode !== "forgot" && (
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <label htmlFor="password" className="eyebrow">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs text-signal underline-offset-4 hover:underline"
                      >
                        Forgot it?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mono w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink outline-none transition-colors focus:border-signal"
                    placeholder="At least 8 characters"
                  />
                </div>
              )}

              <div aria-live="polite">
                {error && (
                  <p className="rounded-md bg-fail-wash px-3 py-2 text-xs leading-relaxed text-fail-ink">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="rounded-md bg-signal-wash px-3 py-2 text-xs leading-relaxed text-signal-deep">
                    {notice}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-ink py-3 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal disabled:opacity-50"
              >
                {busy
                  ? "Working…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-mute">
              {mode === "forgot" ? (
                <button
                  onClick={() => switchMode("signin")}
                  className="font-medium text-signal underline-offset-4 hover:underline"
                >
                  Back to sign in
                </button>
              ) : (
                <>
                  {mode === "signup" ? "Already have an account?" : "No account yet?"}{" "}
                  <button
                    onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
                    className="font-medium text-signal underline-offset-4 hover:underline"
                  >
                    {mode === "signup" ? "Sign in" : "Create one free"}
                  </button>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-mute">
            You can{" "}
            <Link href="/" className="text-signal underline-offset-4 hover:underline">
              scan any domain without an account
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
