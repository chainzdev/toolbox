import type { Metadata } from "next";
import { Nav, Footer } from "@/components/Nav";
import { PlanButton } from "@/components/PlanButton";
import { COMPARE, PLANS } from "@/lib/plans";
import { hasSessionCookie } from "@/lib/session-hint";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Scanning is free forever. Daily monitoring and alerts from $29/month. Agency plans cover 50 client domains with white-label reports.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const signedIn = await hasSessionCookie();

  return (
    <div className="min-h-screen">
      <Nav signedIn={signedIn} />

      <main id="main">
        <section className="relative overflow-hidden border-b border-line">
          <div className="gridpaper gridpaper-fade absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-14 sm:px-8 sm:pt-20">
            <div className="max-w-2xl">
              <h1 className="display text-d3 sm:text-d4">
                Scanning is free.
                <br />
                Watching costs money.
              </h1>
              <p className="mt-5 text-xl leading-relaxed text-ink-soft">
                The audit stays free forever. What you pay for is the alert at 9am telling you
                a record changed overnight — before your campaign goes out against it.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-xl border bg-surface p-7 ${
                    p.featured ? "border-ink shadow-[0_3px_0_var(--color-ink)]" : "border-line"
                  }`}
                >
                  {p.featured && (
                    <span className="mono absolute -top-2.5 left-7 rounded bg-signal px-2 py-0.5 text-2xs font-semibold tracking-wider text-white uppercase">
                      Most popular
                    </span>
                  )}
                  <div className="mono text-xs font-semibold tracking-wider text-mute uppercase">
                    {p.name}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="display text-d3">{p.price}</span>
                    <span className="text-sm text-mute">{p.cadence}</span>
                  </div>
                  <p className="mt-2 text-base leading-relaxed text-ink-soft">{p.line}</p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.features.map((f) => (
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
                  <PlanButton
                    plan={p.id}
                    href={p.href}
                    signedIn={signedIn}
                    featured={p.featured}
                  >
                    {p.cta}
                  </PlanButton>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
            <h2 className="display text-d2">What each plan includes</h2>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <caption className="sr-only">
                  Feature comparison across the Free, Pro and Agency plans
                </caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="eyebrow py-3 pr-4 font-normal">
                      Feature
                    </th>
                    <th scope="col" className="eyebrow py-3 pr-4 font-normal">
                      Free
                    </th>
                    <th scope="col" className="eyebrow py-3 pr-4 font-normal">
                      Pro
                    </th>
                    <th scope="col" className="eyebrow py-3 font-normal">
                      Agency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.label} className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="py-3.5 pr-4 text-base font-normal text-ink"
                      >
                        {r.label}
                      </th>
                      <td className="mono py-3.5 pr-4 text-sm text-mute">{r.free}</td>
                      <td className="mono py-3.5 pr-4 text-sm text-ink">{r.pro}</td>
                      <td className="mono py-3.5 text-sm text-ink">{r.agency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-8 max-w-2xl text-base leading-relaxed text-mute">
              Every plan starts on Free with no card. Upgrade when you want the daily re-scan
              running without you.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
