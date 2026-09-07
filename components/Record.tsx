import React from "react";

/**
 * Renders a raw DNS record with the parts that decide the outcome
 * highlighted. The whole product is about one cryptic string, so the
 * string itself is the thing worth showing.
 */

const RULES: { re: RegExp; cls: string }[] = [
  // Strongest settings
  { re: /(^|\s)-all\b/g, cls: "tok-strict" },
  { re: /\bp=reject\b/gi, cls: "tok-strict" },
  { re: /\bsp=reject\b/gi, cls: "tok-strict" },
  // Partial settings
  { re: /(^|\s)~all\b/g, cls: "tok-loose" },
  { re: /(^|\s)\?all\b/g, cls: "tok-loose" },
  { re: /\bp=quarantine\b/gi, cls: "tok-loose" },
  { re: /\bp=none\b/gi, cls: "tok-loose" },
  { re: /\bpct=\d+\b/gi, cls: "tok-loose" },
  // Dangerous
  { re: /(^|\s)\+all\b/g, cls: "tok-bad" },
  // Structural keys
  { re: /\bv=(spf1|DMARC1|DKIM1|BIMI1|STSv1|TLSRPTv1)\b/gi, cls: "tok-key" },
  { re: /\b(rua|ruf)=/gi, cls: "tok-key" },
  { re: /\b(include|redirect)[:=]/gi, cls: "tok-key" },
];

interface Span {
  start: number;
  end: number;
  cls: string;
}

export function Record({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const spans: Span[] = [];

  for (const { re, cls } of RULES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      // Skip a leading whitespace capture so it is not swallowed by the token.
      const lead = m[1] === " " || m[1] === "\n" ? 1 : 0;
      const start = m.index + lead;
      const end = m.index + m[0].length;
      if (spans.some((s) => start < s.end && end > s.start)) continue;
      spans.push({ start, end, cls });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  spans.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((s, i) => {
    if (s.start > cursor) nodes.push(value.slice(cursor, s.start));
    nodes.push(
      <span key={i} className={s.cls}>
        {value.slice(s.start, s.end)}
      </span>,
    );
    cursor = s.end;
  });
  if (cursor < value.length) nodes.push(value.slice(cursor));

  return (
    <div
      className={`mono overflow-x-auto rounded-md border border-line-soft bg-sunken px-3 py-2.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-ink-soft ${className}`}
    >
      {nodes}
    </div>
  );
}
