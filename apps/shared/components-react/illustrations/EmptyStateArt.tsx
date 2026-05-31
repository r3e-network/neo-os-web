import React from "react";

export interface EmptyStateArtProps {
  /** Width in px. Height scales to the 200x160 aspect ratio. */
  size?: number;
  /** Accessible label / SVG <title>. */
  title?: string;
  className?: string;
}

/**
 * EmptyStateArt — a gentle "nothing here yet" scene: the Neo mascot peeking
 * over an empty card with a couple of floating soft coins. Original inline SVG
 * with gradient depth and soft shadows.
 */
export const EmptyStateArt: React.FC<EmptyStateArtProps> = ({
  size = 220,
  title = "Nothing here yet",
  className,
}) => {
  const uid = React.useId().replace(/:/g, "");
  const card = `esa-card-${uid}`;
  const body = `esa-body-${uid}`;
  const panel = `esa-panel-${uid}`;
  const coin = `esa-coin-${uid}`;
  const coin2 = `esa-coin2-${uid}`;
  const sheen = `esa-sheen-${uid}`;
  const shadowId = `esa-shadow-${uid}`;
  const height = Math.round((size * 160) / 200);

  return (
    <svg
      className={className}
      width={size}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={card} x1="40" y1="70" x2="160" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEF0F8" />
        </linearGradient>
        <linearGradient id={body} x1="74" y1="22" x2="126" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9ECF6" />
        </linearGradient>
        <linearGradient id={panel} x1="80" y1="42" x2="120" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A2A3E" />
          <stop offset="1" stopColor="#1E1E2E" />
        </linearGradient>
        <linearGradient id={coin} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#4BE2A6" />
          <stop offset="1" stopColor="#16C784" />
        </linearGradient>
        <linearGradient id={coin2} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#A795FF" />
          <stop offset="1" stopColor="#7B61FF" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.35" cy="0.3" r="0.55">
          <stop stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#1E1E2E" stopOpacity="0.16" />
          <stop offset="1" stopColor="#1E1E2E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="100" cy="146" rx="68" ry="10" fill={`url(#${shadowId})`} />

      {/* floating coins */}
      <g>
        <ellipse cx="44" cy="60" rx="16" ry="15.5" fill="#0FB174" />
        <circle cx="44" cy="56" r="16" fill={`url(#${coin})`} stroke="#0FB174" strokeWidth="1.5" />
        <path d="M38 49v14M38 49l12 14M50 49v14" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <ellipse cx="160" cy="46" rx="12" ry="11.5" fill="#5E45E0" />
        <circle cx="160" cy="42" r="12" fill={`url(#${coin2})`} stroke="#5E45E0" strokeWidth="1.5" />
        <circle cx="160" cy="42" r="4.5" stroke="#FFFFFF" strokeWidth="2.4" fillOpacity="0" />
      </g>

      {/* empty card */}
      <rect x="40" y="78" width="120" height="64" rx="18" fill={`url(#${card})`} stroke="#E2E5F1" strokeWidth="2" />
      {/* dashed "empty" placeholder lines */}
      <line x1="64" y1="116" x2="136" y2="116" stroke="#D7DBEA" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />
      <line x1="76" y1="128" x2="124" y2="128" stroke="#E3E6F1" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />

      {/* mascot peeking over the card */}
      <g>
        <line x1="100" y1="26" x2="100" y2="16" stroke="#D3D8EB" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="100" cy="13" r="5" fill="#16C784" />
        <path
          d="M100 24c20 0 33 14 33 33v8H67v-8c0-19 13-33 33-33Z"
          fill={`url(#${body})`}
          stroke="#D3D8EB"
          strokeWidth="2"
        />
        {/* face panel */}
        <rect x="78" y="44" width="44" height="34" rx="15" fill={`url(#${panel})`} />
        <circle cx="91" cy="60" r="3.6" fill="#16C784" />
        <circle cx="89.8" cy="58.8" r="1.1" fill="#FFFFFF" />
        <circle cx="109" cy="60" r="3.6" fill="#16C784" />
        <circle cx="107.8" cy="58.8" r="1.1" fill="#FFFFFF" />
        <path d="M93 69c2.5 2.4 8.5 2.4 11 0" stroke="#16C784" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="92" cy="36" rx="9" ry="5" fill={`url(#${sheen})`} />
        {/* little hands gripping card edge */}
        <circle cx="70" cy="80" r="6" fill="#E9ECF6" stroke="#D3D8EB" strokeWidth="1.5" />
        <circle cx="130" cy="80" r="6" fill="#E9ECF6" stroke="#D3D8EB" strokeWidth="1.5" />
      </g>
    </svg>
  );
};

export default EmptyStateArt;
