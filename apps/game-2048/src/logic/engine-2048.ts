/**
 * 2048 board mechanics — the client-side half of the TEE-sealed game.
 *
 * Only the DETERMINISTIC slide/merge rules live here (they are a pure
 * function of board + direction, so the UI can animate instantly). The spawn
 * stream is generated inside the Morpheus enclave and revealed one spawn per
 * committed move — the client can never look ahead. The enclave runs the
 * authoritative twin of applyMove; keep the semantics in lockstep with
 * workers/nitro-worker/src/game/engines/game2048.js in neo-morpheus-oracle.
 *
 * Board cells hold EXPONENTS (0 = empty, e = tile 2^e), row-major 4x4.
 * Moves: 0 = up, 1 = right, 2 = down, 3 = left. A move is valid only if it
 * changes the board.
 */
export type Board = number[];

export const BOARD_CELLS = 16;
export const MAX_TILE_EXPONENT = 30;

/** Fail-closed validation for boards coming from TEE, storage, or bridge state. */
export function isValidBoard(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length === BOARD_CELLS
    && value.every((cell) => Number.isInteger(cell)
      && cell >= 0
      && cell <= MAX_TILE_EXPONENT);
}

export function requireBoard(value: unknown): number[] {
  if (!isValidBoard(value)) throw new Error("invalid 2048 board payload");
  return [...value];
}

/** Canonical 2048 spawns are always a 2 (exp 1) or 4 (exp 2). */
export function isValidSpawn(value: unknown): value is { pos: number; exp: 1 | 2 } {
  if (!value || typeof value !== "object") return false;
  const spawn = value as { pos?: unknown; exp?: unknown };
  return Number.isInteger(spawn.pos)
    && Number(spawn.pos) >= 0
    && Number(spawn.pos) < BOARD_CELLS
    && (spawn.exp === 1 || spawn.exp === 2);
}

/** One existing tile's deterministic travel during a confirmed move. */
export interface TileMotion {
  source: number;
  destination: number;
  exponent: number;
  /** Index into MoveTransition.merges, or null when this tile does not merge. */
  merge: number | null;
}

/** The two source tiles that become one result tile after their slide finishes. */
export interface TileMerge {
  sources: [number, number];
  destination: number;
  sourceExponent: number;
  resultExponent: number;
}

/** The enclave/local RNG tile revealed only after a valid slide. */
export interface TileSpawnMotion {
  destination: number;
  exponent: number;
}

/**
 * Authoritative animation payload for one confirmed move. The scene consumes
 * this mapping directly; it never tries to infer identities from two boards.
 */
export interface MoveTransition {
  sequence: number;
  direction: number;
  before: number[];
  afterSlide: number[];
  after: number[];
  motions: TileMotion[];
  merges: TileMerge[];
  spawn: TileSpawnMotion;
}

export const MOVE_UP = 0;
export const MOVE_RIGHT = 1;
export const MOVE_DOWN = 2;
export const MOVE_LEFT = 3;

/**
 * Shared Guest/GameFi presentation lock. Phaser's actual local lock is released
 * from its completion callback; this keeps React actions locked for the same
 * animation window after either backend confirms a move.
 */
export const MOVE_ANIMATION_MS = 340;

/** Cell indices of the 4 lines for a direction, in movement order. */
function lineIndices(dir: number): number[][] {
  const lines: number[][] = [];
  for (let a = 0; a < 4; a += 1) {
    const line: number[] = [];
    for (let b = 0; b < 4; b += 1) {
      if (dir === MOVE_LEFT) line.push(a * 4 + b);
      else if (dir === MOVE_RIGHT) line.push(a * 4 + (3 - b));
      else if (dir === MOVE_UP) line.push(b * 4 + a);
      else line.push((3 - b) * 4 + a);
    }
    lines.push(line);
  }
  return lines;
}

interface SlideTrace {
  before: number[];
  afterSlide: number[];
  motions: TileMotion[];
  merges: TileMerge[];
}

/** Build the exact source-to-destination mapping without mutating the board. */
function traceSlide(board: readonly number[], dir: number): SlideTrace | null {
  if (!isValidBoard(board) || !Number.isInteger(dir) || dir < 0 || dir > 3) return null;
  const before = [...board];
  const afterSlide = new Array<number>(BOARD_CELLS).fill(0);
  const motions: TileMotion[] = [];
  const merges: TileMerge[] = [];
  let changed = false;

  for (const idx of lineIndices(dir)) {
    const tiles = idx
      .map((source) => ({ source, exponent: before[source] ?? 0 }))
      .filter((tile) => tile.exponent > 0);
    let destinationOffset = 0;

    for (let i = 0; i < tiles.length; i += 1) {
      const current = tiles[i]!;
      const next = tiles[i + 1];
      const destination = idx[destinationOffset]!;

      if (next && current.exponent === next.exponent) {
        const merge = merges.length;
        motions.push(
          {
            source: current.source,
            destination,
            exponent: current.exponent,
            merge,
          },
          {
            source: next.source,
            destination,
            exponent: next.exponent,
            merge,
          },
        );
        merges.push({
          sources: [current.source, next.source],
          destination,
          sourceExponent: current.exponent,
          resultExponent: current.exponent + 1,
        });
        afterSlide[destination] = current.exponent + 1;
        changed = true;
        i += 1;
      } else {
        motions.push({
          source: current.source,
          destination,
          exponent: current.exponent,
          merge: null,
        });
        afterSlide[destination] = current.exponent;
        if (current.source !== destination) changed = true;
      }
      destinationOffset += 1;
    }
  }

  return changed ? { before, afterSlide, motions, merges } : null;
}

/**
 * Create the complete animation payload after the authoritative spawn is known.
 * Invalid/no-op moves and impossible spawns are rejected.
 */
export function createMoveTransition(
  board: readonly number[],
  dir: number,
  spawn: { pos: number; exp: number },
  sequence: number,
): MoveTransition | null {
  const slide = traceSlide(board, dir);
  if (!slide) return null;
  if (!Number.isSafeInteger(sequence) || sequence < 0) return null;
  if (!isValidSpawn(spawn)) return null;
  if ((slide.afterSlide[spawn.pos] ?? 0) !== 0) return null;

  const after = [...slide.afterSlide];
  after[spawn.pos] = spawn.exp;
  return {
    sequence,
    direction: dir,
    before: slide.before,
    afterSlide: slide.afterSlide,
    after,
    motions: slide.motions,
    merges: slide.merges,
    spawn: { destination: spawn.pos, exponent: spawn.exp },
  };
}

/** Slide+merge in place. Returns true when the board changed (valid move). */
export function applyMove(board: Board, dir: number): boolean {
  const trace = traceSlide(board, dir);
  if (!trace) return false;
  for (let index = 0; index < 16; index += 1) {
    board[index] = trace.afterSlide[index] ?? 0;
  }
  return true;
}

export function hasAnyMove(board: Board): boolean {
  for (let dir = 0; dir < 4; dir += 1) {
    if (applyMove([...board], dir)) return true;
  }
  return false;
}

export function boardHex(board: Board): string {
  if (!isValidBoard(board) || board.some((value) => value > 0xf)) return "";
  return board.map((v) => (v & 0xf).toString(16)).join("");
}

export function movesToString(moves: readonly number[]): string {
  return moves.every((move) => Number.isInteger(move) && move >= 0 && move <= 3)
    ? moves.map((move) => String(move)).join("")
    : "";
}

export function tileValue(exp: number): number {
  return Number.isInteger(exp) && exp > 0 && exp <= MAX_TILE_EXPONENT ? 2 ** exp : 0;
}
