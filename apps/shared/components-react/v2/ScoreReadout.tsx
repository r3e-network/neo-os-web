import React from "react";

/**
 * v2 ScoreReadout — a readout strip shown above the ActionRail summarizing the
 * live state (stake, payout preview, balance, network). Compact, high-contrast,
 * tabular-nums so numbers align.
 *
 * Each item is { label, value, accent? }. Accent items use the category accent.
 */
export interface ScoreItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Render the value in the category accent (primary metric). */
  accent?: boolean;
}

export interface ScoreReadoutProps {
  category?: "game" | "defi" | "nft" | "tool" | "social" | "governance";
  className?: string;
  items: ScoreItem[];
}

export function ScoreReadout({ category = "game", className, items }: ScoreReadoutProps) {
  return (
    <div
      className={["mx2", `mx2-cat-${category}`, "mx2-score", className]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((it, i) => (
        <div key={i} className="mx2-score__item" data-accent={it.accent ? "true" : undefined}>
          <span className="mx2-score__label">{it.label}</span>
          <span className="mx2-score__value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
