import React from "react";

/**
 * Hand-built SVG tarot card frame — a category-tinted playing-card outline with
 * a luminous rim and corner flourishes. Used as the scene card SLOT frame around
 * the per-card art (the 78 deck SVGs), and as a standalone back-of-deck tile.
 *
 * The deck's own 78 card-front SVGs (./cards/NN-*.svg) remain the card artwork;
 * this component provides the warm v2 frame/slot chrome + the dealing back.
 */
export interface CardFrameProps {
  className?: string;
  width?: number;
  /** Render the back-of-deck face (sealed/oracle pattern) instead of an empty frame. */
  back?: boolean;
  /** Tint label rendered inside a back face (e.g. "?" before reveal). */
  label?: React.ReactNode;
}

const RATIO = 1.4; // tarot card aspect (height/width)

export function CardFrame({
  className,
  width = 120,
  back,
  label,
}: CardFrameProps) {
  const h = width * RATIO;
  const accent = "var(--mx2-accent, #f59e0b)";
  const accentDeep = "var(--mx2-accent-strong, #d97706)";
  const ink = "var(--mx2-ink, #1f2937)";
  const surface = "var(--mx2-surface, #ffffff)";
  return (
    <svg
      className={["mx2-card-frame", className].filter(Boolean).join(" ")}
      width={width}
      height={h}
      viewBox="0 0 120 168"
      role="img"
      aria-label={back ? "face-down card" : "card slot"}
    >
      <defs>
        <linearGradient id="mx2-card-back-fill" x1="0" y1="0" x2="120" y2="168">
          <stop offset="0%" stopColor={accentDeep} />
          <stop offset="55%" stopColor={accent} />
          <stop offset="100%" stopColor={accentDeep} />
        </linearGradient>
        <filter id="mx2-card-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="rgba(31,41,55,0.28)" />
        </filter>
      </defs>
      <rect
        x="3"
        y="3"
        width="114"
        height="162"
        rx="12"
        ry="12"
        fill={back ? "url(#mx2-card-back-fill)" : surface}
        stroke={back ? "rgba(255,255,255,0.35)" : "var(--mx2-border-strong, rgba(31,41,55,0.18))"}
        strokeWidth="2"
        filter="url(#mx2-card-shadow)"
      />
      {/* luminous rim */}
      <rect
        x="3"
        y="3"
        width="114"
        height="162"
        rx="12"
        ry="12"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeOpacity={back ? "0.6" : "0.4"}
      />
      {back ? (
        <>
          {/* concentric oracle rings */}
          <circle cx="60" cy="84" r="42" fill="none" stroke="#fffdf6" strokeOpacity="0.28" strokeWidth="1.5" />
          <circle cx="60" cy="84" r="30" fill="none" stroke="#fffdf6" strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="2 3" />
          <circle cx="60" cy="84" r="18" fill="none" stroke="#fffdf6" strokeOpacity="0.35" strokeWidth="1.5" />
          {/* inner star/diamond */}
          <path
            d="M60 70 L64 84 L60 98 L56 84 Z"
            fill="#fffdf6"
            fillOpacity="0.85"
          />
        </>
      ) : (
        // empty-slot corner flourishes
        <>
          {["M12 18 L12 12 L18 12", "M108 18 L108 12 L102 12", "M12 150 L12 156 L18 156", "M108 150 L108 156 L102 156"].map(
            (d, i) => (
              <path key={i} d={d} fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
            ),
          )}
        </>
      )}
      {label != null && (
        <text
          x="60"
          y="84"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="20"
          fontWeight="800"
          fill="#fffdf6"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
