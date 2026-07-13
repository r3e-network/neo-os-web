import type { Observable } from "@shared/react";
import {
  allScrews,
  applyScrewMove,
  computeStars,
  createSession,
  deriveSeed,
  generateLevel,
  restartSession,
  togglePause,
  undoMove,
  verifyConstructiveSolution,
} from "./screw-engine";
import type { CoreRunState, ScrewSession } from "./screw-engine";

export const SESSION_STORAGE_KEY = "session:v1";
export const STATS_STORAGE_KEY = "stats:v1";

export interface ScrewSortStats {
  wins: number;
  bestMoves: number;
  bestStars: number;
  lastSeed: string;
}

export interface GuestStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set<T>(key: string, value: T): void;
  delete?(key: string): void;
}

export interface GuestEngineDeps {
  session: Observable<ScrewSession>;
  stats: Observable<ScrewSortStats>;
  lastStatus: Observable<string>;
  storage: GuestStorage;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (message: string, type: "success" | "error" | "info" | "warning") => void;
  submitScore?: (score: number) => Promise<void>;
}

const EMPTY_STATS: ScrewSortStats = { wins: 0, bestMoves: 0, bestStars: 0, lastSeed: "" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validCore(levelSeed: string, value: unknown): value is CoreRunState {
  if (!isRecord(value)) return false;
  const level = generateLevel(levelSeed);
  const validScrews = new Set(allScrews(level).map(({ id }) => id));
  const removed = value.removedScrewIds;
  const boxes = value.boxes;
  const buffer = value.buffer;
  if (!Array.isArray(removed) || !removed.every((id) => typeof id === "string" && validScrews.has(id))) {
    return false;
  }
  if (new Set(removed).size !== removed.length) return false;
  if (!Array.isArray(boxes) || boxes.length !== 4) return false;
  if (!boxes.every((box, lane) =>
    isRecord(box) &&
    box.lane === lane &&
    Number.isInteger(box.queueIndex) && Number(box.queueIndex) >= 0 && Number(box.queueIndex) <= 3 &&
    Number.isInteger(box.count) && Number(box.count) >= 0 && Number(box.count) < 3
  )) return false;
  if (!Array.isArray(buffer) || buffer.length > 64) return false;
  if (!buffer.every((item) =>
    isRecord(item) &&
    typeof item.screwId === "string" &&
    validScrews.has(item.screwId) &&
    removed.includes(item.screwId) &&
    typeof item.color === "string" &&
    Number.isInteger(item.lane)
  )) return false;
  if (!(["playing", "won"] as unknown[]).includes(value.status)) return false;
  return (
    typeof value.paused === "boolean" &&
    Number.isInteger(value.moves) && Number(value.moves) >= 0 &&
    Number.isInteger(value.undosUsed) && Number(value.undosUsed) >= 0 && Number(value.undosUsed) <= 3 &&
    Number.isInteger(value.revision) && Number(value.revision) >= 0
  );
}

export function restoreSession(value: unknown): ScrewSession | null {
  if (!isRecord(value) || !isRecord(value.level) || typeof value.level.seed !== "string") return null;
  const level = generateLevel(value.level.seed);
  if (!verifyConstructiveSolution(level) || !validCore(level.seed, value.core)) return null;
  if (
    !Array.isArray(value.moveTrace) ||
    value.moveTrace.length > allScrews(level).length + 1 ||
    !value.moveTrace.every((id) => typeof id === "string")
  ) {
    return null;
  }
  let replayed = createSession(level.seed, 0);
  for (const screwId of value.moveTrace) {
    const result = applyScrewMove(replayed, screwId);
    if (!result.ok) return null;
    replayed = result.session;
  }

  const storedCore = value.core;
  const semanticStored = {
    removedScrewIds: storedCore.removedScrewIds,
    boxes: storedCore.boxes,
    buffer: storedCore.buffer,
    status: storedCore.status,
    moves: storedCore.moves,
  };
  const semanticReplay = {
    removedScrewIds: replayed.core.removedScrewIds,
    boxes: replayed.core.boxes,
    buffer: replayed.core.buffer,
    status: replayed.core.status,
    moves: replayed.core.moves,
  };
  if (JSON.stringify(semanticStored) !== JSON.stringify(semanticReplay)) return null;

  const restoredCore: CoreRunState = {
    ...replayed.core,
    undosUsed: storedCore.undosUsed,
    revision: storedCore.revision + 1,
    paused: storedCore.status === "playing",
    lastEvent: storedCore.status === "playing"
      ? { kind: "pause", paused: true }
      : replayed.core.lastEvent,
  };
  return {
    level,
    core: restoredCore,
    history: replayed.history,
    moveTrace: [...value.moveTrace],
    startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : Date.now(),
  };
}

function restoreStats(value: unknown): ScrewSortStats {
  if (!isRecord(value)) return { ...EMPTY_STATS };
  return {
    wins: Math.max(0, Math.floor(Number(value.wins) || 0)),
    bestMoves: Math.max(0, Math.floor(Number(value.bestMoves) || 0)),
    bestStars: Math.max(0, Math.min(3, Math.floor(Number(value.bestStars) || 0))),
    lastSeed: typeof value.lastSeed === "string" ? value.lastSeed : "",
  };
}

function freshSeed(): string {
  const entropy = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(entropy);
  return deriveSeed(Date.now(), entropy);
}

export function createGuestEngine(deps: GuestEngineDeps) {
  let storageWarningShown = false;
  let storageFailurePending = false;

  const surfaceStorageFailure = () => {
    if (!storageFailurePending) return;
    storageFailurePending = false;
    if (storageWarningShown) return;
    storageWarningShown = true;
    const message = deps.t("statusStorageUnavailable");
    deps.lastStatus.set(message);
    deps.setStatus(message, "warning");
  };

  const readStorage = <T>(key: string, fallback: T | null): T | null => {
    try {
      return deps.storage.get<T>(key, fallback);
    } catch {
      storageFailurePending = true;
      return fallback;
    }
  };

  const writeStorage = <T>(key: string, value: T): boolean => {
    try {
      deps.storage.set(key, value);
      // The framework's local-storage adapter intentionally degrades to a
      // no-op inside sandboxed/disabled storage contexts. A successful return
      // therefore is not proof that recovery data actually landed. Verify the
      // exact JSON-safe value before promising that this run can be restored.
      const readBack = deps.storage.get<T>(key, null);
      if (JSON.stringify(readBack) !== JSON.stringify(value)) {
        throw new Error("storage write did not round-trip");
      }
      return true;
    } catch {
      storageFailurePending = true;
      surfaceStorageFailure();
      return false;
    }
  };

  const publish = (session: ScrewSession, statusKey?: string, statusType: "success" | "error" | "info" | "warning" = "info") => {
    deps.session.set(session);
    if (statusKey) {
      const message = deps.t(statusKey);
      deps.lastStatus.set(message);
      deps.setStatus(message, statusType);
    }
    writeStorage(SESSION_STORAGE_KEY, session);
  };

  const startFresh = (seed = freshSeed()): ScrewSession => {
    const session = createSession(seed);
    const currentStats = deps.stats.get();
    let nextStats: ScrewSortStats | null = null;
    if (currentStats.lastSeed !== session.level.seed) {
      nextStats = { ...currentStats, lastSeed: session.level.seed };
      deps.stats.set(nextStats);
    }
    publish(session, "statusReady");
    if (nextStats) writeStorage(STATS_STORAGE_KEY, nextStats);
    return session;
  };

  return {
    enter(): ScrewSession {
      const rawSession = readStorage<unknown>(SESSION_STORAGE_KEY, null);
      const persisted = restoreSession(rawSession);
      const stats = restoreStats(readStorage<unknown>(STATS_STORAGE_KEY, EMPTY_STATS));
      deps.stats.set(stats);
      if (persisted) {
        publish(persisted, persisted.core.status === "playing" ? "statusRecovered" : "statusReady");
        surfaceStorageFailure();
        return persisted;
      }
      const session = startFresh(stats.lastSeed || "welcome-workshop");
      if (rawSession !== null) {
        const message = deps.t("statusProgressReset");
        deps.lastStatus.set(message);
        deps.setStatus(message, "warning");
      }
      surfaceStorageFailure();
      return session;
    },

    startGame(seed?: string): ScrewSession {
      return startFresh(seed);
    },

    selectScrew(screwId: string): boolean {
      const before = deps.session.get();
      const result = applyScrewMove(before, screwId);
      if (!result.ok) {
        const statusKey = result.reason === "blocked"
          ? "statusBlocked"
          : result.reason === "paused"
            ? "statusPaused"
            : "statusUnavailable";
        const message = deps.t(statusKey);
        deps.lastStatus.set(message);
        deps.setStatus(message, result.reason === "blocked" ? "warning" : "info");
        return false;
      }

      const after = result.session;
      if (after.core.status === "won" && before.core.status !== "won") {
        const current = deps.stats.get();
        const stars = computeStars(after.core);
        const next = {
          wins: current.wins + 1,
          bestMoves: current.bestMoves === 0
            ? after.core.moves
            : Math.min(current.bestMoves, after.core.moves),
          bestStars: Math.max(current.bestStars, stars),
          lastSeed: after.level.seed,
        };
        deps.stats.set(next);
        publish(after, "statusWon", "success");
        writeStorage(STATS_STORAGE_KEY, next);
        void deps.submitScore?.(Math.max(1, 10_000 - after.core.moves * 100)).catch(() => {
          const message = deps.t("statusLeaderboardUnavailable");
          deps.lastStatus.set(message);
          deps.setStatus(message, "warning");
        });
      } else if (after.core.lastEvent?.kind === "move") {
        if (after.core.lastEvent.destination === "buffer" && after.core.overflows > before.core.overflows) {
          publish(after, "statusOverflow", "info");
        } else {
          publish(
            after,
            after.core.lastEvent.destination === "buffer" ? "statusBuffered" : "statusSorted",
          );
        }
      } else {
        publish(after);
      }
      return true;
    },

    undo(): boolean {
      const before = deps.session.get();
      const after = undoMove(before);
      if (after === before) {
        const message = deps.t("statusUndoUnavailable");
        deps.lastStatus.set(message);
        deps.setStatus(message, "info");
        return false;
      }
      publish(after, "statusUndone");
      return true;
    },

    restart(): ScrewSession {
      const after = restartSession(deps.session.get());
      publish(after, "statusRestarted");
      return after;
    },

    newPuzzle(): ScrewSession {
      return startFresh();
    },

    togglePause(): boolean {
      const before = deps.session.get();
      const after = togglePause(before);
      if (after === before) return false;
      publish(after, after.core.paused ? "statusPaused" : "statusResumed");
      return true;
    },
  };
}
