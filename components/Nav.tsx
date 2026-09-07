import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Inboxproof home"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-ink transition-colors group-hover:bg-signal">
        <span className="block h-2 w-2 rounded-[1px] bg-white" />
      </span>
      <span className="font-display text-md font-extrabold tracking-[-0.02em] text-ink">
        Inboxproof
      </span>
    </Link>
  );
}

export function Nav({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />

        {/* Two links, so no menu. "What we check" is an in-page anchor and
            drops away on small screens; Pricing is a destination and stays,
            because it was unreachable on mobile with no menu to reach it
            from. Every nav target also lives in the footer. */}
        <div className="flex items-center gap-0.5 sm:gap-2">
          <Link
            href="/#checks"
            className="hidden rounded-md px-3 py-2 text-base text-ink-soft transition-colors hover:text-signal sm:block"
          >
            What we check
          </Link>
          <Link
            href="/pricing"
            className="rounded-md px-2 py-2 text-sm whitespace-nowrap text-ink-soft transition-colors hover:text-signal sm:px-3 sm:text-base"
          >
            Pricing
          </Link>
          <Link
            href={signedIn ? "/dashboard" : "/login"}
            className="rounded-md px-2 py-2 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:text-signal sm:px-3 sm:text-base"
          >
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
          {!signedIn && (
            <Link
              href="/login?mode=signup"
              className="rounded-md bg-ink px-3 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-signal sm:px-4 sm:text-base"
            >
              Start free
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Email authentication monitoring. We read the records that decide whether your
              mail is trusted, and tell you the day they break.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:gap-x-16">
            <div className="space-y-0.5">
              <div className="eyebrow mb-3">Product</div>
              <Link href="/" className="block py-1.5 text-ink-soft transition-colors hover:text-signal">
                Free scanner
              </Link>
              <Link href="/pricing" className="block py-1.5 text-ink-soft transition-colors hover:text-signal">
                Pricing
              </Link>
              <Link href="/dashboard" className="block py-1.5 text-ink-soft transition-colors hover:text-signal">
                Dashboard
              </Link>
            </div>
            <div className="space-y-0.5">
              <div className="eyebrow mb-3">Reference</div>
              <Link href="/#checks" className="block py-1.5 text-ink-soft transition-colors hover:text-signal">
                What we check
              </Link>
              <Link href="/#faq" className="block py-1.5 text-ink-soft transition-colors hover:text-signal">
                FAQ
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-line-soft pt-6 sm:flex-row">
          <p className="mono text-2xs text-mute">
            © {new Date().getFullYear()} Inboxproof
          </p>
          <p className="mono text-2xs text-mute">
            Every check runs against public DNS. We never touch your mailbox.
          </p>
        </div>
      </div>
    </footer>
  );
}
