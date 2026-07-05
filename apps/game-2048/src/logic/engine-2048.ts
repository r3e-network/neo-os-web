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

export const MOVE_UP = 0;
export const MOVE_RIGHT = 1;
export const MOVE_DOWN = 2;
export const MOVE_LEFT = 3;

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

/** Slide+merge in place. Returns true when the board changed (valid move). */
export function applyMove(board: Board, dir: number): boolean {
  if (dir < 0 || dir > 3) return false;
  let changed = false;
  for (const idx of lineIndices(dir)) {
    const vals: number[] = [];
    for (const i of idx) {
      const v = board[i] ?? 0;
      if (v !== 0) vals.push(v);
    }
    const merged: number[] = [];
    for (let i = 0; i < vals.length; i += 1) {
      const current = vals[i] ?? 0;
      if (i + 1 < vals.length && current === vals[i + 1]) {
        merged.push(current + 1);
        i += 1;
      } else {
        merged.push(current);
      }
    }
    while (merged.length < 4) merged.push(0);
    for (let i = 0; i < 4; i += 1) {
      const target = idx[i] ?? 0;
      const next = merged[i] ?? 0;
      if (board[target] !== next) changed = true;
      board[target] = next;
    }
  }
  return changed;
}

export function hasAnyMove(board: Board): boolean {
  for (let dir = 0; dir < 4; dir += 1) {
    if (applyMove([...board], dir)) return true;
  }
  return false;
}

export function boardHex(board: Board): string {
  return board.map((v) => (v & 0xf).toString(16)).join("");
}

export function movesToString(moves: readonly number[]): string {
  return moves.map((m) => String(m)).join("");
}

export function tileValue(exp: number): number {
  return exp > 0 ? 2 ** exp : 0;
}
