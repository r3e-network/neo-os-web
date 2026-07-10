/**
 * KindChip.tsx — original 2D chip art for the DOM tray strip.
 *
 * Each of the 12 item kinds gets a hand-drawn SVG silhouette that echoes its
 * 3D primitive-geometry model (scenes/models.ts): same body color, same
 * accent palette (leaf green, cream stalks, brown stems). These are OUR OWN
 * primitive-shape drawings — they replace the previous unicode-emoji icons so
 * no emoji ships in rendered UI, and they stay in the tiny entry chunk (no
 * three.js import; the 3D scene stays code-split).
 */

import type { ReactElement } from "react";
import type { ModelKind } from "./logic/engine-zhuada";

// Accent palette mirrored from scenes/models.ts.
const GREEN = "#3fa34d";
const GREEN_DARK = "#2f7d3a";
const CREAM = "#fdf6e3";
const BROWN = "#7c4a23";
const WHITE = "#f7f7f2";
const BLACK = "#20242a";

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Silhouette builders — 24×24 viewBox, body fill = the kind's model color. */
const SHAPES: Record<ModelKind, (fill: string) => ReactElement> = {
  tomato: (fill) => (
    <>
      <circle cx="12" cy="13.5" r="8" fill={fill} />
      <path d="M12 3.5 L13.6 7.2 L17 6.4 L14.4 8.8 L12 7.6 L9.6 8.8 L7 6.4 L10.4 7.2 Z" fill={GREEN} />
    </>
  ),
  carrot: (fill) => (
    <>
      <path d="M12 22 L7.6 8.5 Q12 6 16.4 8.5 Z" fill={fill} />
      <path d="M9.5 7.5 L7.5 2.5 L10.5 6.5 L12 2 L13.5 6.5 L16.5 2.5 L14.5 7.5 Z" fill={GREEN} />
    </>
  ),
  corn: (fill) => (
    <>
      <rect x="8.4" y="3" width="7.2" height="14" rx="3.6" fill={fill} />
      <path d="M6.5 21.5 Q7 14 10 12.5 Q10.5 18 8.9 21.5 Z" fill={GREEN} />
      <path d="M17.5 21.5 Q17 14 14 12.5 Q13.5 18 15.1 21.5 Z" fill={GREEN} />
      <path d="M12 22 Q10.8 17 12 13.5 Q13.2 17 12 22 Z" fill={GREEN_DARK} />
    </>
  ),
  eggplant: (fill) => (
    <>
      <ellipse cx="12" cy="14" rx="6.4" ry="8" fill={fill} />
      <path d="M12 2.5 L14.8 7.6 L9.2 7.6 Z" fill={GREEN_DARK} />
      <path d="M8 6.2 L12 4.6 L16 6.2 L12 8.4 Z" fill={GREEN} />
    </>
  ),
  apple: (fill) => (
    <>
      <circle cx="12" cy="14" r="7.6" fill={fill} />
      <rect x="11.3" y="3.4" width="1.6" height="4.4" rx="0.8" fill={BROWN} />
      <ellipse cx="15.4" cy="5.6" rx="2.8" ry="1.4" fill={GREEN} transform="rotate(-24 15.4 5.6)" />
    </>
  ),
  broccoli: (fill) => (
    <>
      <rect x="10.4" y="13" width="3.2" height="8" rx="1.4" fill={CREAM} />
      <circle cx="8" cy="9.5" r="4.2" fill={fill} />
      <circle cx="16" cy="9.5" r="4.2" fill={fill} />
      <circle cx="12" cy="6.5" r="4.6" fill={fill} />
      <circle cx="12" cy="11" r="4" fill={fill} />
    </>
  ),
  mushroom: (fill) => (
    <>
      <rect x="9.4" y="11" width="5.2" height="9.5" rx="2.4" fill={CREAM} />
      <path d="M2.8 12 Q3 4.2 12 4.2 Q21 4.2 21.2 12 Q16 13.6 12 13.6 Q8 13.6 2.8 12 Z" fill={fill} />
      <circle cx="8" cy="8.6" r="1.3" fill={WHITE} />
      <circle cx="14.6" cy="7.2" r="1.5" fill={WHITE} />
      <circle cx="17.6" cy="10.2" r="1.1" fill={WHITE} />
    </>
  ),
  onion: (fill) => (
    <>
      <path d="M12 5 Q19 9 19 14.5 Q19 20.5 12 20.5 Q5 20.5 5 14.5 Q5 9 12 5 Z" fill={fill} />
      <path d="M11.2 5.8 L10 2 L12 4 L14 2 L12.8 5.8 Z" fill={GREEN} />
    </>
  ),
  pepper: (fill) => (
    <>
      <path d="M10 6.5 Q16.5 6 17.5 12 Q18.5 18.5 12.5 21 Q7 18.5 8.5 12 Q9 8.5 10 6.5 Z" fill={fill} />
      <path d="M11.5 6.8 Q11 3.6 13.6 2.6 Q13.4 5.4 13.2 6.8 Z" fill={GREEN_DARK} />
    </>
  ),
  melon: (fill) => (
    <>
      <circle cx="12" cy="12" r="9" fill={fill} />
      <path d="M7 3.8 Q5.4 12 7 20.2 Q8.6 12 7 3.8 Z" fill={GREEN_DARK} />
      <path d="M12 3 Q10.4 12 12 21 Q13.6 12 12 3 Z" fill={GREEN_DARK} />
      <path d="M17 3.8 Q15.4 12 17 20.2 Q18.6 12 17 3.8 Z" fill={GREEN_DARK} />
    </>
  ),
  egg: (fill) => (
    <ellipse cx="12" cy="13" rx="6.6" ry="8.4" fill={fill} />
  ),
  fish: (fill) => (
    <>
      <ellipse cx="10.5" cy="12" rx="7.5" ry="4.8" fill={fill} />
      <path d="M16.5 12 L22 7.5 L20.4 12 L22 16.5 Z" fill={fill} />
      <path d="M9.5 7.6 L11.5 4.6 L13 7.8 Z" fill={fill} />
      <circle cx="6.6" cy="10.8" r="1.5" fill={WHITE} />
      <circle cx="6.2" cy="10.8" r="0.75" fill={BLACK} />
    </>
  ),
};

export interface KindChipProps {
  model: ModelKind;
  /** Hex color number from ITEM_DEFS (the 3D body color). */
  color: number;
  size?: number;
}

/** Colored silhouette chip for one item kind (decorative; label the parent). */
export function KindChip({ model, color, size = 22 }: KindChipProps) {
  const draw = SHAPES[model] ?? SHAPES.tomato;
  return (
    <svg
      className="goose-tray__chip"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {draw(colorToCss(color))}
    </svg>
  );
}

export default KindChip;
