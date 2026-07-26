/**
 * scenes.ts — themed scene metadata for Goose Basket Shuffle.
 *
 * The 24 levels are grouped into 9 themed scenes (garden → abyss).
 * A scene owns:
 *   - a pen PALETTE (background / floor / walls / rim / ground bounce light)
 *     applied by ZhuaDaScene when a level of that scene starts,
 *   - a KIND POOL — the ordered item-kind mix its levels draw from (the level's
 *     `kinds` count selects from that candidate series), so every scene keeps
 *     its own content mix while a replay can still deal a different subset,
 *   - a LIMITED-EDITION GOOSE variant (original primitive-geometry accessory
 *     spec consumed by models.buildGoose + GooseChip) unlocked by clearing the
 *     scene's final level.
 *
 * Pure data + lookups: no three.js import, safe for the entry chunk and tests.
 */

/** Hat silhouettes available to goose variants (all built from primitives). */
export type GooseHat = "straw" | "beret" | "cap" | "beanie" | "party";

/** Original accessory spec for a limited-edition goose. */
export interface GooseVariant {
  /** Body tint (base goose is warm white). */
  body: number;
  /** Scarf ring color around the neck base. */
  scarf: number;
  hat: GooseHat;
  hatColor: number;
  /** Band / pompom accent on the hat. */
  hatAccent: number;
}

/** Pen colors applied by the 3D scene per theme. */
export interface ScenePalette {
  bg: number;
  floor: number;
  wall: number;
  rim: number;
  hemiGround: number;
}

export interface SceneTheme {
  /** 0-based scene index (also the collection id persisted in `geese`). */
  id: number;
  /** messages.ts key for the scene name (en+zh). */
  nameKey: string;
  /** messages.ts key for the limited goose name (en+zh). */
  gooseNameKey: string;
  /** Inclusive level range [first, last]; clearing `last` unlocks the goose. */
  levels: [number, number];
  palette: ScenePalette;
  /** Candidate item ids; runtime selects a balanced random `kinds` subset. */
  kindPool: number[];
  goose: GooseVariant;
}

/**
 * A scene exposes 48 of the 54 themed match identities. Each authored
 * silhouette owns a three-treatment near-match family (base, +18 and +36);
 * scenes omit two complete families so their content series stay coherent
 * while L2+ still carries sixteen confusing three-way families.
 */
export const SCENE_KIND_POOL_SIZE = 48;

export const SCENES: SceneTheme[] = [
  {
    id: 0,
    nameKey: "sceneGarden",
    gooseNameKey: "gooseGarden",
    levels: [1, 2],
    palette: { bg: 0xeef6e6, floor: 0xdcead0, wall: 0xe9f2dc, rim: 0x3fa34d, hemiGround: 0xd4e6c3 },
    kindPool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 53],
    goose: { body: 0xf7f7f2, scarf: 0x3fa34d, hat: "straw", hatColor: 0xd9b45b, hatAccent: 0x3fa34d },
  },
  {
    id: 1,
    nameKey: "sceneOrchard",
    gooseNameKey: "gooseOrchard",
    levels: [3, 5],
    palette: { bg: 0xfdf3e3, floor: 0xf2dfc0, wall: 0xf8ecd6, rim: 0xe8823a, hemiGround: 0xf0dcb8 },
    kindPool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 50, 51, 52, 53],
    goose: { body: 0xf7f7f2, scarf: 0xe8823a, hat: "beret", hatColor: 0xd9534f, hatAccent: 0xb03a30 },
  },
  {
    id: 2,
    nameKey: "scenePond",
    gooseNameKey: "goosePond",
    levels: [6, 8],
    palette: { bg: 0xe6f3f8, floor: 0xcfe7f0, wall: 0xdeeef5, rim: 0x2f9ec7, hemiGround: 0xc9e2ec },
    kindPool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 53],
    goose: { body: 0xf7f7f2, scarf: 0x2f9ec7, hat: "cap", hatColor: 0xf7f7f2, hatAccent: 0x2f9ec7 },
  },
  {
    id: 3,
    nameKey: "sceneFarm",
    gooseNameKey: "gooseFarm",
    levels: [9, 11],
    palette: { bg: 0xf9efe2, floor: 0xe6d2b4, wall: 0xf1e3cd, rim: 0xb35a2e, hemiGround: 0xe0cbaa },
    kindPool: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
    goose: { body: 0xf7f7f2, scarf: 0xc0392b, hat: "straw", hatColor: 0x8d6e63, hatAccent: 0xc0392b },
  },
  {
    id: 4,
    nameKey: "sceneSnowfield",
    gooseNameKey: "gooseSnowfield",
    levels: [12, 13],
    palette: { bg: 0xeff4fa, floor: 0xe2eaf3, wall: 0xebf1f8, rim: 0x5f97c9, hemiGround: 0xd8e3ef },
    kindPool: [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
    goose: { body: 0xfbfbf8, scarf: 0xe74c3c, hat: "beanie", hatColor: 0xe74c3c, hatAccent: 0xf7f7f2 },
  },
  {
    id: 5,
    nameKey: "sceneNightMarket",
    gooseNameKey: "gooseNightMarket",
    levels: [14, 15],
    palette: { bg: 0x252838, floor: 0x3a3d55, wall: 0x45486a, rim: 0xf2c14e, hemiGround: 0x30324a },
    kindPool: [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
    goose: { body: 0xf7f7f2, scarf: 0xf2c14e, hat: "party", hatColor: 0x8e44ad, hatAccent: 0xf2c14e },
  },
  // ── Chapter 2 · three new themed scenes (content expansion, 2026-07-12) ──
  // Every chapter scene curates a different 48-kind series from the 54-identity
  // theme catalog. Levels 16–24 keep logical variety at 48 while the
  // 54-body window and reserve waves bound mobile physics work.
  {
    id: 6,
    nameKey: "sceneVolcano",
    gooseNameKey: "gooseVolcano",
    levels: [16, 18],
    palette: { bg: 0x2a1714, floor: 0x43241d, wall: 0x371d18, rim: 0xff6b35, hemiGround: 0x3a201a },
    kindPool: [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53],
    goose: { body: 0xf7f7f2, scarf: 0xff6b35, hat: "party", hatColor: 0xc0392b, hatAccent: 0xff6b35 },
  },
  {
    id: 7,
    nameKey: "sceneCloud",
    gooseNameKey: "gooseCloud",
    levels: [19, 21],
    palette: { bg: 0xdff1fb, floor: 0xcfe6f5, wall: 0xe2f0fb, rim: 0x6fb7e8, hemiGround: 0xcfdff0 },
    kindPool: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53],
    goose: { body: 0xfbfdff, scarf: 0x6fb7e8, hat: "beanie", hatColor: 0x6fb7e8, hatAccent: 0xffffff },
  },
  {
    id: 8,
    nameKey: "sceneAbyss",
    gooseNameKey: "gooseAbyss",
    levels: [22, 24],
    palette: { bg: 0x0f2a33, floor: 0x15414f, wall: 0x103341, rim: 0x2fd6c9, hemiGround: 0x123038 },
    kindPool: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 45, 46, 47, 48, 49, 50, 51, 52],
    goose: { body: 0xf7f7f2, scarf: 0x2fd6c9, hat: "cap", hatColor: 0x0f2a33, hatAccent: 0x2fd6c9 },
  },
];

/** 0-based scene index owning `level` (clamped to the catalog bounds). */
export function sceneIndexOfLevel(level: number): number {
  for (const s of SCENES) {
    if (level >= s.levels[0] && level <= s.levels[1]) return s.id;
  }
  return level < 1 ? 0 : SCENES.length - 1;
}

export function sceneOfLevel(level: number): SceneTheme {
  return SCENES[sceneIndexOfLevel(level)]!;
}

/** True when clearing `level` completes its scene (goose unlock moment). */
export function isSceneFinalLevel(level: number): boolean {
  return sceneOfLevel(level).levels[1] === level;
}
