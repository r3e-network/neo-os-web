/**
 * Deterministic Sudoku derivation — the TypeScript twin of the MiniAppSudoku
 * contract's DeriveSolution.
 *
 * Both sides expand the SAME 32-byte beacon seed through the SAME draw order
 * (digit relabel -> band/row shuffles -> stack/column shuffles -> optional
 * transpose) over one canonical solved grid, so the contract can verify a
 * submitted board with a plain 81-byte comparison while the client renders the
 * matching puzzle offline. Golden vectors in apps/shared/test/sudoku.engine
 * .test.ts pin this file and the contract to the identical byte stream — any
 * edit here must keep those vectors green and be mirrored on-chain.
 *
 * Every transform is a Sudoku symmetry: solutions of the transformed puzzle
 * are in bijection with solutions of the (BASE_GRID, mask) puzzle, so the
 * offline uniqueness proof carried by each mask survives the shuffle.
 */
import { BASE_GRID, MASKS } from "./sudoku-data";

export type Difficulty = 0 | 1 | 2;
export const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;

export interface DealtPuzzle {
  /** 81 chars, '1'..'9' — the only accepted submission. */
  solution: string;
  /** 81 chars, '0' for empty cells, '1'..'9' for given clues. */
  puzzle: string;
  /** Count of given clues (difficulty signal for the UI). */
  clues: number;
  maskIndex: number;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error(`invalid hex seed: ${hex}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

interface SeedStream {
  next: () => number;
}

function streamOf(seed: Uint8Array): SeedStream {
  if (seed.length !== 32) throw new Error("seed must be 32 bytes");
  let cursor = 0;
  return {
    next: () => {
      const byte = seed[cursor % 32] ?? 0;
      cursor += 1;
      return byte;
    },
  };
}

function fisherYates(stream: SeedStream, values: number[]): number[] {
  const arr = [...values];
  for (let i = arr.length - 1; i >= 1; i -= 1) {
    const j = stream.next() % (i + 1);
    const swapped = arr[i] ?? 0;
    arr[i] = arr[j] ?? 0;
    arr[j] = swapped;
  }
  return arr;
}

interface Transform {
  digitPerm: number[];
  rowIndex: number[];
  colIndex: number[];
  transpose: boolean;
  maskDraw: number;
}

function deriveTransform(seed: Uint8Array): Transform {
  const stream = streamOf(seed);
  const digitPerm = fisherYates(stream, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const bandPerm = fisherYates(stream, [0, 1, 2]);
  const rowPerm = [
    fisherYates(stream, [0, 1, 2]),
    fisherYates(stream, [0, 1, 2]),
    fisherYates(stream, [0, 1, 2]),
  ];
  const stackPerm = fisherYates(stream, [0, 1, 2]);
  const colPerm = [
    fisherYates(stream, [0, 1, 2]),
    fisherYates(stream, [0, 1, 2]),
    fisherYates(stream, [0, 1, 2]),
  ];
  const transpose = stream.next() % 2 === 1;
  const maskDraw = stream.next();

  const rowIndex: number[] = [];
  const colIndex: number[] = [];
  for (let r = 0; r < 9; r += 1) {
    rowIndex[r] =
      (bandPerm[Math.floor(r / 3)] ?? 0) * 3 + ((rowPerm[Math.floor(r / 3)] ?? [])[r % 3] ?? 0);
  }
  for (let c = 0; c < 9; c += 1) {
    colIndex[c] =
      (stackPerm[Math.floor(c / 3)] ?? 0) * 3 + ((colPerm[Math.floor(c / 3)] ?? [])[c % 3] ?? 0);
  }
  return { digitPerm, rowIndex, colIndex, transpose, maskDraw };
}

function sourceCell(t: Transform, r: number, c: number): number {
  const sr = (t.transpose ? t.rowIndex[c] : t.rowIndex[r]) ?? 0;
  const sc = (t.transpose ? t.colIndex[r] : t.colIndex[c]) ?? 0;
  return sr * 9 + sc;
}

/** The full solved grid for a seed — must match the contract byte-for-byte. */
export function deriveSolution(seed: Uint8Array): string {
  const t = deriveTransform(seed);
  let out = "";
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const v = BASE_GRID.charCodeAt(sourceCell(t, r, c)) - 48;
      out += String(t.digitPerm[v - 1] ?? 0);
    }
  }
  return out;
}

/** Solution + clue layout for a seed at a difficulty (client-side view). */
export function dealPuzzle(seed: Uint8Array, difficulty: Difficulty): DealtPuzzle {
  const t = deriveTransform(seed);
  const masks = MASKS[DIFFICULTY_KEYS[difficulty] ?? "easy"];
  const maskIndex = t.maskDraw % masks.length;
  const mask = masks[maskIndex] ?? "";
  let solution = "";
  let puzzle = "";
  let clues = 0;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const src = sourceCell(t, r, c);
      const digit = String(t.digitPerm[BASE_GRID.charCodeAt(src) - 48 - 1] ?? 0);
      solution += digit;
      if (mask.charCodeAt(src) === 49) {
        puzzle += digit;
        clues += 1;
      } else {
        puzzle += "0";
      }
    }
  }
  return { solution, puzzle, clues, maskIndex };
}

/** Cells (indices 0..80) that clash with `value` placed at `index`. */
export function conflictsAt(entries: readonly number[], index: number, value: number): number[] {
  if (value === 0) return [];
  const r = Math.floor(index / 9);
  const c = index % 9;
  const clashes: number[] = [];
  for (let k = 0; k < 9; k += 1) {
    const rowIdx = r * 9 + k;
    const colIdx = k * 9 + c;
    const boxIdx =
      (Math.floor(r / 3) * 3 + Math.floor(k / 3)) * 9 + (Math.floor(c / 3) * 3 + (k % 3));
    for (const other of [rowIdx, colIdx, boxIdx]) {
      if (other !== index && entries[other] === value && !clashes.includes(other)) {
        clashes.push(other);
      }
    }
  }
  return clashes;
}

/** True when all 81 entries are filled and every row/col/box holds 1..9. */
export function isBoardComplete(entries: readonly number[]): boolean {
  if (entries.length !== 81) return false;
  for (let unit = 0; unit < 9; unit += 1) {
    let row = 0;
    let col = 0;
    let box = 0;
    for (let k = 0; k < 9; k += 1) {
      row |= 1 << (entries[unit * 9 + k] ?? 0);
      col |= 1 << (entries[k * 9 + unit] ?? 0);
      const r = Math.floor(unit / 3) * 3 + Math.floor(k / 3);
      const c = (unit % 3) * 3 + (k % 3);
      box |= 1 << (entries[r * 9 + c] ?? 0);
    }
    if (row !== 0b1111111110 || col !== 0b1111111110 || box !== 0b1111111110) return false;
  }
  return true;
}

export function boardToSolutionString(entries: readonly number[]): string {
  return entries.map((v) => String(v)).join("");
}
