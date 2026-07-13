/** Bead Workshop — production rules derived from the audited reference loop. */

export const BOARD_ROWS = 14;
export const BOARD_COLS = 14;
export const HOLDING_CAPACITY = 14;
export const ROUND_TIME_MS = 180_000;
export const MAX_UNDOS = 5;
export const SNAPSHOT_VERSION = 1;

/**
 * 14×14 diamond/chick silhouette with exactly 140 playable cells.
 * The reference also renders a 14×14 logical grid with 140 active cells; the
 * target colours and generated puzzles below are original and seed-driven.
 */
export const LEVEL_MASK: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0],
] as const;

export const BEAD_COLORS = [
  0xff6255, // coral
  0xffc532, // sunflower
  0x37bd83, // mint
  0x38a9df, // sky
  0xff8b38, // peach
  0x754225, // cocoa
  0xf36593, // raspberry
] as const;

export const BEAD_COLOR_KEYS = [
  "colorCoral",
  "colorSunflower",
  "colorMint",
  "colorSky",
  "colorPeach",
  "colorCocoa",
  "colorRaspberry",
] as const;

export function validCellCount(): number {
  return LEVEL_MASK.reduce(
    (total, row) => total + row.reduce((sum, value) => sum + value, 0),
    0,
  );
}
