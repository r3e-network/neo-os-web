import React from "react";

interface PactGlyphProps {
  /** Width/height in px (square). */
  size?: number;
  /** Accessible label / SVG <title>. */
  title?: string;
  className?: string;
}

/**
 * PactGlyph — a warm two-person commitment mark for the Breakup Contract hero.
 *
 * Two clasped/overlapping figures sharing a single heart, rendered in the app's
 * single green accent hue (Neo Soft brand) on a soft mint tile. Replaces the
 * generic chat-bubble "social" CategoryIcon so the hero reads as an intimate
 * pact between two people rather than a legal/escrow tool.
 */
export const PactGlyph: React.FC<PactGlyphProps> = ({ size = 40, title, className }) => {
  const uid = React.useId().replace(/:/g, "");
  const tileGrad = `pact-tile-${uid}`;
  const sheen = `pact-sheen-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={tileGrad} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4BE2A6" />
          <stop offset="1" stopColor="#16C784" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.3" cy="0.22" r="0.75">
          <stop stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="13" fill={`url(#${tileGrad})`} />
      <rect x="4" y="4" width="40" height="40" rx="13" fill={`url(#${sheen})`} />
      <rect x="4.75" y="4.75" width="38.5" height="38.5" rx="12.25" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.5" />
      {/* Two heads leaning together */}
      <circle cx="18" cy="19.5" r="3.6" fill="#FFFFFF" />
      <circle cx="30" cy="19.5" r="3.6" fill="#D5EEC9" />
      {/* Two shoulders forming a clasped pair */}
      <path
        d="M12 34c0-4 3-7 6-7s6 3 6 7"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24 34c0-4 3-7 6-7s6 3 6 7"
        stroke="#D5EEC9"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Shared heart between them */}
      <path
        d="M24 31.6l-3.1-3c-1.1-1-1.1-2.7 0-3.7a2.5 2.5 0 0 1 3.1-.2 2.5 2.5 0 0 1 3.1.2c1.1 1 1.1 2.7 0 3.7l-3.1 3Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};

export default PactGlyph;
