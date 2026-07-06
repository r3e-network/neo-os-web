/**
 * @framework/game — Unified GameFi environment for miniapp reward games.
 *
 * Migrated from apps/shared/game. Use @framework/game instead of @shared/game
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
