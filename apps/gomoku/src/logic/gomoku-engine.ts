/**
 * Gomoku (Five-in-a-Row) core engine — board logic, win detection, and AI.
 *
 * The board is a 15×15 grid. Players alternate placing stones; the first to
 * align five consecutive stones horizontally, vertically, or diagonally wins.
 * The AI uses minimax with alpha-beta pruning and a pattern-based evaluation
 * function tuned for Gomoku tactics (open fours, broken threes, etc.).
 */

export const BOARD_SIZE = 15;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
/** Stones that must be aligned to win. */
export const WIN_LENGTH = 5;

export type Player = 1 | 2; // 1 = black (human), 2 = white (AI)
export type CellValue = 0 | Player;
export type Board = CellValue[];

export type Difficulty = 0 | 1 | 2;
export const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;

export interface MoveRecord {
  cell: number;
  player: Player;
}

export interface GameResult {
  winner: Player | 0; // 0 = nobody has won
  winLine: number[];  // the winning five cells, end to end (empty if no winner)
  draw: boolean;      // true only when the board is full with no winner
}

// ── Board helpers ──────────────────────────────────────────────────────────────

export function createBoard(): Board {
  return new Array(CELL_COUNT).fill(0);
}

export function idx(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function rowOf(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

export function colOf(index: number): number {
  return index % BOARD_SIZE;
}

export function isValidCell(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT;
}

export function isEmpty(board: Board, index: number): boolean {
  return isValidCell(index) && board[index] === 0;
}

// ── Win detection ──────────────────────────────────────────────────────────────

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal ↘
  [1, -1],  // diagonal ↙
];

/**
 * Check if placing `player` at `index` creates a five-in-a-row.
 *
 * Returns exactly five indices in geometric order (one end of the run to the
 * other) so callers can treat the first and last entries as the endpoints of
 * the winning line — the scene draws its victory stroke between them. Runs
 * longer than five are windowed so the window still contains `index`.
 * Returns null when `index` completes no five.
 */
export function checkWinAt(board: Board, index: number, player: Player): number[] | null {
  if (!isValidCell(index)) return null;
  const r = rowOf(index);
  const c = colOf(index);

  for (const [dr, dc] of DIRECTIONS) {
    // Walk backward first so the run is built end-to-end in geometric order.
    const backward: number[] = [];
    for (let step = 1; step < BOARD_SIZE; step++) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      const ni = idx(nr, nc);
      if (board[ni] !== player) break;
      backward.push(ni);
    }
    backward.reverse();

    const forward: number[] = [];
    for (let step = 1; step < BOARD_SIZE; step++) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      const ni = idx(nr, nc);
      if (board[ni] !== player) break;
      forward.push(ni);
    }

    const run = [...backward, index, ...forward];
    if (run.length < WIN_LENGTH) continue;

    // Clamp a five-wide window so it stays in bounds and still covers `index`.
    const pos = backward.length;
    const start = Math.max(0, Math.min(pos - (WIN_LENGTH - 1), run.length - WIN_LENGTH));
    return run.slice(start, start + WIN_LENGTH);
  }

  return null;
}

/**
 * Full-board win check. Scans for any completed five and otherwise reports
 * whether the board is exhausted, so callers can tell a drawn game from one
 * that is still in progress.
 */
export function checkWinner(board: Board): GameResult {
  for (let i = 0; i < CELL_COUNT; i++) {
    const player = board[i];
    // `!player` also discards the `undefined` an out-of-range index would yield.
    if (!player) continue;
    const line = checkWinAt(board, i, player);
    if (line) return { winner: player, winLine: line, draw: false };
  }
  return { winner: 0, winLine: [], draw: isBoardFull(board) };
}

export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== 0);
}

// ── Pattern evaluation (per-stone direction analysis) ──────────────────────────

const SCORE = {
  FIVE: 10_000_000,
  OPEN_FOUR: 1_000_000,   // 活四：两端都空，不可阻挡
  FOUR: 100_000,          // 冲四：一端被堵
  OPEN_THREE: 50_000,     // 活三：两端都空
  THREE: 8_000,           // 眠三：一端被堵
  OPEN_TWO: 5_000,        // 活二
  TWO: 800,               // 眠二
  ONE: 100,
} as const;

/**
 * Analyze the line through (r,c) in direction (dr,dc) for `player`.
 * Returns the count of consecutive stones and how many ends are blocked.
 * block=0 means both ends open (live), block=1 one end blocked, block=2 dead.
 */
function analyzeDir(
  board: Board,
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: Player,
): { count: number; block: number } {
  let count = 1;
  let block = 0;

  // Forward
  let i = 1;
  while (true) {
    const nr = r + dr * i;
    const nc = c + dc * i;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) { block++; break; }
    const v = board[idx(nr, nc)];
    if (v === player) { count++; i++; }
    else { if (v !== 0) block++; break; }
  }
  // Backward
  i = 1;
  while (true) {
    const nr = r - dr * i;
    const nc = c - dc * i;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) { block++; break; }
    const v = board[idx(nr, nc)];
    if (v === player) { count++; i++; }
    else { if (v !== 0) block++; break; }
  }

  return { count, block };
}

/**
 * Score a single point for `player` across all four directions.
 * Assumes `player` has a stone at (r,c).
 */
function scorePoint(board: Board, r: number, c: number, player: Player): number {
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const { count, block } = analyzeDir(board, r, c, dr, dc, player);
    if (count >= 5) total += SCORE.FIVE;
    else if (count === 4) total += block === 0 ? SCORE.OPEN_FOUR : block === 1 ? SCORE.FOUR : 0;
    else if (count === 3) total += block === 0 ? SCORE.OPEN_THREE : block === 1 ? SCORE.THREE : 0;
    else if (count === 2) total += block === 0 ? SCORE.OPEN_TWO : block === 1 ? SCORE.TWO : 0;
    else if (count === 1 && block === 0) total += SCORE.ONE;
  }
  return total;
}

/** Check if placing at (r,c) creates a specific pattern for `player`. */
function hasPattern(
  board: Board,
  r: number,
  c: number,
  player: Player,
  targetCount: number,
  maxBlock: number,
): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const { count, block } = analyzeDir(board, r, c, dr, dc, player);
    if (count >= targetCount && block <= maxBlock) return true;
  }
  return false;
}

/** Full board evaluation from the AI's perspective (positive = good for AI). */
export function evaluateBoard(board: Board): number {
  let aiScore = 0;
  let humanScore = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i] === 2) aiScore += scorePoint(board, rowOf(i), colOf(i), 2);
    else if (board[i] === 1) humanScore += scorePoint(board, rowOf(i), colOf(i), 1);
  }
  return aiScore - humanScore * 1.15; // Slightly prioritise defence
}

// ── Candidate move generation ──────────────────────────────────────────────────

/**
 * Generate candidate moves: empty cells within distance 2 of any placed stone.
 * Sorted by combined AI+human scorePoint heuristic for better pruning.
 */
export function getCandidateMoves(board: Board, limit = 20): number[] {
  const candidates: Array<{ cell: number; score: number }> = [];
  const visited = new Uint8Array(CELL_COUNT);

  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i] === 0) continue;
    const r = rowOf(i);
    const c = colOf(i);

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
        const ni = idx(nr, nc);
        if (board[ni] !== 0 || visited[ni]) continue;
        visited[ni] = 1;

        // Heuristic: score this point for both AI and human
        board[ni] = 2;
        const s2 = scorePoint(board, nr, nc, 2);
        board[ni] = 1;
        const s1 = scorePoint(board, nr, nc, 1);
        board[ni] = 0;
        candidates.push({ cell: ni, score: s2 + s1 * 1.1 });
      }
    }
  }

  if (candidates.length === 0) return [idx(7, 7)];
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map((entry) => entry.cell);
}

// ── AI (Threat-priority + Minimax with Alpha-Beta) ─────────────────────────────

const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = {
  0: 1,  // Easy: 1-ply
  1: 2,  // Medium: 2-ply
  2: 4,  // Hard: 4-ply
};

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximising: boolean,
  aiPlayer: Player,
): number {
  if (depth === 0) return evaluateBoard(board);

  const humanPlayer: Player = aiPlayer === 1 ? 2 : 1;
  const candidates = getCandidateMoves(board, depth >= 3 ? 8 : 12);

  if (isMaximising) {
    let maxEval = -Infinity;
    for (const cell of candidates) {
      board[cell] = aiPlayer;
      if (checkWinAt(board, cell, aiPlayer)) { board[cell] = 0; return 9_999_999 + depth; }
      const val = minimax(board, depth - 1, alpha, beta, false, aiPlayer);
      board[cell] = 0;
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const cell of candidates) {
      board[cell] = humanPlayer;
      if (checkWinAt(board, cell, humanPlayer)) { board[cell] = 0; return -9_999_999 - depth; }
      const val = minimax(board, depth - 1, alpha, beta, true, aiPlayer);
      board[cell] = 0;
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Compute the AI's best move using layered threat-priority + minimax.
 *
 * Decision layers (highest priority first):
 *  1. AI can make five → win immediately
 *  2. Human can make five → must block
 *  3. AI can make open four → unstoppable, play it
 *  4. Human can make open four → must block
 *  5. AI can make four (rush) → forces response
 *  6. Human can make four → must block
 *  7. AI can make open three → attack
 *  8. Human can make open three → must block
 *  9. Fall through to minimax search
 */
export function computeAiMove(board: Board, difficulty: Difficulty, aiPlayer: Player = 2): number {
  const humanPlayer: Player = aiPlayer === 1 ? 2 : 1;
  const candidates = getCandidateMoves(board, difficulty === 2 ? 20 : 14);

  if (candidates.length === 0) return idx(7, 7);
  if (candidates.length === 1) return candidates[0] ?? idx(7, 7);

  // Layer 1: AI immediate win
  for (const cell of candidates) {
    board[cell] = aiPlayer;
    if (checkWinAt(board, cell, aiPlayer)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 2: Block human immediate win
  for (const cell of candidates) {
    board[cell] = humanPlayer;
    if (checkWinAt(board, cell, humanPlayer)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 3: AI open four (unstoppable)
  for (const cell of candidates) {
    board[cell] = aiPlayer;
    if (hasPattern(board, rowOf(cell), colOf(cell), aiPlayer, 4, 0)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 4: Block human open four
  for (const cell of candidates) {
    board[cell] = humanPlayer;
    if (hasPattern(board, rowOf(cell), colOf(cell), humanPlayer, 4, 0)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 5: AI rush four (forces response)
  for (const cell of candidates) {
    board[cell] = aiPlayer;
    if (hasPattern(board, rowOf(cell), colOf(cell), aiPlayer, 4, 1)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 6: Block human rush four
  for (const cell of candidates) {
    board[cell] = humanPlayer;
    if (hasPattern(board, rowOf(cell), colOf(cell), humanPlayer, 4, 1)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 7: AI open three (attack)
  for (const cell of candidates) {
    board[cell] = aiPlayer;
    if (hasPattern(board, rowOf(cell), colOf(cell), aiPlayer, 3, 0)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 8: Block human open three
  for (const cell of candidates) {
    board[cell] = humanPlayer;
    if (hasPattern(board, rowOf(cell), colOf(cell), humanPlayer, 3, 0)) { board[cell] = 0; return cell; }
    board[cell] = 0;
  }

  // Layer 9: Minimax search
  const depth = DEPTH_BY_DIFFICULTY[difficulty];
  let bestCell = candidates[0] ?? idx(7, 7);
  let bestScore = -Infinity;

  for (const cell of candidates) {
    board[cell] = aiPlayer;
    const score = minimax(board, depth - 1, -Infinity, Infinity, false, aiPlayer);
    board[cell] = 0;
    if (score > bestScore) { bestScore = score; bestCell = cell; }
  }

  return bestCell;
}

// ── Serialization ──────────────────────────────────────────────────────────────

export function boardToString(board: Board): string {
  return board.map((cell) => String(cell)).join("");
}

export function stringToBoard(str: string): Board | null {
  if (str.length !== CELL_COUNT) return null;
  const board: Board = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const value = Number(str[i]);
    if (value !== 0 && value !== 1 && value !== 2) return null;
    board.push(value as CellValue);
  }
  return board;
}
