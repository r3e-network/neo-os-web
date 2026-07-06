/**
 * Game session state factory.
 *
 * Creates the standard set of observables every reward game needs.
 * Migrated from apps/shared/game/session.ts — imports use @shared/ alias.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { LeaderEntry, SolveRow, GameSessionStatus } from "./types";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { mapField } from "@shared/gamefi";

export interface GameSessionObservables<THistory extends SolveRow = SolveRow> {
  credit:          Observable<number>;
  poolFree:        Observable<number>;
  activeGameId:    Observable<string>;
  gameStatus:      Observable<GameSessionStatus>;
  gameDifficulty:  Observable<number>;
  commitment:      Observable<string>;
  dealtAt:         Observable<number>;
  deadline:        Observable<number>;
  undosUsed:       Observable<number>;
  lastPayout:      Observable<string>;
  lastElapsedMs:   Observable<number>;
  leaderboard:     Observable<LeaderEntry[]>;
  myRank:          Observable<number>;
  myTotalWon:      Observable<number>;
  mySolves:        Observable<number>;
  myHistory:       Observable<THistory[]>;
  isStarting:      Observable<boolean>;
  isDealing:       Observable<boolean>;
  isSubmitting:    Observable<boolean>;
  isUndoing:       Observable<boolean>;
  lastStatus:      Observable<string>;
}

export interface GameSessionOptions {
  t?: (key: string) => string;
}

export function createGameSessionObservables<THistory extends SolveRow = SolveRow>(
  options: GameSessionOptions = {},
): GameSessionObservables<THistory> {
  const t = options.t ?? (() => "");
  return {
    credit:          createObservable<number>(0),
    poolFree:        createObservable<number>(0),
    activeGameId:    createObservable<string>("0"),
    gameStatus:      createObservable<GameSessionStatus>("idle"),
    gameDifficulty:  createObservable<number>(0),
    commitment:      createObservable<string>(""),
    dealtAt:         createObservable<number>(0),
    deadline:        createObservable<number>(0),
    undosUsed:       createObservable<number>(0),
    lastPayout:      createObservable<string>(""),
    lastElapsedMs:   createObservable<number>(0),
    leaderboard:     createObservable<LeaderEntry[]>([]),
    myRank:          createObservable<number>(0),
    myTotalWon:      createObservable<number>(0),
    mySolves:        createObservable<number>(0),
    myHistory:       createObservable<THistory[]>([]),
    isStarting:      createObservable<boolean>(false),
    isDealing:       createObservable<boolean>(false),
    isSubmitting:    createObservable<boolean>(false),
    isUndoing:       createObservable<boolean>(false),
    lastStatus:      createObservable<string>(t("statusReady")),
  };
}

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
