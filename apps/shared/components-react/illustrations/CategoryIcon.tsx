import React from "react";

export type CategoryName =
  | "finance"
  | "game"
  | "governance"
  | "identity"
  | "oracle"
  | "social"
  | "tool"
  | "nft";

export interface CategoryIconProps {
  /** Which category glyph to render. */
  name: CategoryName;
  /** Width/height in px (square). */
  size?: number;
  /** Accessible label / SVG <title>. Defaults to the category name. */
  title?: string;
  className?: string;
}

interface Duo {
  /** Tile gradient (background). */
  from: string;
  to: string;
  /** Solid accent for the foreground glyph. */
  accent: string;
  /** Soft pastel for the secondary glyph layer. */
  soft: string;
}

const THEME: Record<CategoryName, Duo> = {
  finance: { from: "#4BE2A6", to: "#16C784", accent: "#FFFFFF", soft: "#BFF6E1" },
  game: { from: "#A795FF", to: "#7B61FF", accent: "#FFFFFF", soft: "#E0E2FF" },
  governance: { from: "#7FB2FF", to: "#4F86F7", accent: "#FFFFFF", soft: "#DFF0FF" },
  identity: { from: "#FFC9B6", to: "#FF8E6E", accent: "#FFFFFF", soft: "#FFEBE4" },
  oracle: { from: "#9B8CFF", to: "#6A4FE6", accent: "#FFFFFF", soft: "#E0E2FF" },
  social: { from: "#5BD0C0", to: "#16C7A8", accent: "#FFFFFF", soft: "#D5EEC9" },
  tool: { from: "#FFD58A", to: "#FFB23E", accent: "#FFFFFF", soft: "#FFE4C3" },
  nft: { from: "#F58BD0", to: "#D957A8", accent: "#FFFFFF", soft: "#FFE4F4" },
};

const LABELS: Record<CategoryName, string> = {
  finance: "Finance",
  game: "Game",
  governance: "Governance",
  identity: "Identity",
  oracle: "Oracle",
  social: "Social",
  tool: "Tool",
  nft: "NFT",
};

/** Foreground glyph for each category, drawn on a 48x48 tile. */
function Glyph({ name, accent, soft }: { name: CategoryName; accent: string; soft: string }) {
  switch (name) {
    case "finance":
      // upward growth chart with coin
      return (
        <g>
          <path d="M16 32l6-7 5 4 7-9" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M30 18h6v6" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="22" cy="34" r="3.4" fill={soft} />
        </g>
      );
    case "game":
      // game controller
      return (
        <g>
          <rect x="13" y="20" width="22" height="14" rx="7" fill={soft} />
          <line x1="20" y1="27" x2="24" y2="27" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
          <line x1="22" y1="25" x2="22" y2="29" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="31" cy="25.5" r="1.9" fill={accent} />
          <circle cx="33.5" cy="29" r="1.9" fill={accent} />
        </g>
      );
    case "governance":
      // classical building / pillars
      return (
        <g>
          <path d="M24 14l11 6H13l11-6Z" fill={soft} />
          <rect x="16" y="22" width="3" height="9" rx="1.5" fill={accent} />
          <rect x="22.5" y="22" width="3" height="9" rx="1.5" fill={accent} />
          <rect x="29" y="22" width="3" height="9" rx="1.5" fill={accent} />
          <rect x="13" y="32" width="22" height="3" rx="1.5" fill={accent} />
        </g>
      );
    case "identity":
      // ID badge with person
      return (
        <g>
          <rect x="14" y="15" width="20" height="18" rx="5" fill={soft} />
          <circle cx="24" cy="22" r="3.4" fill={accent} />
          <path d="M18.5 30c1.2-3 9.8-3 11 0" stroke={accent} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </g>
      );
    case "oracle":
      // eye / crystal of insight
      return (
        <g>
          <path d="M12 24c4-6 20-6 24 0-4 6-20 6-24 0Z" fill={soft} />
          <circle cx="24" cy="24" r="4.6" fill={accent} />
          <circle cx="24" cy="24" r="2" fill="#1E1E2E" fillOpacity="0.55" />
        </g>
      );
    case "social":
      // two chat bubbles
      return (
        <g>
          <path d="M14 17h13a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-4 3v-3a3 3 0 0 1-2-2.8V20a3 3 0 0 1 3-3Z" fill={soft} />
          <circle cx="19" cy="23" r="1.6" fill={accent} />
          <circle cx="24" cy="23" r="1.6" fill={accent} />
          <path d="M30 21h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2l-3-2" fill={accent} fillOpacity="0.85" />
        </g>
      );
    case "tool":
      // wrench + gear hint
      return (
        <g>
          <path
            d="M30.5 16a5.5 5.5 0 0 0-6.8 7l-8.4 8.4a2.4 2.4 0 0 0 3.4 3.4l8.4-8.4a5.5 5.5 0 0 0 7-6.8l-3.3 3.3-3-0.8-0.8-3 3.5-3.1Z"
            fill={soft}
          />
          <circle cx="17.5" cy="32.5" r="1.6" fill={accent} />
        </g>
      );
    case "nft":
      // framed image / picture
      return (
        <g>
          <rect x="14" y="15" width="20" height="18" rx="4" fill={soft} />
          <circle cx="20" cy="21" r="2.4" fill={accent} />
          <path d="M16 31l5-6 4 4 3-3 4 5H16Z" fill={accent} />
        </g>
      );
    default:
      return null;
  }
}

/**
 * CategoryIcon — duotone gradient icons for common miniapp categories.
 * Each renders a rounded gradient tile with a soft white/pastel glyph
 * (finance, game, governance, identity, oracle, social, tool, nft).
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  size = 48,
  title,
  className,
}) => {
  const t = THEME[name];
  const uid = React.useId().replace(/:/g, "");
  const tileGrad = `ci-tile-${uid}`;
  const tileSheen = `ci-sheen-${uid}`;
  const label = title ?? LABELS[name];

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={tileGrad} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
        <radialGradient id={tileSheen} cx="0.3" cy="0.22" r="0.7">
          <stop stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="13" fill={`url(#${tileGrad})`} />
      <rect x="4" y="4" width="40" height="40" rx="13" fill={`url(#${tileSheen})`} />
      <rect x="4.75" y="4.75" width="38.5" height="38.5" rx="12.25" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.5" />
      <Glyph name={name} accent={t.accent} soft={t.soft} />
    </svg>
  );
};

export default CategoryIcon;
