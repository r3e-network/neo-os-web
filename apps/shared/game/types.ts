/**
 * Shared game types used across all miniapp reward games.
 *
 * Import from here instead of redeclaring LeaderEntry / SolveRow / etc.
 * in every game's main.tsx.
 */

// ─── Game status ──────────────────────────────────────────────────────────────

/** Canonical status values for a reward game session. */
export type GameSessionStatus =
  | "idle"
  | "committed"   // entry paid, enclave session being opened
  | "dealt"       // puzzle/seed delivered, player is playing
  | "solved"      // solution accepted on-chain, payout credited
  | "expired";    // deadline passed or player forfeited

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/** One entry in a global leaderboard, built from on-chain Solved events. */
export interface LeaderEntry {
  /** 1-based rank. */
  rank: number;
  /** Neo N3 address or hash160 string. */
  address: string;
  /** Total GAS won across all solved games (floating-point, not fixed8). */
  totalWon: number;
  /** Number of games solved. */
  solves: number;
  /** True when this entry belongs to the connected wallet. */
  isUser: boolean;
}

// ─── History rows ─────────────────────────────────────────────────────────────

/** Minimal common fields present in every per-game history row. */
export interface BaseHistoryRow {
  gameId: string;
  difficulty: number;
  payout: string;         // "X.XX GAS" display string
  solveMs: number;        // elapsed milliseconds
  undos: number;
}

/** Generic solve history row (used by most puzzle games). */
export interface SolveRow extends BaseHistoryRow {
  [extra: string]: unknown;
}

/** Platform-agnostic run history row (used by jump-rush, flappy-dash, etc.). */
export interface RunRow extends BaseHistoryRow {
  jumps?: number;
  perfects?: number;
  score?: number;
  [extra: string]: unknown;
}

// ─── Game modes ───────────────────────────────────────────────────────────────

/** One playable difficulty mode as stored in the game-rules module. */
export interface GameModeRule {
  /** Numeric ID passed to startGame(). */
  difficulty: number;
  /** Short key used for i18n lookups, e.g. "easy" | "medium" | "hard". */
  key: string;
  /** Entry fee in fixed8 units (bigint or number). */
  entryFixed8: bigint | number;
  /** Maximum reward in fixed8 units. */
  rewardFixed8: bigint | number;
  /** Time limit in milliseconds. */
  limitMs: number;
  /** Minimum elapsed ms before a solution is accepted. */
  minSolveMs: number;
  /** Game-specific target (pipes, length, tile, etc.). */
  target?: number;
}

// ─── Leaderboard build parameters ────────────────────────────────────────────

/**
 * Slot indices within the Solved event state array.
 * Different games pack their event differently; each declares its own.
 */
export interface SolvedEventSlots {
  /** slot index for gameId (default 0) */
  gameId?: number;
  /** slot index for player address/hash (default 1) */
  player?: number;
  /** slot index for difficulty (default 2) */
  difficulty?: number;
  /** slot index for elapsed ms (default 3) */
  elapsedMs?: number;
  /** slot index for payout (default 4) */
  solvedPayout?: number;
  /** slot index for cumulative totalWon (default 5) */
  totalWon?: number;
  /** slot index for undos (default 6, optional) */
  undos?: number;
  /** game-specific extra slots */
  [key: string]: number | undefined;
}
