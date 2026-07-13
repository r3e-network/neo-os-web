/**
 * Player-selectable art directions for Goose Basket Shuffle.
 *
 * A theme is a complete presentation contract, not a color filter: it owns the
 * scene backdrop, container treatment, object catalog, UI tokens and ambience.
 * Logical kind ids remain 0..17 so the deterministic matching engine is shared
 * across every theme.
 */
import type { GeometryKind } from "./engine-zhuada";
import { gameStorage } from "./game-storage";

export type GameThemeId = "fresh-market" | "farm-kitchen" | "night-market";
export type ContainerStyle = "wicker-basket" | "wood-crate" | "round-bamboo";

export interface ThemeItem {
  nameKey: string;
  color: number;
  geometry: GeometryKind;
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

const freshItems: readonly ThemeItem[] = [
  { nameKey: "freshApple", color: 0x84a83b, geometry: "sphere" },
  { nameKey: "freshOrange", color: 0xf28c28, geometry: "sphere" },
  { nameKey: "freshLemon", color: 0xf4d447, geometry: "sphere" },
  { nameKey: "freshMushroom", color: 0xb98262, geometry: "cylinder" },
  { nameKey: "freshBaguette", color: 0xd99145, geometry: "cylinder" },
  { nameKey: "freshCup", color: 0xf3ead9, geometry: "cylinder" },
  { nameKey: "freshTeaTin", color: 0x698b55, geometry: "box" },
  { nameKey: "freshBoat", color: 0x327da0, geometry: "box" },
  { nameKey: "freshCandy", color: 0xe99aac, geometry: "sphere" },
  { nameKey: "freshPear", color: 0xa6bd45, geometry: "sphere" },
  { nameKey: "freshDonut", color: 0xd49a6a, geometry: "torus" },
  { nameKey: "freshEgg", color: 0xf4efe4, geometry: "cylinder" },
  { nameKey: "freshStrawberry", color: 0xd94c52, geometry: "sphere" },
  { nameKey: "freshWatermelon", color: 0x63a55b, geometry: "cylinder" },
  { nameKey: "freshHoney", color: 0xe5a72f, geometry: "cylinder" },
  { nameKey: "freshCheese", color: 0xf2c84b, geometry: "box" },
  { nameKey: "freshFlowerPot", color: 0xc86f4a, geometry: "cylinder" },
  { nameKey: "freshJuice", color: 0xf0d78a, geometry: "box" },
];

const farmItems: readonly ThemeItem[] = [
  { nameKey: "farmKettle", color: 0xb93f33, geometry: "sphere" },
  { nameKey: "farmMilk", color: 0xf4f0df, geometry: "cylinder" },
  { nameKey: "farmBowl", color: 0x74a6c7, geometry: "cylinder" },
  { nameKey: "farmRoll", color: 0xc68b52, geometry: "torus" },
  { nameKey: "farmJam", color: 0x9f2f35, geometry: "cylinder" },
  { nameKey: "farmSpoon", color: 0xba8350, geometry: "cylinder" },
  { nameKey: "farmPumpkin", color: 0xd7802f, geometry: "sphere" },
  { nameKey: "farmMitt", color: 0x7a9fc4, geometry: "box" },
  { nameKey: "farmWindmill", color: 0xc65f4f, geometry: "icosa" },
  { nameKey: "farmJug", color: 0xf1e1bd, geometry: "cylinder" },
  { nameKey: "farmCookie", color: 0xc9945a, geometry: "cylinder" },
  { nameKey: "farmMug", color: 0x5f8dac, geometry: "cylinder" },
  { nameKey: "farmRollingPin", color: 0xb77943, geometry: "cylinder" },
  { nameKey: "farmPot", color: 0x4f83a2, geometry: "cylinder" },
  { nameKey: "farmBread", color: 0xc9894d, geometry: "box" },
  { nameKey: "farmButter", color: 0xe4d1a5, geometry: "cylinder" },
  { nameKey: "farmRooster", color: 0xc84f3b, geometry: "icosa" },
  { nameKey: "farmYarn", color: 0x8d6aa8, geometry: "sphere" },
];

const nightItems: readonly ThemeItem[] = [
  { nameKey: "nightLantern", color: 0xd94a32, geometry: "cylinder" },
  { nameKey: "nightBun", color: 0xf1dfc5, geometry: "sphere" },
  { nameKey: "nightSoda", color: 0x76a99b, geometry: "cylinder" },
  { nameKey: "nightMooncake", color: 0xc48a47, geometry: "cylinder" },
  { nameKey: "nightTanghulu", color: 0xb72e2f, geometry: "cylinder" },
  { nameKey: "nightDrum", color: 0xb74632, geometry: "cylinder" },
  { nameKey: "nightBambooCup", color: 0xb79a5b, geometry: "cylinder" },
  { nameKey: "nightZongzi", color: 0x5d7e49, geometry: "cone" },
  { nameKey: "nightFishCharm", color: 0x2e8c96, geometry: "box" },
  { nameKey: "nightBowl", color: 0xe8d4ba, geometry: "cylinder" },
  { nameKey: "nightBell", color: 0xc99a3d, geometry: "cone" },
  { nameKey: "nightSnackTin", color: 0x6f4d94, geometry: "box" },
  { nameKey: "nightTeapot", color: 0x3f8b78, geometry: "sphere" },
  { nameKey: "nightFan", color: 0xd84b54, geometry: "box" },
  { nameKey: "nightLuckyCat", color: 0xf2e1c2, geometry: "icosa" },
  { nameKey: "nightNoodles", color: 0xe8c27a, geometry: "cylinder" },
  { nameKey: "nightLotusLamp", color: 0xe86c87, geometry: "sphere" },
  { nameKey: "nightMahjong", color: 0xe8e2cf, geometry: "box" },
];

export const THEME_ITEM_COUNT = 18;

export const GAME_THEMES: readonly GameTheme[] = [
  {
    id: "fresh-market",
    nameKey: "themeFreshName",
    descriptionKey: "themeFreshDescription",
    backdrop: "./art/theme-fresh-market.webp",
    mascot: "./art/mascot-fresh-market.webp",
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
    backdrop: "./art/theme-farm-kitchen.webp",
    mascot: "./art/mascot-farm-kitchen.webp",
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
    backdrop: "./art/theme-night-market.webp",
    mascot: "./art/mascot-night-market.webp",
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

export const DEFAULT_THEME_ID: GameThemeId = "fresh-market";
export const THEME_STORAGE_KEY = "zhuada-e:theme";

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function isGameThemeId(value: unknown): value is GameThemeId {
  return GAME_THEMES.some((theme) => theme.id === value);
}

export function themeOf(id: unknown): GameTheme {
  return GAME_THEMES.find((theme) => theme.id === id) ?? GAME_THEMES[0]!;
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
