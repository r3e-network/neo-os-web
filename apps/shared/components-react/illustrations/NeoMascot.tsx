import React from "react";

export type NeoMascotVariant = "default" | "brand" | "violet";

export interface NeoMascotProps {
  /** Color theme of the mascot body. */
  variant?: NeoMascotVariant;
  /** Width/height in px (square). */
  size?: number;
  /** Accessible label / SVG <title>. */
  title?: string;
  className?: string;
}

interface MascotPalette {
  bodyTop: string;
  bodyBottom: string;
  bodyEdge: string;
  panelTop: string;
  panelBottom: string;
  glow: string;
  antenna: string;
}

const PALETTES: Record<NeoMascotVariant, MascotPalette> = {
  default: {
    bodyTop: "#FFFFFF",
    bodyBottom: "#E9ECF6",
    bodyEdge: "#D3D8EB",
    panelTop: "#2A2A3E",
    panelBottom: "#1E1E2E",
    glow: "#16C784",
    antenna: "#16C784",
  },
  brand: {
    bodyTop: "#4BE2A6",
    bodyBottom: "#16C784",
    bodyEdge: "#0FB174",
    panelTop: "#15243A",
    panelBottom: "#0E1A2C",
    glow: "#BFF6E1",
    antenna: "#FFFFFF",
  },
  violet: {
    bodyTop: "#A795FF",
    bodyBottom: "#7B61FF",
    bodyEdge: "#5E45E0",
    panelTop: "#231C45",
    panelBottom: "#171234",
    glow: "#E0E2FF",
    antenna: "#FFFFFF",
  },
};

/**
 * NeoMascot — the friendly rounded robot/orb brand character.
 * An original inline SVG with gradient depth, soft highlights and a glowing
 * face panel. Three color variants: default (white shell), brand (green),
 * violet.
 */
export const NeoMascot: React.FC<NeoMascotProps> = ({
  variant = "default",
  size = 160,
  title = "Neo mascot",
  className,
}) => {
  const p = PALETTES[variant];
  const uid = React.useId().replace(/:/g, "");
  const bodyGrad = `nm-body-${uid}`;
  const panelGrad = `nm-panel-${uid}`;
  const cheekGrad = `nm-cheek-${uid}`;
  const eyeGlow = `nm-eye-${uid}`;
  const shadowId = `nm-shadow-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={bodyGrad} x1="40" y1="28" x2="120" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor={p.bodyTop} />
          <stop offset="1" stopColor={p.bodyBottom} />
        </linearGradient>
        <linearGradient id={panelGrad} x1="52" y1="58" x2="108" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor={p.panelTop} />
          <stop offset="1" stopColor={p.panelBottom} />
        </linearGradient>
        <radialGradient id={cheekGrad} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#FFB59E" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFB59E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={eyeGlow} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor={p.glow} />
          <stop offset="1" stopColor={p.glow} stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#1E1E2E" stopOpacity="0.18" />
          <stop offset="1" stopColor="#1E1E2E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="80" cy="142" rx="44" ry="9" fill={`url(#${shadowId})`} />

      {/* antenna */}
      <line x1="80" y1="30" x2="80" y2="16" stroke={p.bodyEdge} strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="13" r="6" fill={p.antenna} />
      <circle cx="78" cy="11" r="2" fill="#FFFFFF" fillOpacity="0.7" />

      {/* head/body shell */}
      <path
        d="M80 28c30 0 50 21 50 50 0 28-20 46-50 46s-50-18-50-46c0-29 20-50 50-50Z"
        fill={`url(#${bodyGrad})`}
        stroke={p.bodyEdge}
        strokeWidth="2"
      />
      {/* top highlight */}
      <path
        d="M52 46c8-9 18-13 28-13s20 4 28 13c-7-2-17-4-28-4s-21 2-28 4Z"
        fill="#FFFFFF"
        fillOpacity="0.45"
      />

      {/* face panel */}
      <rect x="48" y="58" width="64" height="50" rx="22" fill={`url(#${panelGrad})`} />
      <rect x="48" y="58" width="64" height="50" rx="22" stroke="#000000" strokeOpacity="0.15" strokeWidth="1.5" />

      {/* eyes */}
      <circle cx="68" cy="82" r="9" fill={`url(#${eyeGlow})`} />
      <circle cx="68" cy="82" r="5" fill={p.glow} />
      <circle cx="66.4" cy="80.2" r="1.7" fill="#FFFFFF" />
      <circle cx="92" cy="82" r="9" fill={`url(#${eyeGlow})`} />
      <circle cx="92" cy="82" r="5" fill={p.glow} />
      <circle cx="90.4" cy="80.2" r="1.7" fill="#FFFFFF" />

      {/* smile */}
      <path d="M72 95c4 4 12 4 16 0" stroke={p.glow} strokeWidth="3" strokeLinecap="round" />

      {/* cheeks */}
      <ellipse cx="56" cy="93" rx="6" ry="4" fill={`url(#${cheekGrad})`} />
      <ellipse cx="104" cy="93" rx="6" ry="4" fill={`url(#${cheekGrad})`} />

      {/* side ears */}
      <rect x="24" y="74" width="10" height="22" rx="5" fill={p.bodyBottom} stroke={p.bodyEdge} strokeWidth="1.5" />
      <rect x="126" y="74" width="10" height="22" rx="5" fill={p.bodyBottom} stroke={p.bodyEdge} strokeWidth="1.5" />
    </svg>
  );
};

export default NeoMascot;
