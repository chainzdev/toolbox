const SEGMENTS = 25;

function bandColor(score: number) {
  if (score >= 85) return "var(--color-pass)";
  if (score >= 60) return "var(--color-signal)";
  if (score >= 40) return "var(--color-warn)";
  return "var(--color-fail)";
}

/**
 * A segmented readout rather than a dial. Twenty-five bars, one per four
 * points, filling left to right as the scan resolves.
 */
export function Meter({
  score,
  grade,
  animate = true,
}: {
  score: number;
  grade: string;
  animate?: boolean;
}) {
  const lit = Math.round((score / 100) * SEGMENTS);
  const color = bandColor(score);

  return (
    <div className="flex items-end gap-5 sm:gap-7">
      <div className="shrink-0">
        <div
          className="display text-readout leading-[0.8] sm:text-readout-lg"
          style={{ color }}
        >
          {grade}
        </div>
        <div className="eyebrow mt-2">Grade</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="display text-d2 tabular-nums">{score}</span>
            <span className="mono text-sm text-mute">/ 100</span>
          </div>
          <span className="eyebrow hidden sm:block">Authentication score</span>
        </div>

        <div
          className="mt-3 flex h-11 items-end gap-[3px]"
          role="img"
          aria-label={`Score ${score} out of 100, grade ${grade}`}
        >
          {Array.from({ length: SEGMENTS }).map((_, i) => {
            const on = i < lit;
            return (
              <div
                key={i}
                className={`flex-1 rounded-[2px] ${animate ? "segment" : ""}`}
                style={{
                  height: on ? `${42 + (i / SEGMENTS) * 58}%` : "34%",
                  background: on ? color : "var(--color-line)",
                  opacity: on ? 1 : 0.55,
                  animationDelay: animate ? `${i * 22}ms` : undefined,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
