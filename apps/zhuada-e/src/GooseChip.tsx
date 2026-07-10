/**
 * GooseChip.tsx — original 2D goose art for the collection book + level map.
 *
 * A hand-drawn SVG side profile of OUR primitive goose (scenes/models.ts
 * buildGoose): round body, S-neck, orange beak — dressed per scene in the
 * limited-edition scarf + hat described by the same GooseVariant spec the 3D
 * model consumes, so 2D and 3D stay one design. Locked geese render as a
 * neutral silhouette (the shape teases, the outfit stays hidden). No emoji,
 * no downloaded art — everything here is drawn in this file.
 */

import type { ReactElement } from "react";
import type { GooseHat, GooseVariant } from "./logic/scenes";
import { colorToCss } from "./KindChip";

const BEAK = "#f59e0b";
const EYE = "#20242a";
const LOCKED_BODY = "#b9bcc4";
const LOCKED_SHADE = "#a2a6b0";

/** Hat overlays drawn above the head (head center ≈ (21, 9.5), r≈4.6). */
const HATS: Record<GooseHat, (color: string, accent: string) => ReactElement> = {
  straw: (color, accent) => (
    <>
      <ellipse cx="21" cy="5.4" rx="7.2" ry="1.6" fill={color} />
      <path d="M17.4 5.4 Q17.6 1.6 21 1.6 Q24.4 1.6 24.6 5.4 Z" fill={color} />
      <rect x="17.5" y="4" width="7" height="1.5" rx="0.7" fill={accent} />
    </>
  ),
  beret: (color, accent) => (
    <>
      <path d="M15.8 6 Q16.4 1.4 21.4 1.9 Q26 2.4 25.8 5.6 Q21 4.2 15.8 6 Z" fill={color} />
      <rect x="20.6" y="0.6" width="1.4" height="1.8" rx="0.7" fill={accent} />
    </>
  ),
  cap: (color, accent) => (
    <>
      <path d="M16.6 5.8 Q17 1.8 21 1.8 Q25 1.8 25.4 5.8 Z" fill={color} />
      <rect x="16.6" y="5" width="8.8" height="1.4" rx="0.7" fill={accent} />
      <path d="M24.6 5.2 L29.4 5.6 L29 7 L24.6 6.6 Z" fill={accent} />
    </>
  ),
  beanie: (color, accent) => (
    <>
      <path d="M16.8 6 Q17 1.8 21 1.8 Q25 1.8 25.2 6 Z" fill={color} />
      <rect x="16.5" y="5" width="9" height="1.8" rx="0.9" fill={accent} />
      <circle cx="21" cy="1.4" r="1.3" fill={accent} />
    </>
  ),
  party: (color, accent) => (
    <>
      <path d="M21 0.6 L24.4 6.2 L17.6 6.2 Z" fill={color} />
      <rect x="17.3" y="5.6" width="7.4" height="1.2" rx="0.6" fill={accent} />
      <circle cx="21" cy="0.9" r="1.1" fill={accent} />
    </>
  ),
};

export interface GooseChipProps {
  variant: GooseVariant;
  /** Locked geese draw as a neutral silhouette with no outfit. */
  locked?: boolean;
  size?: number;
}

/** Collection chip for one limited-edition goose (decorative; label parent). */
export function GooseChip({ variant, locked = false, size = 44 }: GooseChipProps) {
  const body = locked ? LOCKED_BODY : colorToCss(variant.body);
  const shade = locked ? LOCKED_SHADE : colorToCss(variant.body);
  return (
    <svg
      className="goose-collection__chip"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      {/* body + tail */}
      <ellipse cx="13" cy="21.5" rx="10.5" ry="7.5" fill={body} />
      <path d="M3.4 18.4 L0.6 15.6 L4.6 16.4 Z" fill={shade} />
      {/* neck + head */}
      <path d="M16.6 16.5 Q17.6 11 19 9.5 L23.4 11.5 Q21.6 14.5 21.4 18.5 Z" fill={body} />
      <circle cx="21" cy="9.5" r="4.6" fill={body} />
      {/* beak + eye */}
      <path d="M25 8.2 L30.4 9.6 L25.2 11.4 Z" fill={locked ? LOCKED_SHADE : BEAK} />
      <circle cx="22.6" cy="8.4" r="0.95" fill={locked ? "#6d7078" : EYE} />
      {/* wing */}
      <ellipse cx="11" cy="21" rx="5.4" ry="3.4" fill={shade} opacity={locked ? 0.55 : 0.35} />
      {!locked && (
        <>
          {/* scarf at the neck base */}
          <path
            d="M16.9 15.6 Q19.2 16.8 21.5 15.9 L21.3 18.4 Q19 19.3 16.7 18.2 Z"
            fill={colorToCss(variant.scarf)}
          />
          {HATS[variant.hat](colorToCss(variant.hatColor), colorToCss(variant.hatAccent))}
        </>
      )}
    </svg>
  );
}

export default GooseChip;
