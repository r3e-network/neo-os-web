/**
 * @framework/game — Unified GameFi environment for miniapp reward games.
 *
 * Use @framework/game as the only implementation source for game utilities.
 * for all game utilities, session factory, and types.
 *
 * ```ts
 * import type { LeaderEntry, SolveRow } from "@framework/game";
 * import { createGameSessionObservables, buildLeaderboard } from "@framework/game";
 * ```
 */

export type {
  GameSessionStatus,
  LeaderEntry,
  BaseHistoryRow,
  SolveRow,
  RunRow,
  GameModeRule,
  SolvedEventSlots,
} from "./types";

export type {
  GameSessionObservables,
  GameSessionOptions,
} from "./session";

export {
  createGameSessionObservables,
  applyGameSnapshot,
  parsePlayerStats,
} from "./session";

export {
  toScriptHash,
  shortHash,
  shortAddr,
  asNumber,
  gasFromFixed8,
  formatGas,
  formatFixed8Gas,
  buildLeaderboard,
} from "./utils";

// ─── RFC P1-1 guest kit ─────────────────────────────────────────────────────
export type {
  GuestLeaderboardAdapter,
  GuestLeaderboardAdapterOptions,
  GuestLeaderboardEntry,
  GuestLeaderboardApi,
  GuestPersistence,
  GuestRng,
  GuestRngCrypto,
  GuestRngOptions,
  GuestStorage,
  Obs,
} from "./guest-kit";

export {
  DEFAULT_GUEST_BOARD_LIMIT,
  clampDifficulty,
  createGuestLeaderboardAdapter,
  createGuestPersistence,
  createGuestRng,
  guestRowsToLeaderEntries,
} from "./guest-kit";
