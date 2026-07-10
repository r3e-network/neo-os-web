/**
 * scenes.ts — themed scene metadata for Catch the Goose (G4 meta progression).
 *
 * The 15 levels are grouped into 6 themed scenes (garden → night market).
 * A scene owns:
 *   - a pen PALETTE (background / floor / walls / rim / ground bounce light)
 *     applied by ZhuaDaScene when a level of that scene starts,
 *   - a KIND POOL — the ordered item-kind mix its levels draw from (the level's
 *     `kinds` count slices the first N entries), so every scene "feels" of its
 *     place (the pond leads with fish + eggs, the farm with eggs + corn…),
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
  /** Ordered ITEM_DEFS ids; a level with `kinds = n` uses the first n. */
  kindPool: number[];
  goose: GooseVariant;
}

// Item ids (ITEM_DEFS): 0 tomato · 1 carrot · 2 corn · 3 eggplant · 4 apple ·
// 5 broccoli · 6 mushroom · 7 onion · 8 pepper · 9 melon · 10 egg · 11 fish.
export const SCENES: SceneTheme[] = [
  {
    id: 0,
    nameKey: "sceneGarden",
    gooseNameKey: "gooseGarden",
    levels: [1, 2],
    palette: { bg: 0xeef6e6, floor: 0xdcead0, wall: 0xe9f2dc, rim: 0x3fa34d, hemiGround: 0xd4e6c3 },
    kindPool: [0, 1, 5, 8, 3, 7, 2, 6, 4, 9, 10, 11],
    goose: { body: 0xf7f7f2, scarf: 0x3fa34d, hat: "straw", hatColor: 0xd9b45b, hatAccent: 0x3fa34d },
  },
  {
    id: 1,
    nameKey: "sceneOrchard",
    gooseNameKey: "gooseOrchard",
    levels: [3, 5],
    palette: { bg: 0xfdf3e3, floor: 0xf2dfc0, wall: 0xf8ecd6, rim: 0xe8823a, hemiGround: 0xf0dcb8 },
    kindPool: [4, 9, 0, 3, 8, 1, 2, 5, 7, 6, 10, 11],
    goose: { body: 0xf7f7f2, scarf: 0xe8823a, hat: "beret", hatColor: 0xd9534f, hatAccent: 0xb03a30 },
  },
  {
    id: 2,
    nameKey: "scenePond",
    gooseNameKey: "goosePond",
    levels: [6, 8],
    palette: { bg: 0xe6f3f8, floor: 0xcfe7f0, wall: 0xdeeef5, rim: 0x2f9ec7, hemiGround: 0xc9e2ec },
    kindPool: [11, 10, 9, 5, 6, 7, 4, 0, 2, 1, 3, 8],
    goose: { body: 0xf7f7f2, scarf: 0x2f9ec7, hat: "cap", hatColor: 0xf7f7f2, hatAccent: 0x2f9ec7 },
  },
  {
    id: 3,
    nameKey: "sceneFarm",
    gooseNameKey: "gooseFarm",
    levels: [9, 11],
    palette: { bg: 0xf9efe2, floor: 0xe6d2b4, wall: 0xf1e3cd, rim: 0xb35a2e, hemiGround: 0xe0cbaa },
    kindPool: [10, 2, 6, 1, 7, 0, 8, 5, 4, 3, 9, 11],
    goose: { body: 0xf7f7f2, scarf: 0xc0392b, hat: "straw", hatColor: 0x8d6e63, hatAccent: 0xc0392b },
  },
  {
    id: 4,
    nameKey: "sceneSnowfield",
    gooseNameKey: "gooseSnowfield",
    levels: [12, 13],
    palette: { bg: 0xeff4fa, floor: 0xe2eaf3, wall: 0xebf1f8, rim: 0x5f97c9, hemiGround: 0xd8e3ef },
    kindPool: [10, 6, 11, 7, 5, 4, 0, 1, 2, 3, 8, 9],
    goose: { body: 0xfbfbf8, scarf: 0xe74c3c, hat: "beanie", hatColor: 0xe74c3c, hatAccent: 0xf7f7f2 },
  },
  {
    id: 5,
    nameKey: "sceneNightMarket",
    gooseNameKey: "gooseNightMarket",
    levels: [14, 15],
    palette: { bg: 0x252838, floor: 0x3a3d55, wall: 0x45486a, rim: 0xf2c14e, hemiGround: 0x30324a },
    kindPool: [8, 11, 10, 2, 6, 3, 9, 0, 4, 7, 1, 5],
    goose: { body: 0xf7f7f2, scarf: 0xf2c14e, hat: "party", hatColor: 0x8e44ad, hatAccent: 0xf2c14e },
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
