import React from "react";

/**
 * Hand-built SVG dice art — a 3D-feeling isometric die with crisp pips.
 * Category-tintable via CSS custom properties (--mx2-accent, --mx2-ink).
 * These are React components (not binary files): infinitely scalable, crisp at
 * any size, self-contained, and recolored by the active category theme.
 *
 * Props:
 *  - face: 1..6 (pip count)
 *  - className: animation/utility classes (e.g. "mx2-roll")
 *  - size: px (default 96)
 */

export type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

// Pip positions on a 100x100 face, per face value (grid 3x3 → centers).
const PIP_LAYOUT: Record<DiceFace, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

export interface DiceArtProps {
  face: DiceFace;
  className?: string;
  size?: number;
  /** Tint override; defaults to the CSS var chain. */
  color?: string;
  pipColor?: string;
}

export function DiceArt({
  face,
  className,
  size = 96,
  color,
  pipColor,
}: DiceArtProps) {
  const pips = PIP_LAYOUT[face] ?? [];
  const fill = color ?? "var(--mx2-surface, #fff)";
  const ink = pipColor ?? "var(--mx2-ink, #1f2937)";
  return (
    <svg
      className={["mx2-die", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`die showing ${face}`}
    >
      <defs>
        <linearGradient id="mx2-die-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="1" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.92" />
        </linearGradient>
        <filter id="mx2-die-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="3.5"
            floodColor="rgba(31,41,55,0.28)"
          />
        </filter>
      </defs>
      {/* rounded square face */}
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="20"
        ry="20"
        fill="url(#mx2-die-face)"
        stroke="var(--mx2-border-strong, rgba(31,41,55,0.18))"
        strokeWidth="2"
        filter="url(#mx2-die-shadow)"
      />
      {/* accent rim glow */}
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="20"
        ry="20"
        fill="none"
        stroke="var(--mx2-accent, #f59e0b)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
      />
      {pips.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="8.5"
          fill={ink}
          opacity="0.92"
        />
      ))}
    </svg>
  );
}

/**
 * A smaller "pip dot" used standalone (e.g. face-selection grids, chip stacks).
 */
export function PipDot({ className }: { className?: string }) {
  return (
    <svg
      className={["mx2-pip", className].filter(Boolean).join(" ")}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="6" fill="var(--mx2-accent, #f59e0b)" />
    </svg>
  );
}
