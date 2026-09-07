"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Nav";

/**
 * Where the emailed reset link lands. Supabase's client picks the recovery
 * token out of the URL fragment and exchanges it for a session, then fires
 * PASSWORD_RECOVERY — until that happens updateUser() has nothing to act on,
 * so the form stays disabled rather than failing on submit.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        if (timer) clearTimeout(timer);
        setReady(true);
      }
    });

    // Covers the case where the session was already established before this
    // component mounted, so no event is coming.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady(true);
      // Give the client a moment to exchange a token from the URL fragment
      // before concluding the link is dead.
      else timer = setTimeout(() => setExpired(true), 2500);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setDone(true);
    setBusy(false);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />

      <main id="main" className="relative flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Wordmark className="mb-10 justify-center" />

          <div className="rounded-xl border border-line bg-surface p-7 shadow-[0_1px_3px_rgba(15,28,46,0.04),0_16px_40px_-16px_rgba(15,28,46,0.14)]">
            <h1 className="display text-d1">Set a new password</h1>

            {done ? (
              <p className="mt-4 rounded-md bg-pass-wash px-3 py-2.5 text-xs leading-relaxed text-pass-ink">
                Password changed. Taking you to your dashboard.
              </p>
            ) : !ready && expired ? (
              <>
                <p className="mt-2 text-base leading-relaxed text-ink-soft">
                  This reset link is expired or has already been used. Reset links are good for
                  one hour.
                </p>
                <Link
                  href="/login"
                  className="mt-6 block rounded-lg bg-ink py-3 text-center font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal"
                >
                  Request a new link
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-base leading-relaxed text-ink-soft">
                  Pick something at least 8 characters long. You will be signed in straight
                  after.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-3">
                  <div>
                    <label htmlFor="new-password" className="eyebrow mb-1.5 block">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mono w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink outline-none transition-colors focus:border-signal"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="eyebrow mb-1.5 block">
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="mono w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink outline-none transition-colors focus:border-signal"
                    />
                  </div>

                  <div aria-live="polite">
                    {error && (
                      <p className="rounded-md bg-fail-wash px-3 py-2 text-xs leading-relaxed text-fail-ink">
                        {error}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !ready}
                    className="w-full rounded-lg bg-ink py-3 font-display text-base font-bold tracking-tight text-white transition-colors hover:bg-signal disabled:opacity-50"
                  >
                    {busy ? "Saving…" : !ready ? "Checking your link…" : "Save password"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
