/**
 * Game session state factory.
 *
 * Creates the standard set of observables every reward game needs:
 * loading flags, game status, balances, leaderboard, history, last status.
 * Import this instead of redeclaring ~20 `createObservable(...)` calls in
 * every game's main.tsx.
 *
 * Usage:
 * ```ts
 * const session = createGameSession(ctx, { rewardGame });
 * // Use session.state as the returned state map.
 * // Bind actions to session.actions helpers.
 * ```
 */

import { createObservable } from "../react/context";
import type { Observable } from "../react/context";
import type { LeaderEntry, SolveRow, GameSessionStatus } from "./types";
import { buildLeaderboard, toScriptHash, formatFixed8Gas } from "./utils";
import { fromFixed8 } from "../utils/format";
import { parseBigInt } from "../utils/parsers";
import { mapField } from "../gamefi";
import type { MiniAppFrameworkContext } from "../../../framework";

// ─── Session observables ──────────────────────────────────────────────────────

/** All observable slots that a standard game session exposes. */
export interface GameSessionObservables<THistory extends SolveRow = SolveRow> {
  // Balances
  credit:       Observable<number>;
  poolFree:     Observable<number>;
  // Game lifecycle
  activeGameId: Observable<string>;
  gameStatus:   Observable<GameSessionStatus>;
  gameDifficulty: Observable<number>;
  // Commitment / timing
  commitment:   Observable<string>;
  dealtAt:      Observable<number>;
  deadline:     Observable<number>;
  // Result
  undosUsed:    Observable<number>;
  lastPayout:   Observable<string>;
  lastElapsedMs: Observable<number>;
  // Leaderboard
  leaderboard:  Observable<LeaderEntry[]>;
  myRank:       Observable<number>;
  myTotalWon:   Observable<number>;
  mySolves:     Observable<number>;
  myHistory:    Observable<THistory[]>;
  // Loading flags
  isStarting:   Observable<boolean>;
  isDealing:    Observable<boolean>;
  isSubmitting: Observable<boolean>;
  isUndoing:    Observable<boolean>;
  lastStatus:   Observable<string>;
}

/** Options for createGameSession. */
export interface GameSessionOptions {
  /**
   * The i18n t() function; used only for the initial lastStatus value.
   * If omitted, lastStatus starts as "".
   */
  t?: (key: string) => string;
}

/**
 * Create the standard set of game session observables.
 * Eliminates the ~20-line boilerplate block at the top of every game's setup().
 */
export function createGameSessionObservables<THistory extends SolveRow = SolveRow>(
  options: GameSessionOptions = {},
): GameSessionObservables<THistory> {
  const t = options.t ?? (() => "");
  return {
    credit:         createObservable<number>(0),
    poolFree:       createObservable<number>(0),
    activeGameId:   createObservable<string>("0"),
    gameStatus:     createObservable<GameSessionStatus>("idle"),
    gameDifficulty: createObservable<number>(0),
    commitment:     createObservable<string>(""),
    dealtAt:        createObservable<number>(0),
    deadline:       createObservable<number>(0),
    undosUsed:      createObservable<number>(0),
    lastPayout:     createObservable<string>(""),
    lastElapsedMs:  createObservable<number>(0),
    leaderboard:    createObservable<LeaderEntry[]>([]),
    myRank:         createObservable<number>(0),
    myTotalWon:     createObservable<number>(0),
    mySolves:       createObservable<number>(0),
    myHistory:      createObservable<THistory[]>([]),
    isStarting:     createObservable<boolean>(false),
    isDealing:      createObservable<boolean>(false),
    isSubmitting:   createObservable<boolean>(false),
    isUndoing:      createObservable<boolean>(false),
    lastStatus:     createObservable<string>(t("statusReady")),
  };
}

// ─── On-chain game snapshot ───────────────────────────────────────────────────

/**
 * Apply an on-chain getGame() snapshot to the session observables.
 * The snapshot is any object with the standard game fields; passes through
 * the mapField utility for indexer-safe field access.
 */
export function applyGameSnapshot(
  obs: Pick<
    GameSessionObservables,
    "gameStatus" | "gameDifficulty" | "commitment" | "dealtAt" | "deadline" | "undosUsed"
  >,
  game: unknown,
  statusOf: (raw: number) => GameSessionStatus,
): void {
  const asNum = (v: unknown) => {
    const n = Number(parseBigInt(v));
    return Number.isFinite(n) ? n : 0;
  };
  obs.gameStatus.set(statusOf(asNum(mapField(game, "status"))));
  obs.gameDifficulty.set(asNum(mapField(game, "difficulty")));
  obs.commitment.set(String(mapField(game, "commitment") ?? ""));
  obs.dealtAt.set(asNum(mapField(game, "dealtAt")));
  obs.deadline.set(asNum(mapField(game, "deadline")));
  obs.undosUsed.set(asNum(mapField(game, "undos") ?? 0));
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

/**
 * Parse a statsOf() contract response into `{ solves, totalWon }`.
 * The contract returns a struct with "solved" and "totalWon" fields.
 */
export function parsePlayerStats(raw: unknown): { solves: number; totalWon: number } {
  const asNum = (v: unknown) => {
    const n = Number(parseBigInt(v));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    solves:   asNum(mapField(raw, "solved")),
    totalWon: fromFixed8(parseBigInt(mapField(raw, "totalWon"))),
  };
}
