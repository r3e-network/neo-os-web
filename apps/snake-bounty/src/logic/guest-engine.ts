/**
 * Guest (free / local) engine for Snake Bounty.
 *
 * Guest mode is a purely LOCAL snake game: the starting board (snake, food, and
 * the food queue) is generated with the Web-Crypto RNG (the local analog of the
 * enclave seed), played and scored entirely client-side, and (optionally)
 * submitted to the OFF-CHAIN guest leaderboard. The engine drives the SAME
 * observables + dispatch actions the Phaser scene reads
 * (gameStatus / clues / gameDifficulty / dealtAt / deadline / lastStatus / ...),
 * so the frozen scene contract is reused verbatim. It NEVER makes a chain,
 * oracle, or reward call — the framework guest guard therefore never fires.
 *
 * The SnakeScene already runs the snake gameplay locally (parses `clues`, ticks
 * the grid, detects growth / crash / target-reached). Guest mode simply replaces
 * the chain/TEE seal-and-bind (startGame) and the on-chain settlement
 * (submitSolution) with local equivalents, and records the completed trail
 * length off-chain instead of paying GAS. Reaching the target is the only path
 * that reaches submitSolution, so the guest score equals the trail target.
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import {
  GRID_SIZE,
  hasReachedTarget,
  parseInitialState,
  snakeLength,
  stateToClues,
  step,
} from "./snake-engine";
import type { Direction, Point, SnakeState } from "./snake-engine";
import { ruleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

interface GuestStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete?(key: string): void;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  clues: Obs<string>;
  currentLength: Obs<number>;
  snakeDead: Obs<boolean>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  storage?: GuestStorage;
  createClues?: (targetLength: number) => string;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  selectDifficulty(difficulty: number): void;
  /** Apply one authoritative local tick. The scene mirrors this same engine. */
  recordMove(dir: number): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "miniapp-snake-bounty:guest-profile:v1";
const GUEST_RUN_KEY = "miniapp-snake-bounty:guest-active-run:v1";
/** A few extra queued foods beyond the growth target keep the run playable. */
const FOOD_QUEUE_BUFFER = 4;

interface PersistedGuestRun {
  difficulty?: unknown;
  dealtAt?: unknown;
  deadline?: unknown;
  state?: unknown;
}

/** Uniform integer in [0, bound). Local board generation fails closed without Web Crypto. */
function randomBelow(bound: number): number {
  if (bound <= 1) return 0;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secureRandomUnavailable");
  const buf = new Uint32Array(1);
  const ceiling = Math.floor(0x1_0000_0000 / bound) * bound;
  do {
    webCrypto.getRandomValues(buf);
  } while ((buf[0] ?? 0) >= ceiling);
  return (buf[0] ?? 0) % bound;
}

/** In-place Fisher–Yates shuffle seeded from the Web-Crypto RNG. */
function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

/**
 * Build a valid initial board (the local analog of the enclave `clues`): a
 * 3-segment snake in the middle heading right, plus enough distinct random
 * empty cells to grow to the target length and beyond.
 */
export function buildInitialClues(targetLength: number): string {
  const body: Point[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  const occupied = new Set(body.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  shuffleInPlace(free);
  const foodsNeeded = Math.max(1, targetLength - body.length) + FOOD_QUEUE_BUFFER;
  const foods = free.slice(0, Math.min(free.length, foodsNeeded));
  return JSON.stringify({
    body,
    direction: 1, // right — away from the tail, never an instant reversal
    food: foods[0],
    foodQueue: foods.slice(1),
  });
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const { obs, clues, currentLength, snakeDead, guestLeaderboard, t, setStatus } = deps;
  const storage: GuestStorage | undefined = deps.storage ?? (() => {
    try {
      const local = globalThis.localStorage;
      return {
        get<T>(key: string, fallback: T | null = null): T | null {
          const raw = local.getItem(key);
          return raw === null ? fallback : JSON.parse(raw) as T;
        },
        set(key: string, value: unknown): void { local.setItem(key, JSON.stringify(value)); },
        delete(key: string): void { local.removeItem(key); },
      };
    } catch {
      return undefined;
    }
  })();
  let guestState: SnakeState | null = null;

  const readProfile = (): { bestLength: number; solves: number } => {
    try {
      const parsed = storage?.get<{
        bestLength?: unknown;
        solves?: unknown;
      }>(GUEST_PROFILE_KEY, null) ?? null;
      return {
        bestLength: Math.max(0, Math.floor(Number(parsed?.bestLength) || 0)),
        solves: Math.max(0, Math.floor(Number(parsed?.solves) || 0)),
      };
    } catch {
      return { bestLength: 0, solves: 0 };
    }
  };

  const writeProfile = (bestLength: number, solves: number): void => {
    try {
      storage?.set(GUEST_PROFILE_KEY, { bestLength, solves });
    } catch {
      /* Private-mode/local quota failures must never break a free run. */
    }
  };

  const clearActiveRun = (): void => {
    try {
      if (storage?.delete) storage.delete(GUEST_RUN_KEY);
      else storage?.set(GUEST_RUN_KEY, null);
    } catch {
      /* A terminal local run is already complete even if storage cleanup fails. */
    }
  };

  const saveActiveRun = (): void => {
    if (!guestState || obs.gameStatus.get() !== "dealt") return;
    try {
      storage?.set(GUEST_RUN_KEY, {
        difficulty: obs.gameDifficulty.get(),
        dealtAt: obs.dealtAt.get(),
        deadline: obs.deadline.get(),
        state: stateToClues(guestState),
      } satisfies PersistedGuestRun);
    } catch {
      /* Private-mode/quota failures must not interrupt an active local run. */
    }
  };

  const restoreActiveRun = (): boolean => {
    try {
      const raw = storage?.get<PersistedGuestRun>(GUEST_RUN_KEY, null) ?? null;
      if (!raw || typeof raw.state !== "string") return false;
      const difficulty = clampDifficulty(Number(raw.difficulty));
      const dealtAt = Math.floor(Number(raw.dealtAt));
      const deadline = Math.floor(Number(raw.deadline));
      const rule = ruleOf(difficulty);
      if (
        !Number.isFinite(dealtAt)
        || !Number.isFinite(deadline)
        || dealtAt <= 0
        || deadline <= Date.now()
        || deadline <= dealtAt
        || deadline - dealtAt !== rule.limitMs
      ) {
        clearActiveRun();
        return false;
      }
      const restored = parseInitialState(raw.state);
      if (restored.body.length < 3 || restored.body.length > GRID_SIZE * GRID_SIZE) {
        clearActiveRun();
        return false;
      }
      guestState = restored;
      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.dealtAt.set(dealtAt);
      obs.deadline.set(deadline);
      obs.gameStatus.set("dealt");
      clues.set(stateToClues(restored));
      currentLength.set(snakeLength(restored));
      snakeDead.set(restored.dead);
      obs.lastStatus.set(t("guestRunRecovered"));
      return true;
    } catch {
      clearActiveRun();
      return false;
    }
  };

  const resetToLobby = (clearPersisted = true): void => {
    if (clearPersisted) clearActiveRun();
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.commitment.set("");
    obs.dealtAt.set(0);
    obs.deadline.set(0);
    obs.undosUsed.set(0);
    obs.lastPayout.set("");
    obs.lastElapsedMs.set(0);
    obs.isStarting.set(false);
    obs.isDealing.set(false);
    obs.isSubmitting.set(false);
    guestState = null;
    currentLength.set(3);
    snakeDead.set(false);
    clues.set("");
    obs.lastStatus.set(t("statusReady"));
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
    }
  };

  const refreshLeaderboard = async (): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const ranked: LeaderEntry[] = rows
        .map((row) => ({ address: row.user, score: Number(row.score) || 0 }))
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({
          rank: index + 1,
          address: row.address,
          totalWon: row.score,
          solves: 1,
          isUser: false,
        }));
      obs.leaderboard.set(ranked);
    } catch {
      obs.leaderboard.set([]);
    }
  };

  return {
    startGame(difficulty: number): void {
      if (obs.isStarting.get() || obs.gameStatus.get() === "dealt") return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      obs.isStarting.set(true);
      try {
        const initialClues = (deps.createClues ?? buildInitialClues)(rule.targetLength);
        guestState = parseInitialState(initialClues);
        const now = Date.now();
        obs.lastStatus.set(t("guestStatusDealt"));
        obs.gameDifficulty.set(diff);
        obs.activeGameId.set(GUEST_GAME_ID);
        obs.commitment.set("");
        obs.undosUsed.set(0);
        obs.lastPayout.set("");
        obs.lastElapsedMs.set(0);
        clues.set(initialClues);
        currentLength.set(snakeLength(guestState));
        snakeDead.set(false);
        obs.dealtAt.set(now);
        obs.deadline.set(now + rule.limitMs);
        obs.gameStatus.set("dealt");
        saveActiveRun();
      } catch (error) {
        resetToLobby();
        const message = error instanceof Error && error.message === "secureRandomUnavailable"
          ? t("secureRandomUnavailable")
          : t("statusFailed");
        obs.lastStatus.set(message);
        setStatus(message, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    },

    selectDifficulty(difficulty: number): void {
      obs.gameDifficulty.set(clampDifficulty(difficulty));
    },

    recordMove(dir: number): void {
      if (
        obs.gameStatus.get() !== "dealt"
        || !guestState
        || guestState.dead
        || Date.now() > obs.deadline.get()
        || !Number.isInteger(dir)
        || dir < 0
        || dir > 3
      ) return;
      guestState = step(guestState, dir as Direction);
      currentLength.set(snakeLength(guestState));
      snakeDead.set(guestState.dead);
      saveActiveRun();
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      const rule = ruleOf(obs.gameDifficulty.get());
      const state = guestState;
      if (
        !state
        || state.dead
        || Date.now() > obs.deadline.get()
        || !hasReachedTarget(state, rule.targetLength)
      ) {
        const msg = t("guestRunIncomplete");
        obs.lastStatus.set(msg);
        setStatus(msg, "warning");
        return;
      }
      obs.isSubmitting.set(true);
      const score = snakeLength(state);
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      obs.lastPayout.set(String(score));
      obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), score));
      obs.mySolves.set(obs.mySolves.get() + 1);
      writeProfile(obs.myTotalWon.get(), obs.mySolves.get());
      obs.gameStatus.set("solved");
      obs.activeGameId.set("0");
      guestState = null;
      clearActiveRun();
      obs.lastStatus.set(t("guestRunComplete", { count: score }));
      obs.isSubmitting.set(false);
      setStatus(t("guestRunComplete", { count: score }), "success");
      await submitScore(score);
      await refreshLeaderboard();
    },

    expireGame(): void {
      resetToLobby();
    },

    retryDeal(): void {
      /* guest deals instantly — there is nothing to re-seal. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby(false);
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      const profile = readProfile();
      obs.myTotalWon.set(profile.bestLength);
      obs.mySolves.set(profile.solves);
      obs.myHistory.set([]);
      const restored = restoreActiveRun();
      await refreshLeaderboard();
      if (!restored) obs.lastStatus.set(t("statusReady"));
    },
  };
}
