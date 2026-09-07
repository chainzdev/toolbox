import { Record } from "./Record";

const NOTES = [
  {
    token: "p=none",
    tone: "warn" as const,
    text: "Monitors only. Receivers are told to take no action against mail forged in your name.",
  },
  {
    token: "pct=20",
    tone: "warn" as const,
    text: "Even that non-policy is applied to a fifth of your mail. The rest is unevaluated.",
  },
  {
    token: "no rua=",
    tone: "fail" as const,
    text: "No reporting address, so nothing tells you who is already sending as this domain.",
  },
];

/**
 * A worked example above the fold: one record, read the way the product
 * reads it. Shows the payoff before anyone types anything.
 */
export function Specimen() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_3px_rgba(15,28,46,0.04),0_18px_40px_-20px_rgba(15,28,46,0.18)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="eyebrow">Specimen</span>
        <span className="mono text-2xs text-mute">_dmarc.acme.example</span>
      </div>

      <div className="px-5 py-5">
        <Record value="v=DMARC1; p=none; pct=20" />

        <ul className="mt-5 space-y-3.5">
          {NOTES.map((n) => (
            <li key={n.token} className="flex gap-3">
              <span
                className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                  n.tone === "fail" ? "bg-fail" : "bg-warn"
                }`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="mono block text-xs font-semibold text-ink">
                  {n.token}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">
                  {n.text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-baseline justify-between border-t border-line bg-sunken px-5 py-3.5">
        <span className="mono text-2xs text-mute">Scores</span>
        <span className="mono text-xs font-semibold text-warn-ink">15 / 35 on DMARC</span>
      </div>
    </div>
  );
}
