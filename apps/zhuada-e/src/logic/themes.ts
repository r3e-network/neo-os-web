/**
 * Player-selectable art directions for Goose Basket Shuffle.
 *
 * A theme is a complete presentation contract, not a color filter: it owns the
 * scene backdrop, container treatment, object catalog, UI tokens and ambience.
 * Logical kind ids remain 0..53 so the deterministic matching engine is shared
 * across every theme. Kinds 0..17 own original geometry/icon recipes; the two
 * following 18-kind banks are deliberate same-silhouette, different-colour
 * match identities. Every authored silhouette therefore has three separately
 * matchable treatments, making observation—not broad shape recognition—the
 * core challenge.
 */
import type { GeometryKind } from "./engine-zhuada";
import { gameStorage } from "./game-storage";
import { publicAssetUrl } from "./public-asset-url";

export type GameThemeId = "fresh-market" | "farm-kitchen" | "night-market";
export type ContainerStyle = "wicker-basket" | "wood-crate" | "round-bamboo";
export type ItemSizeBand = "small" | "medium" | "large";
export type ItemSilhouette = "round" | "tall" | "long" | "flat" | "wide" | "boxy" | "tapered" | "irregular";

export interface ThemeItem {
  nameKey: string;
  color: number;
  geometry: GeometryKind;
  /**
   * Deal-composition metadata. This is intentionally presentation-facing:
   * the physics profile still owns exact scale/collider values, while these
   * broad bands let the rules engine guarantee a readable mix of big/small,
   * long/round/flat objects instead of hoping a random slice looks varied.
   */
  sizeBand: ItemSizeBand;
  silhouette: ItemSilhouette;
  /** Related silhouettes with deliberately different colours for near-match play. */
  lookalikeFamily: string;
  /**
   * Deliberate colour-variant identity. Variants keep the authored geometry
   * recipe and material detail, but receive a full-body palette treatment and
   * a distinct physical size so they do not read as the same object.
   */
  modelKind?: number;
  assetKind?: number;
  variantIndex?: 1 | 2;
  chipHueDeg?: number;
}

export interface GameTheme {
  id: GameThemeId;
  nameKey: string;
  descriptionKey: string;
  backdrop: string;
  mascot: string;
  container: ContainerStyle;
  ambience: "garden" | "kitchen" | "night";
  css: {
    page: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    muted: string;
    accent: string;
    accentStrong: string;
    accentSoft: string;
    border: string;
    shadow: string;
  };
  scene: {
    floor: number;
    wall: number;
    rim: number;
    hemiGround: number;
    keyLight: number;
    clearAlpha: number;
  };
  items: readonly ThemeItem[];
}

function colorVariant(
  bases: readonly ThemeItem[],
  baseKind: number,
  color: number,
  _chipHueDeg: number,
  variantIndex: 1 | 2 = 1,
): ThemeItem {
  const base = bases[baseKind]!;
  const resolvedColor = ensureVariantContrast(base.color, color, baseKind, variantIndex);
  return {
    ...base,
    color: resolvedColor,
    modelKind: baseKind,
    assetKind: baseKind,
    variantIndex,
    // Variant sprites are already hue-treated during art generation; a second
    // CSS rotation would make the tray material drift from the 3D object.
    chipHueDeg: 0,
  };
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

function hslOf(color: number): HslColor {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d < 0.0001) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

function colorFromHsl({ h, s, l }: HslColor): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60
    ? [c, x, 0]
    : h < 120
      ? [x, c, 0]
      : h < 180
        ? [0, c, x]
        : h < 240
          ? [0, x, c]
          : h < 300
            ? [x, 0, c]
            : [c, 0, x];
  return (Math.round((r + m) * 255) << 16)
    | (Math.round((g + m) * 255) << 8)
    | Math.round((b + m) * 255);
}

function rgbDistance(left: number, right: number): number {
  return Math.hypot(
    ((left >> 16) & 0xff) - ((right >> 16) & 0xff),
    ((left >> 8) & 0xff) - ((right >> 8) & 0xff),
    (left & 0xff) - (right & 0xff),
  );
}

function hueDistanceDegrees(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

interface VariantTreatment {
  h: number;
  s: number;
  l: number;
}

/**
 * Give every silhouette family its own three-colour material story.
 *
 * A fixed +/- hue shift made unrelated objects collapse into the same purple
 * and mint blocks in a randomly selected opening. A golden-angle anchor spreads
 * families around the wheel; choosing from three 120-degree candidates keeps
 * both variants far from the base and from each other. The treatment still
 * recolours the whole authored body rather than painting identity marks.
 */
function variantTreatment(base: HslColor, baseKind: number, variantIndex: 1 | 2): VariantTreatment {
  const anchor = (baseKind * 137.508 + 24) % 360;
  const firstHue = hueDistanceDegrees(anchor, base.h) < 75
    ? (anchor + 180) % 360
    : anchor;
  const secondCandidates = [(firstHue + 120) % 360, (firstHue + 240) % 360];
  const secondHue = secondCandidates.reduce((best, candidate) => (
    hueDistanceDegrees(candidate, base.h) > hueDistanceDegrees(best, base.h)
      ? candidate
      : best
  ));
  return variantIndex === 1
    ? {
        h: firstHue,
        s: 0.68 + (baseKind % 3) * 0.05,
        l: base.l > 0.68 ? 0.5 : 0.59,
      }
    : {
        h: secondHue,
        s: 0.66 + ((baseKind + 1) % 3) * 0.05,
        l: base.l > 0.68 ? 0.43 : 0.54,
      };
}

/** Keep near-match variants readable: shape may repeat, the colour block may not. */
function ensureVariantContrast(
  base: number,
  _proposed: number,
  baseKind: number,
  variantIndex: 1 | 2,
): number {
  const baseHsl = hslOf(base);
  const treatment = variantTreatment(baseHsl, baseKind, variantIndex);
  let resolved = colorFromHsl(treatment);
  if (rgbDistance(base, resolved) < 96) {
    resolved = colorFromHsl({
      h: (treatment.h + 120) % 360,
      s: 0.72,
      l: variantIndex === 1 ? 0.56 : 0.5,
    });
  }
  return resolved;
}

const freshBaseItems: readonly ThemeItem[] = [
  { nameKey: "freshApple", color: 0x84a83b, geometry: "sphere", sizeBand: "large", silhouette: "round", lookalikeFamily: "round-fruit" },
  { nameKey: "freshOrange", color: 0xf28c28, geometry: "sphere", sizeBand: "small", silhouette: "round", lookalikeFamily: "round-fruit" },
  { nameKey: "freshLemon", color: 0xf4d447, geometry: "sphere", sizeBand: "small", silhouette: "tapered", lookalikeFamily: "oval-fruit" },
  { nameKey: "freshMushroom", color: 0xb98262, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "stemmed-produce" },
  { nameKey: "freshBaguette", color: 0xd99145, geometry: "cylinder", sizeBand: "large", silhouette: "long", lookalikeFamily: "long-food" },
  { nameKey: "freshCup", color: 0xf3ead9, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "counter-vessel" },
  { nameKey: "freshTeaTin", color: 0x698b55, geometry: "box", sizeBand: "small", silhouette: "boxy", lookalikeFamily: "boxed-goods" },
  { nameKey: "freshBoat", color: 0x327da0, geometry: "box", sizeBand: "medium", silhouette: "wide", lookalikeFamily: "long-object" },
  { nameKey: "freshCandy", color: 0xe99aac, geometry: "sphere", sizeBand: "small", silhouette: "long", lookalikeFamily: "wrapped-snack" },
  { nameKey: "freshPear", color: 0xa6bd45, geometry: "sphere", sizeBand: "large", silhouette: "round", lookalikeFamily: "oval-fruit" },
  { nameKey: "freshDonut", color: 0xd49a6a, geometry: "torus", sizeBand: "medium", silhouette: "flat", lookalikeFamily: "round-snack" },
  { nameKey: "freshEgg", color: 0xf4efe4, geometry: "cylinder", sizeBand: "small", silhouette: "tapered", lookalikeFamily: "oval-fruit" },
  { nameKey: "freshStrawberry", color: 0xd94c52, geometry: "sphere", sizeBand: "small", silhouette: "tapered", lookalikeFamily: "round-fruit" },
  { nameKey: "freshWatermelon", color: 0x63a55b, geometry: "cylinder", sizeBand: "large", silhouette: "long", lookalikeFamily: "long-food" },
  { nameKey: "freshHoney", color: 0xe5a72f, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "counter-vessel" },
  { nameKey: "freshCheese", color: 0xf2c84b, geometry: "box", sizeBand: "large", silhouette: "irregular", lookalikeFamily: "wedge-food" },
  { nameKey: "freshFlowerPot", color: 0xc86f4a, geometry: "cylinder", sizeBand: "medium", silhouette: "tall", lookalikeFamily: "counter-vessel" },
  { nameKey: "freshJuice", color: 0xf0d78a, geometry: "box", sizeBand: "medium", silhouette: "boxy", lookalikeFamily: "boxed-goods" },
];

const freshItems: readonly ThemeItem[] = [
  ...freshBaseItems,
  colorVariant(freshBaseItems, 0, 0xd94c52, 245),
  colorVariant(freshBaseItems, 1, 0xe6675f, 322),
  colorVariant(freshBaseItems, 2, 0x78b84c, 82),
  colorVariant(freshBaseItems, 3, 0x6f8fc2, 188),
  colorVariant(freshBaseItems, 4, 0x8b5a33, 332),
  colorVariant(freshBaseItems, 5, 0xb66a8d, 302),
  colorVariant(freshBaseItems, 6, 0xb54b43, 248),
  colorVariant(freshBaseItems, 7, 0xe0ad3a, 72),
  colorVariant(freshBaseItems, 8, 0x54bca1, 128),
  colorVariant(freshBaseItems, 9, 0xc7b94a, 24),
  colorVariant(freshBaseItems, 10, 0x9f6948, 332),
  colorVariant(freshBaseItems, 11, 0xe5d8ba, 24),
  colorVariant(freshBaseItems, 12, 0xc83f4b, 348),
  colorVariant(freshBaseItems, 13, 0x467f52, 342),
  colorVariant(freshBaseItems, 14, 0xc68d24, 344),
  colorVariant(freshBaseItems, 15, 0xe3b947, 348),
  colorVariant(freshBaseItems, 16, 0xa95d42, 344),
  colorVariant(freshBaseItems, 17, 0xd6bc6d, 344),
  colorVariant(freshBaseItems, 0, 0x78963a, 12, 2),
  colorVariant(freshBaseItems, 1, 0xe77f26, 348, 2),
  colorVariant(freshBaseItems, 2, 0xe8cc3c, 12, 2),
  colorVariant(freshBaseItems, 3, 0xa87358, 12, 2),
  colorVariant(freshBaseItems, 4, 0xc9823f, 12, 2),
  colorVariant(freshBaseItems, 5, 0xe6dcc9, 12, 2),
  colorVariant(freshBaseItems, 6, 0x5e7b4f, 12, 2),
  colorVariant(freshBaseItems, 7, 0x2d718f, 12, 2),
  colorVariant(freshBaseItems, 8, 0xd98ca0, 12, 2),
  colorVariant(freshBaseItems, 9, 0xb6c448, 12, 2),
  colorVariant(freshBaseItems, 10, 0xbf845a, 12, 2),
  colorVariant(freshBaseItems, 11, 0xece4d6, 12, 2),
  colorVariant(freshBaseItems, 12, 0xb93f48, 12, 2),
  colorVariant(freshBaseItems, 13, 0x568d50, 12, 2),
  colorVariant(freshBaseItems, 14, 0xd49a28, 12, 2),
  colorVariant(freshBaseItems, 15, 0xe8c043, 12, 2),
  colorVariant(freshBaseItems, 16, 0xb96546, 12, 2),
  colorVariant(freshBaseItems, 17, 0xe3ca79, 12, 2),
];

const farmBaseItems: readonly ThemeItem[] = [
  { nameKey: "farmKettle", color: 0xb93f33, geometry: "sphere", sizeBand: "large", silhouette: "round", lookalikeFamily: "handled-cookware" },
  { nameKey: "farmMilk", color: 0xf4f0df, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "kitchen-vessel" },
  { nameKey: "farmBowl", color: 0x74a6c7, geometry: "cylinder", sizeBand: "medium", silhouette: "wide", lookalikeFamily: "round-tableware" },
  { nameKey: "farmRoll", color: 0xc68b52, geometry: "torus", sizeBand: "small", silhouette: "round", lookalikeFamily: "round-pantry" },
  { nameKey: "farmJam", color: 0x9f2f35, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "kitchen-vessel" },
  { nameKey: "farmSpoon", color: 0xba8350, geometry: "cylinder", sizeBand: "small", silhouette: "long", lookalikeFamily: "long-utensil" },
  { nameKey: "farmPumpkin", color: 0xd7802f, geometry: "sphere", sizeBand: "large", silhouette: "round", lookalikeFamily: "round-pantry" },
  { nameKey: "farmMitt", color: 0x7a9fc4, geometry: "box", sizeBand: "medium", silhouette: "flat", lookalikeFamily: "soft-kitchen" },
  { nameKey: "farmWindmill", color: 0xc65f4f, geometry: "icosa", sizeBand: "small", silhouette: "irregular", lookalikeFamily: "farm-keepsake" },
  { nameKey: "farmJug", color: 0xf1e1bd, geometry: "cylinder", sizeBand: "medium", silhouette: "tall", lookalikeFamily: "kitchen-vessel" },
  { nameKey: "farmCookie", color: 0xc9945a, geometry: "cylinder", sizeBand: "small", silhouette: "flat", lookalikeFamily: "round-tableware" },
  { nameKey: "farmMug", color: 0x5f8dac, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "kitchen-vessel" },
  { nameKey: "farmRollingPin", color: 0xb77943, geometry: "cylinder", sizeBand: "large", silhouette: "long", lookalikeFamily: "long-utensil" },
  { nameKey: "farmPot", color: 0x4f83a2, geometry: "cylinder", sizeBand: "large", silhouette: "wide", lookalikeFamily: "handled-cookware" },
  { nameKey: "farmBread", color: 0xc9894d, geometry: "box", sizeBand: "medium", silhouette: "boxy", lookalikeFamily: "baked-block" },
  { nameKey: "farmButter", color: 0xe4d1a5, geometry: "cylinder", sizeBand: "small", silhouette: "flat", lookalikeFamily: "baked-block" },
  { nameKey: "farmRooster", color: 0xc84f3b, geometry: "icosa", sizeBand: "medium", silhouette: "irregular", lookalikeFamily: "farm-keepsake" },
  { nameKey: "farmYarn", color: 0x8d6aa8, geometry: "sphere", sizeBand: "small", silhouette: "round", lookalikeFamily: "round-pantry" },
];

const farmItems: readonly ThemeItem[] = [
  ...farmBaseItems,
  colorVariant(farmBaseItems, 0, 0xe8c78e, 44),
  colorVariant(farmBaseItems, 1, 0xe89ca8, 318),
  colorVariant(farmBaseItems, 2, 0xd66c5f, 316),
  colorVariant(farmBaseItems, 3, 0x7e4a33, 335),
  colorVariant(farmBaseItems, 4, 0x5969a8, 225),
  colorVariant(farmBaseItems, 5, 0x6d4329, 338),
  colorVariant(farmBaseItems, 6, 0x718c4c, 82),
  colorVariant(farmBaseItems, 7, 0xc45a4d, 316),
  colorVariant(farmBaseItems, 8, 0x4f87b8, 205),
  colorVariant(farmBaseItems, 9, 0xd7c89f, 24),
  colorVariant(farmBaseItems, 10, 0xb67d4f, 344),
  colorVariant(farmBaseItems, 11, 0x6f9bb8, 12),
  colorVariant(farmBaseItems, 12, 0x986238, 344),
  colorVariant(farmBaseItems, 13, 0x467896, 344),
  colorVariant(farmBaseItems, 14, 0xb67742, 344),
  colorVariant(farmBaseItems, 15, 0xd5bf92, 344),
  colorVariant(farmBaseItems, 16, 0xb74236, 348),
  colorVariant(farmBaseItems, 17, 0x795b92, 344),
  colorVariant(farmBaseItems, 0, 0xa9362f, 12, 2),
  colorVariant(farmBaseItems, 1, 0xe8e3d4, 12, 2),
  colorVariant(farmBaseItems, 2, 0x6799bb, 12, 2),
  colorVariant(farmBaseItems, 3, 0xb77b48, 12, 2),
  colorVariant(farmBaseItems, 4, 0x8e2a31, 12, 2),
  colorVariant(farmBaseItems, 5, 0xa87345, 12, 2),
  colorVariant(farmBaseItems, 6, 0xc9742b, 12, 2),
  colorVariant(farmBaseItems, 7, 0x6d91b5, 12, 2),
  colorVariant(farmBaseItems, 8, 0xb75649, 12, 2),
  colorVariant(farmBaseItems, 9, 0xe3d2ae, 12, 2),
  colorVariant(farmBaseItems, 10, 0xbd8952, 12, 2),
  colorVariant(farmBaseItems, 11, 0x547f9d, 12, 2),
  colorVariant(farmBaseItems, 12, 0xa96e3e, 12, 2),
  colorVariant(farmBaseItems, 13, 0x477995, 12, 2),
  colorVariant(farmBaseItems, 14, 0xbc7c46, 12, 2),
  colorVariant(farmBaseItems, 15, 0xd9c49a, 12, 2),
  colorVariant(farmBaseItems, 16, 0xb94738, 12, 2),
  colorVariant(farmBaseItems, 17, 0x80609a, 12, 2),
];

const nightBaseItems: readonly ThemeItem[] = [
  { nameKey: "nightLantern", color: 0xd94a32, geometry: "sphere", sizeBand: "large", silhouette: "round", lookalikeFamily: "round-festival" },
  { nameKey: "nightBun", color: 0xf1dfc5, geometry: "sphere", sizeBand: "small", silhouette: "round", lookalikeFamily: "round-festival" },
  { nameKey: "nightSoda", color: 0x76a99b, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "tall-stallware" },
  { nameKey: "nightMooncake", color: 0xc48a47, geometry: "cylinder", sizeBand: "small", silhouette: "flat", lookalikeFamily: "round-festival" },
  { nameKey: "nightTanghulu", color: 0xb72e2f, geometry: "cylinder", sizeBand: "large", silhouette: "long", lookalikeFamily: "long-street-food" },
  { nameKey: "nightDrum", color: 0xb74632, geometry: "cylinder", sizeBand: "medium", silhouette: "wide", lookalikeFamily: "round-festival" },
  { nameKey: "nightBambooCup", color: 0xb79a5b, geometry: "cylinder", sizeBand: "small", silhouette: "tall", lookalikeFamily: "tall-stallware" },
  { nameKey: "nightZongzi", color: 0x5d7e49, geometry: "cone", sizeBand: "small", silhouette: "tapered", lookalikeFamily: "tapered-charm" },
  { nameKey: "nightFishCharm", color: 0x2e8c96, geometry: "box", sizeBand: "large", silhouette: "long", lookalikeFamily: "flat-keepsake" },
  { nameKey: "nightBowl", color: 0xe8d4ba, geometry: "cylinder", sizeBand: "small", silhouette: "wide", lookalikeFamily: "round-festival" },
  { nameKey: "nightBell", color: 0xc99a3d, geometry: "cone", sizeBand: "small", silhouette: "tapered", lookalikeFamily: "tapered-charm" },
  { nameKey: "nightSnackTin", color: 0x6f4d94, geometry: "box", sizeBand: "large", silhouette: "boxy", lookalikeFamily: "flat-keepsake" },
  { nameKey: "nightTeapot", color: 0x3f8b78, geometry: "sphere", sizeBand: "medium", silhouette: "round", lookalikeFamily: "festival-figure" },
  { nameKey: "nightFan", color: 0xd84b54, geometry: "box", sizeBand: "large", silhouette: "flat", lookalikeFamily: "flat-keepsake" },
  { nameKey: "nightLuckyCat", color: 0xf2e1c2, geometry: "icosa", sizeBand: "small", silhouette: "irregular", lookalikeFamily: "festival-figure" },
  { nameKey: "nightNoodles", color: 0xe8c27a, geometry: "cylinder", sizeBand: "large", silhouette: "wide", lookalikeFamily: "round-festival" },
  { nameKey: "nightLotusLamp", color: 0xe86c87, geometry: "sphere", sizeBand: "small", silhouette: "round", lookalikeFamily: "festival-figure" },
  { nameKey: "nightMahjong", color: 0xe8e2cf, geometry: "box", sizeBand: "small", silhouette: "boxy", lookalikeFamily: "flat-keepsake" },
];

const nightItems: readonly ThemeItem[] = [
  ...nightBaseItems,
  colorVariant(nightBaseItems, 0, 0x3e77c7, 190),
  colorVariant(nightBaseItems, 1, 0xf2b0a3, 318),
  colorVariant(nightBaseItems, 2, 0xe49a45, 48),
  colorVariant(nightBaseItems, 3, 0xb65348, 332),
  colorVariant(nightBaseItems, 4, 0x8057a6, 272),
  colorVariant(nightBaseItems, 5, 0xd1a03c, 52),
  colorVariant(nightBaseItems, 6, 0x4f8e77, 122),
  colorVariant(nightBaseItems, 7, 0x6d5a93, 252),
  colorVariant(nightBaseItems, 8, 0xe0713f, 326),
  colorVariant(nightBaseItems, 9, 0xd5c1aa, 24),
  colorVariant(nightBaseItems, 10, 0xb78532, 344),
  colorVariant(nightBaseItems, 11, 0x604282, 344),
  colorVariant(nightBaseItems, 12, 0x357665, 344),
  colorVariant(nightBaseItems, 13, 0xc3424a, 344),
  colorVariant(nightBaseItems, 14, 0xe6d4b7, 344),
  colorVariant(nightBaseItems, 15, 0xd7b16d, 344),
  colorVariant(nightBaseItems, 16, 0xd85f7b, 344),
  colorVariant(nightBaseItems, 17, 0xd9d3c2, 344),
  colorVariant(nightBaseItems, 0, 0xc8402d, 12, 2),
  colorVariant(nightBaseItems, 1, 0xe7d4bb, 12, 2),
  colorVariant(nightBaseItems, 2, 0x6a9b8e, 12, 2),
  colorVariant(nightBaseItems, 3, 0xb67b40, 12, 2),
  colorVariant(nightBaseItems, 4, 0xa8292b, 12, 2),
  colorVariant(nightBaseItems, 5, 0xa83e2e, 12, 2),
  colorVariant(nightBaseItems, 6, 0xa98c52, 12, 2),
  colorVariant(nightBaseItems, 7, 0x526f42, 12, 2),
  colorVariant(nightBaseItems, 8, 0x297f88, 12, 2),
  colorVariant(nightBaseItems, 9, 0xdbc7af, 12, 2),
  colorVariant(nightBaseItems, 10, 0xba8c37, 12, 2),
  colorVariant(nightBaseItems, 11, 0x644588, 12, 2),
  colorVariant(nightBaseItems, 12, 0x397e6d, 12, 2),
  colorVariant(nightBaseItems, 13, 0xc4474d, 12, 2),
  colorVariant(nightBaseItems, 14, 0xe8d8bd, 12, 2),
  colorVariant(nightBaseItems, 15, 0xdcb974, 12, 2),
  colorVariant(nightBaseItems, 16, 0xdd6680, 12, 2),
  colorVariant(nightBaseItems, 17, 0xddd8c2, 12, 2),
];

/** 18 authored silhouettes, each with two separate near-match treatments. */
export const THEME_ITEM_COUNT = 54;
export const THEME_ITEM_ASSET_COUNT = 18;

export const GAME_THEMES: readonly GameTheme[] = [
  {
    id: "fresh-market",
    nameKey: "themeFreshName",
    descriptionKey: "themeFreshDescription",
    backdrop: publicAssetUrl("./art/theme-fresh-market.webp"),
    mascot: publicAssetUrl("./art/mascot-fresh-market.webp"),
    container: "wicker-basket",
    ambience: "garden",
    css: {
      page: "#eef2d8",
      surface: "rgba(255, 252, 244, 0.88)",
      surfaceStrong: "#fffaf0",
      text: "#342d24",
      muted: "#655e53",
      accent: "#16865f",
      accentStrong: "#0d6849",
      accentSoft: "rgba(22, 134, 95, 0.16)",
      border: "rgba(77, 99, 58, 0.22)",
      shadow: "rgba(61, 48, 31, 0.24)",
    },
    scene: {
      floor: 0x8b5a2b,
      wall: 0xb8793d,
      rim: 0xd49a57,
      hemiGround: 0xb8c98b,
      keyLight: 0xfff2d2,
      clearAlpha: 0,
    },
    items: freshItems,
  },
  {
    id: "farm-kitchen",
    nameKey: "themeFarmName",
    descriptionKey: "themeFarmDescription",
    backdrop: publicAssetUrl("./art/theme-farm-kitchen.webp"),
    mascot: publicAssetUrl("./art/mascot-farm-kitchen.webp"),
    container: "wood-crate",
    ambience: "kitchen",
    css: {
      page: "#f6e2be",
      surface: "rgba(255, 247, 230, 0.9)",
      surfaceStrong: "#fff3dc",
      text: "#452b1d",
      muted: "#735747",
      accent: "#a8472f",
      accentStrong: "#7f2f20",
      accentSoft: "rgba(168, 71, 47, 0.16)",
      border: "rgba(121, 72, 35, 0.24)",
      shadow: "rgba(83, 47, 25, 0.25)",
    },
    scene: {
      floor: 0x8f5b33,
      wall: 0x9f6539,
      rim: 0x6f4227,
      hemiGround: 0xd8b783,
      keyLight: 0xffdca5,
      clearAlpha: 0,
    },
    items: farmItems,
  },
  {
    id: "night-market",
    nameKey: "themeNightName",
    descriptionKey: "themeNightDescription",
    backdrop: publicAssetUrl("./art/theme-night-market.webp"),
    mascot: publicAssetUrl("./art/mascot-night-market.webp"),
    container: "round-bamboo",
    ambience: "night",
    css: {
      page: "#111527",
      surface: "rgba(24, 27, 43, 0.88)",
      surfaceStrong: "#1d2134",
      text: "#fff3d4",
      muted: "#c9bea9",
      accent: "#f2b640",
      accentStrong: "#ffc95c",
      accentSoft: "rgba(242, 182, 64, 0.18)",
      border: "rgba(242, 193, 78, 0.34)",
      shadow: "rgba(0, 0, 0, 0.46)",
    },
    scene: {
      floor: 0x6e4f2f,
      wall: 0x8a653c,
      rim: 0xc99a4c,
      hemiGround: 0x22283f,
      keyLight: 0xffb84d,
      clearAlpha: 0,
    },
    items: nightItems,
  },
] as const;

// The public cover and first-run hero are authored around the warm farm
// kitchen. Start new players in that same art direction so the first playable
// frame feels like a continuation of the cover instead of an unrelated skin.
// Returning players still keep their explicit saved theme preference.
export const DEFAULT_THEME_ID: GameThemeId = "farm-kitchen";
export const THEME_STORAGE_KEY = "zhuada-e:theme";

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function isGameThemeId(value: unknown): value is GameThemeId {
  return GAME_THEMES.some((theme) => theme.id === value);
}

export function themeOf(id: unknown): GameTheme {
  return GAME_THEMES.find((theme) => theme.id === id)
    ?? GAME_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)
    ?? GAME_THEMES[0]!;
}

export function themeItem(themeId: unknown, kind: number): ThemeItem {
  const theme = themeOf(themeId);
  return theme.items[kind] ?? theme.items[0]!;
}

export function loadThemePref(): GameThemeId {
  try {
    const stored = gameStorage.getItem(THEME_STORAGE_KEY);
    return isGameThemeId(stored) ? stored : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveThemePref(id: GameThemeId): void {
  try {
    gameStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* local persistence is a progressive enhancement */
  }
}
