import React from "react";

export interface StatusArtProps {
  /** Width/height in px (square). */
  size?: number;
  /** Accessible label / SVG <title>. */
  title?: string;
  className?: string;
}

/**
 * SuccessArt — a small celebratory figure: a soft green badge with a check,
 * a happy mascot face and confetti. Original inline SVG with gradient depth.
 */
export const SuccessArt: React.FC<StatusArtProps> = ({
  size = 128,
  title = "Success",
  className,
}) => {
  const uid = React.useId().replace(/:/g, "");
  const badge = `sa-badge-${uid}`;
  const body = `sa-body-${uid}`;
  const sheen = `sa-sheen-${uid}`;
  const shadowId = `sa-shadow-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={badge} x1="36" y1="34" x2="92" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4BE2A6" />
          <stop offset="1" stopColor="#16C784" />
        </linearGradient>
        <linearGradient id={body} x1="44" y1="40" x2="84" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9F8F0" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.35" cy="0.3" r="0.55">
          <stop stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#1E1E2E" stopOpacity="0.18" />
          <stop offset="1" stopColor="#1E1E2E" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="64" cy="116" rx="38" ry="8" fill={`url(#${shadowId})`} />

      {/* confetti */}
      <rect x="22" y="30" width="7" height="7" rx="2" fill="#7B61FF" transform="rotate(20 22 30)" />
      <rect x="98" y="26" width="7" height="7" rx="2" fill="#FFC773" transform="rotate(-15 98 26)" />
      <circle cx="104" cy="64" r="3.5" fill="#16C784" />
      <circle cx="20" cy="62" r="3.5" fill="#FF8E6E" />
      <path d="M30 92l4 4M96 96l4-4" stroke="#7B61FF" strokeWidth="3" strokeLinecap="round" />

      {/* rounded badge */}
      <path
        d="M64 28c20 0 34 14 34 34S84 98 64 98 30 84 30 62s14-34 34-34Z"
        fill={`url(#${badge})`}
        stroke="#0FB174"
        strokeWidth="2"
      />
      {/* inner light face */}
      <circle cx="64" cy="63" r="25" fill={`url(#${body})`} />
      <ellipse cx="56" cy="52" rx="9" ry="5" fill={`url(#${sheen})`} />

      {/* happy eyes */}
      <path d="M53 60c1.6-2 4.4-2 6 0" stroke="#16C784" strokeWidth="3" strokeLinecap="round" />
      <path d="M69 60c1.6-2 4.4-2 6 0" stroke="#16C784" strokeWidth="3" strokeLinecap="round" />
      {/* check / smile combo */}
      <path
        d="M55 70c3 4 15 4 18 0"
        stroke="#16C784"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* check mark badge */}
      <circle cx="92" cy="92" r="14" fill="#16C784" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M86 92l4 4 8-9" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/**
 * ErrorArt — a gentle, non-alarming error figure: a soft rose badge with a
 * worried-but-friendly mascot face and a small "!" marker. Avoids harsh
 * red blocks in favour of the Neo Soft rose pastel.
 */
export const ErrorArt: React.FC<StatusArtProps> = ({
  size = 128,
  title = "Something went wrong",
  className,
}) => {
  const uid = React.useId().replace(/:/g, "");
  const badge = `ea-badge-${uid}`;
  const body = `ea-body-${uid}`;
  const sheen = `ea-sheen-${uid}`;
  const shadowId = `ea-shadow-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={badge} x1="36" y1="34" x2="92" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC9B6" />
          <stop offset="1" stopColor="#FF8E6E" />
        </linearGradient>
        <linearGradient id={body} x1="44" y1="40" x2="84" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFF0EA" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.35" cy="0.3" r="0.55">
          <stop stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#1E1E2E" stopOpacity="0.18" />
          <stop offset="1" stopColor="#1E1E2E" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="64" cy="116" rx="38" ry="8" fill={`url(#${shadowId})`} />

      {/* faint sweat / motion dots */}
      <circle cx="100" cy="44" r="3.2" fill="#FFC773" />
      <circle cx="26" cy="50" r="3" fill="#7B61FF" fillOpacity="0.5" />

      {/* rounded badge */}
      <path
        d="M64 28c20 0 34 14 34 34S84 98 64 98 30 84 30 62s14-34 34-34Z"
        fill={`url(#${badge})`}
        stroke="#F0744F"
        strokeWidth="2"
      />
      {/* inner light face */}
      <circle cx="64" cy="63" r="25" fill={`url(#${body})`} />
      <ellipse cx="56" cy="52" rx="9" ry="5" fill={`url(#${sheen})`} />

      {/* worried eyes (slightly raised inner brows) */}
      <circle cx="56" cy="60" r="3.4" fill="#F0744F" />
      <circle cx="55" cy="59" r="1" fill="#FFFFFF" />
      <circle cx="72" cy="60" r="3.4" fill="#F0744F" />
      <circle cx="71" cy="59" r="1" fill="#FFFFFF" />
      {/* small frown */}
      <path d="M57 73c3-3.5 11-3.5 14 0" stroke="#F0744F" strokeWidth="3" strokeLinecap="round" />

      {/* "!" marker badge */}
      <circle cx="92" cy="92" r="14" fill="#F0744F" stroke="#FFFFFF" strokeWidth="3" />
      <line x1="92" y1="86" x2="92" y2="93" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="92" cy="98" r="1.9" fill="#FFFFFF" />
    </svg>
  );
};

export default SuccessArt;
