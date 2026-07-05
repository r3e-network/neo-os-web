import React from "react";

/**
 * Hand-built SVG casino chip — used for stake selection in the dice game and
 * any betting/reward surface. Category-tintable. Supports a denomination label.
 */
export interface ChipArtProps {
  /** Denomination text rendered in the chip center, e.g. "0.5" or "5". */
  label?: string;
  className?: string;
  size?: number;
  color?: string;
  edgeColor?: string;
  selected?: boolean;
}

export function ChipArt({
  label,
  className,
  size = 64,
  color,
  edgeColor,
  selected,
}: ChipArtProps) {
  const body = color ?? "var(--mx2-accent, #f59e0b)";
  const edge = edgeColor ?? "var(--mx2-accent-strong, #d97706)";
  const ink = "var(--mx2-action-ink, #fff)";
  const wedges = 8;
  return (
    <svg
      className={["mx2-chip", className, selected ? "mx2-chip--selected" : null]
        .filter(Boolean)
        .join(" ")}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label ? `${label} chip` : "chip"}
    >
      <defs>
        <radialGradient id="mx2-chip-body" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={body} stopOpacity="1" />
          <stop offset="100%" stopColor={edge} stopOpacity="1" />
        </radialGradient>
        <filter id="mx2-chip-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="rgba(31,41,55,0.28)" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#mx2-chip-body)" filter="url(#mx2-chip-shadow)" />
      {/* outer edge ring */}
      <circle cx="50" cy="50" r="46" fill="none" stroke={ink} strokeOpacity="0.5" strokeWidth="3" />
      {/* edge wedges (classic casino chip notches) */}
      {Array.from({ length: wedges }).map((_, i) => {
        const a = (i / wedges) * Math.PI * 2;
        const x1 = 50 + Math.cos(a) * 46;
        const y1 = 50 + Math.sin(a) * 46;
        const x2 = 50 + Math.cos(a) * 40;
        const y2 = 50 + Math.sin(a) * 40;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={ink}
            strokeOpacity="0.55"
            strokeWidth="7"
            strokeLinecap="butt"
          />
        );
      })}
      {/* inner face */}
      <circle cx="50" cy="50" r="32" fill={ink} fillOpacity="0.14" />
      <circle cx="50" cy="50" r="32" fill="none" stroke={ink} strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="50" cy="50" r="24" fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="3 4" />
      {label ? (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={label.length > 3 ? "16" : "20"}
          fontWeight="800"
          fill={ink}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}
