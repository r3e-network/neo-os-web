import React from "react";

export type CoinKind = "neo" | "generic" | "violet" | "stack";

export interface CoinArtProps {
  /** Which coin to render. */
  kind?: CoinKind;
  /** Width/height in px (square). */
  size?: number;
  /** Accessible label / SVG <title>. */
  title?: string;
  className?: string;
}

const KIND_LABEL: Record<CoinKind, string> = {
  neo: "Neo coin",
  generic: "Token coin",
  violet: "Token coin",
  stack: "Stack of coins",
};

/**
 * CoinArt — soft, 3D-ish token coins with pastel gradient fills.
 * `neo` renders the Neo "N" coin, `generic`/`violet` render plain tokens,
 * and `stack` renders a small pile of coins.
 */
export const CoinArt: React.FC<CoinArtProps> = ({
  kind = "neo",
  size = 96,
  title,
  className,
}) => {
  const uid = React.useId().replace(/:/g, "");
  const faceGreen = `ca-fg-${uid}`;
  const faceViolet = `ca-fv-${uid}`;
  const faceGold = `ca-gold-${uid}`;
  const rim = `ca-rim-${uid}`;
  const sheen = `ca-sheen-${uid}`;
  const shadowId = `ca-shadow-${uid}`;
  const label = title ?? KIND_LABEL[kind];

  const Defs = (
    <defs>
      <linearGradient id={faceGreen} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#4BE2A6" />
        <stop offset="1" stopColor="#16C784" />
      </linearGradient>
      <linearGradient id={faceViolet} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#A795FF" />
        <stop offset="1" stopColor="#7B61FF" />
      </linearGradient>
      <linearGradient id={faceGold} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#FFE9C4" />
        <stop offset="1" stopColor="#FFC773" />
      </linearGradient>
      <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#FFFFFF" stopOpacity="0.6" />
        <stop offset="1" stopColor="#1E1E2E" stopOpacity="0.18" />
      </linearGradient>
      <radialGradient id={sheen} cx="0.35" cy="0.3" r="0.5">
        <stop stopColor="#FFFFFF" stopOpacity="0.75" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.5">
        <stop stopColor="#1E1E2E" stopOpacity="0.18" />
        <stop offset="1" stopColor="#1E1E2E" stopOpacity="0" />
      </radialGradient>
    </defs>
  );

  if (kind === "stack") {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>{label}</title>
        {Defs}
        <ellipse cx="48" cy="84" rx="32" ry="7" fill={`url(#${shadowId})`} />
        {/* bottom coin (gold) */}
        <ellipse cx="48" cy="64" rx="28" ry="11" fill="#E0A94E" />
        <ellipse cx="48" cy="60" rx="28" ry="11" fill={`url(#${faceGold})`} stroke="#E0A94E" strokeWidth="1.5" />
        {/* middle coin (violet) */}
        <ellipse cx="48" cy="50" rx="26" ry="10" fill="#5E45E0" />
        <ellipse cx="48" cy="46" rx="26" ry="10" fill={`url(#${faceViolet})`} stroke="#5E45E0" strokeWidth="1.5" />
        {/* top coin (green) */}
        <ellipse cx="48" cy="36" rx="24" ry="9.5" fill="#0FB174" />
        <ellipse cx="48" cy="32" rx="24" ry="9.5" fill={`url(#${faceGreen})`} stroke="#0FB174" strokeWidth="1.5" />
        <ellipse cx="40" cy="29" rx="9" ry="3.5" fill={`url(#${sheen})`} />
        {/* N mark on top coin */}
        <path
          d="M40 28v8M40 28l8 8M48 28v8"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
        />
      </svg>
    );
  }

  const face =
    kind === "violet" ? faceViolet : kind === "generic" ? faceGold : faceGreen;
  const edge =
    kind === "violet" ? "#5E45E0" : kind === "generic" ? "#E0A94E" : "#0FB174";

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      {Defs}
      <ellipse cx="48" cy="82" rx="30" ry="7" fill={`url(#${shadowId})`} />
      {/* coin thickness */}
      <ellipse cx="48" cy="52" rx="34" ry="33" fill={edge} />
      {/* coin face */}
      <circle cx="48" cy="46" r="34" fill={`url(#${face})`} />
      <circle cx="48" cy="46" r="34" stroke={`url(#${rim})`} strokeWidth="2.5" />
      {/* inner ring */}
      <circle cx="48" cy="46" r="26" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      {/* sheen */}
      <ellipse cx="36" cy="32" rx="13" ry="8" fill={`url(#${sheen})`} transform="rotate(-24 36 32)" />

      {kind === "neo" ? (
        <path
          d="M37 34v24M37 34l22 24M59 34v24"
          stroke="#FFFFFF"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
        />
      ) : (
        <circle cx="48" cy="46" r="9" stroke="#FFFFFF" strokeWidth="4" fillOpacity="0" />
      )}
    </svg>
  );
};

export default CoinArt;
