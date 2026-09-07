import { Scanner } from "@/components/Scanner";
import { Specimen } from "@/components/Specimen";
import { Nav, Footer } from "@/components/Nav";
import { PlanButton } from "@/components/PlanButton";
import { PLANS } from "@/lib/plans";
import { hasSessionCookie } from "@/lib/session-hint";

/**
 * Weights match lib/scanner.ts exactly and total 100. They previously summed
 * to 97 under a heading that said "one hundred points": MTA-STS and TLS
 * reporting are scored together as one transport check, and TLS reporting was
 * missing from this list entirely.
 */
const CHECKS = [
  {
    tag: "DMARC",
    weight: "35 pts",
    title: "The policy receivers actually obey",
    body: "We read your policy, your reporting address and your coverage percentage. A record sitting at p=none looks configured and enforces nothing — the most common false sense of safety in email.",
  },
  {
    tag: "SPF",
    weight: "25 pts",
    title: "Including the 10-lookup ceiling",
    body: "SPF fails permanently past ten DNS lookups, and every include: you add drags its own nested lookups with it. We resolve the whole tree and count them, which is how a record that looks fine turns out to be dead.",
  },
  {
    tag: "DKIM",
    weight: "25 pts",
    title: "Across 36 provider selectors",
    body: "Your signing key lives at a selector only your provider knows. We probe the selectors used by Google, Microsoft, SendGrid, Mailchimp and thirty others, then check the key length.",
  },
  {
    tag: "TRANSPORT",
    weight: "7 pts",
    title: "MTA-STS and TLS reporting",
    body: "MTA-STS tells receiving servers to refuse delivery over an unencrypted or untrusted connection instead of quietly downgrading. TLS reporting is how you find out when that starts failing.",
  },
  {
    tag: "MX",
    weight: "5 pts",
    title: "Routing and provider fingerprint",
    body: "Where your mail is delivered, who runs it, and whether the domain can receive the DMARC reports you asked to be sent.",
  },
  {
    tag: "BIMI",
    weight: "3 pts",
    title: "Your logo in the inbox",
    body: "Puts your brand mark beside your mail in Gmail and Apple Mail. It requires DMARC at quarantine or stricter first, so it doubles as proof your authentication is real.",
  },
];

const FAQ = [
  {
    q: "Do you need access to my email account?",
    a: "No. Every check runs against public DNS records — the same records any receiving mail server reads. We never ask for mailbox access, credentials, or an API key from your provider.",
  },
  {
    q: "What does the score actually measure?",
    a: "How completely your domain proves its own identity to a receiving server. DMARC carries 35 points because it is the record Google, Yahoo and Microsoft check first; SPF and DKIM carry 25 each because DMARC cannot pass without one of them aligned. The remaining 15 cover routing and transport hardening.",
  },
  {
    q: "Why monitor if I already fixed everything?",
    a: "Because DNS drifts. A new marketing tool gets added to SPF and pushes it past the lookup limit. Someone rotates a DKIM key and forgets to publish the new one. A registrar migration drops a TXT record. None of it announces itself — you find out from a customer who never got the invoice.",
  },
  {
    q: "Can I audit domains I do not own?",
    a: "Yes. DNS is public, so you can scan any domain — that is exactly how agencies use this on a prospect before a pitch, and how security teams check a partner before trusting their mail.",
  },
  {
    q: "How is this different from a one-off checker?",
    a: "A checker tells you today's state and forgets you. Inboxproof records every scan, so you get history, a diff when something changes, and an alert the day it breaks rather than the quarter after.",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function Home() {
  const signedIn = await hasSessionCookie();

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <Nav signedIn={signedIn} />

      <main id="main">
        {/* ---------------- Hero: the scanner is the pitch ---------------- */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />

          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-20 sm:pb-24">
            <div className="grid items-start gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
              <div>
                <div className="rise" style={{ animationDelay: "40ms" }}>
                  <span className="eyebrow">Free DNS authentication audit</span>
                </div>

                <h1
                  className="rise display mt-5 text-d3 text-balance sm:text-d5"
                  style={{ animationDelay: "110ms" }}
                >
                  Find out why your email lands in spam.
                </h1>

                <p
                  className="rise mt-6 max-w-xl text-xl leading-relaxed text-ink-soft"
                  style={{ animationDelay: "180ms" }}
                >
                  Gmail, Outlook and Yahoo decide whether to trust you before they read a
                  single word — by checking three DNS records. Inboxproof reads those records
                  the same way they do, and hands you the exact line to publish.
                </p>

                <div className="rise mt-8" style={{ animationDelay: "250ms" }}>
                  <Scanner />
                </div>
              </div>

              <div className="rise lg:pt-14" style={{ animationDelay: "330ms" }}>
                <Specimen />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- The stakes ---------------- */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
              <div>
                <span className="eyebrow">Why this became urgent</span>
                <h2 className="display mt-4 text-d2 sm:text-d3">
                  The rules changed. Most domains did not.
                </h2>
                <p className="mt-5 text-md leading-relaxed text-ink-soft">
                  In February 2024 Google and Yahoo began requiring SPF, DKIM and DMARC from
                  every sender above roughly 5,000 messages a day. Microsoft followed at
                  Outlook.com in May 2025. Mail that cannot prove who sent it is no longer
                  sorted into spam — increasingly it is refused at the door.
                </p>
                <p className="mt-4 text-md leading-relaxed text-ink-soft">
                  The failure is invisible from your side. Your provider reports the message as
                  sent. Nobody bounces. The revenue simply does not arrive.
                </p>
              </div>

              <div className="space-y-px overflow-hidden rounded-xl border border-line bg-line-soft">
                {[
                  {
                    n: "p=none",
                    label: "The record that protects nothing",
                    d: "The most common DMARC policy in the wild. It publishes a valid record, satisfies a checklist, and instructs receivers to take no action whatsoever against mail forged in your name.",
                  },
                  {
                    n: "10",
                    label: "DNS lookups before SPF dies",
                    d: "A hard protocol limit, counted across every nested include:. Cross it and the record does not degrade — it becomes a permanent error and receivers discard it entirely.",
                  },
                  {
                    n: "0",
                    label: "Warnings you get when it breaks",
                    d: "DNS has no changelog and no alert. A record edited on Tuesday is a deliverability collapse discovered in next month's pipeline review.",
                  },
                ].map((row) => (
                  <div key={row.n} className="bg-surface px-6 py-6">
                    <div className="flex items-baseline gap-4">
                      <span className="display shrink-0 text-d2 text-signal">{row.n}</span>
                      <span className="mono pt-1 text-xs font-semibold tracking-wide text-ink">
                        {row.label}
                      </span>
                    </div>
                    <p className="mt-2.5 text-base leading-relaxed text-ink-soft">{row.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- What we check ---------------- */}
        <section id="checks" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="display text-d2 sm:text-d3">Six records, one hundred points.</h2>
              <p className="mt-5 text-md leading-relaxed text-ink-soft">
                Weighted the way receiving servers actually weigh them, not evenly. Each check
                returns the published record, what it means, and the line to change.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {CHECKS.map((c) => (
                <div key={c.tag} className="bg-surface p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="mono text-xs font-semibold tracking-wider text-signal">
                      {c.tag}
                    </span>
                    <span className="mono text-2xs text-mute">{c.weight}</span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-ink">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-ink-soft">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- How it works: a real sequence ---------------- */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <span className="eyebrow">How it works</span>
            <h2 className="display mt-4 max-w-2xl text-d2 sm:text-d3">
              Scan, fix, then never think about it again.
            </h2>

            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {[
                {
                  n: "01",
                  t: "Scan",
                  d: "Type a domain. In about three seconds you get a score, a grade, and the raw record behind every check — no account, no credit card.",
                },
                {
                  n: "02",
                  t: "Fix",
                  d: "Each failing check comes with the specific record to publish, written for your setup rather than a generic template. Copy it into DNS and rescan.",
                },
                {
                  n: "03",
                  t: "Hold",
                  d: "Add the domain to monitoring. We re-check daily and email you the moment a record changes, breaks, or drifts out of compliance.",
                },
              ].map((s) => (
                <li key={s.n} className="relative border-t-2 border-ink pt-5">
                  <span className="mono absolute -top-0.5 right-0 text-2xs text-mute">
                    {s.n}
                  </span>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-ink">
                    {s.t}
                  </h3>
                  <p className="mt-2.5 text-base leading-relaxed text-ink-soft">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------- Pricing ---------------- */}
        <section id="pricing" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="display text-d2 sm:text-d3">
                Scanning is free. Watching costs money.
              </h2>
              <p className="mt-5 text-md leading-relaxed text-ink-soft">
                The audit stays free forever, because a one-time answer is worth less than
                knowing the day it changes.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border bg-surface p-7 ${
                    plan.featured
                      ? "border-ink shadow-[0_3px_0_var(--color-ink)]"
                      : "border-line"
                  }`}
                >
                  {plan.featured && (
                    <span className="mono absolute -top-2.5 left-7 rounded bg-signal px-2 py-0.5 text-2xs font-semibold tracking-wider text-white uppercase">
                      Most popular
                    </span>
                  )}

                  <div className="mono text-xs font-semibold tracking-wider text-mute uppercase">
                    {plan.name}
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="display text-d3">{plan.price}</span>
                    <span className="text-sm text-mute">{plan.cadence}</span>
                  </div>

                  <p className="mt-2 text-base leading-relaxed text-ink-soft">{plan.line}</p>

                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-base text-ink-soft">
                        <svg
                          className="mt-1 h-3.5 w-3.5 shrink-0 text-signal"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M2 7.5l3.2 3.2L12 4"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Shared with /pricing so a signed-in visitor goes straight to
                      Stripe here too. This page used to hand everyone a /login
                      link, which dropped the chosen plan on the floor. */}
                  <PlanButton
                    plan={plan.id}
                    href={plan.href}
                    signedIn={signedIn}
                    featured={plan.featured}
                  >
                    {plan.cta}
                  </PlanButton>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="scroll-mt-20 border-b border-line bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 className="display text-d2 sm:text-d3">What people ask first.</h2>

            <div className="mt-10 divide-y divide-line-soft border-t border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                    <span className="font-display text-xl font-bold tracking-tight text-ink">
                      {f.q}
                    </span>
                    <span className="mt-1 shrink-0 text-mute transition-transform group-open:rotate-45">
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                        <path
                          d="M7 1v12M1 7h12"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl pr-10 text-base leading-relaxed text-ink-soft">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Close ---------------- */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
            <h2 className="display text-d3 sm:text-d4">
              It takes three seconds
              <br />
              to find out.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-xl leading-relaxed text-ink-soft">
              Scan your domain, or one you are about to pitch. No account required.
            </p>
            <div className="mx-auto mt-9 max-w-xl text-left">
              <Scanner />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
