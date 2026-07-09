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
import { GRID_SIZE } from "./snake-engine";
import type { Point } from "./snake-engine";
import { ruleOf } from "./game-rules";

/** Structural (method-syntax, so bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  clues: Obs<string>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  selectDifficulty(difficulty: number): void;
  /** No-op: the scene simulates the snake locally, so moves need no recording. */
  recordMove(dir: number): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
/** A few extra queued foods beyond the growth target keep the run playable. */
const FOOD_QUEUE_BUFFER = 4;

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Web-Crypto (Math.random fallback) integer in [0, bound). */
function randomBelow(bound: number): number {
  if (bound <= 0) return 0;
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    webCrypto.getRandomValues(buf);
    return buf[0]! % bound;
  }
  return Math.floor(Math.random() * bound);
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
function buildInitialClues(targetLength: number): string {
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
  const { obs, clues, guestLeaderboard, t, setStatus } = deps;

  const resetToLobby = (): void => {
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
      obs.lastStatus.set(t("guestStatusDealt"));
      obs.gameDifficulty.set(diff);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      obs.lastPayout.set("");
      obs.lastElapsedMs.set(0);
      clues.set(buildInitialClues(rule.targetLength));
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.gameStatus.set("dealt");
      obs.isStarting.set(false);
    },

    selectDifficulty(difficulty: number): void {
      obs.gameDifficulty.set(clampDifficulty(difficulty));
    },

    recordMove(_dir: number): void {
      /* The scene owns the local snake simulation; nothing to record off-chain. */
    },

    async submitSolution(): Promise<void> {
      // Only the target-reached overlay reaches submitSolution in guest mode
      // (a crash routes to expireGame → lobby), so the run score is the trail
      // target length — the exact length the snake grew to on a clean clear.
      if (obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      obs.isSubmitting.set(true);
      const rule = ruleOf(obs.gameDifficulty.get());
      const score = rule.targetLength;
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      obs.lastPayout.set(String(score));
      obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), score));
      obs.mySolves.set(obs.mySolves.get() + 1);
      obs.gameStatus.set("solved");
      obs.activeGameId.set("0");
      obs.lastStatus.set(t("guestRunComplete", { count: score }));
      await submitScore(score);
      await refreshLeaderboard();
      setStatus(t("guestRunComplete", { count: score }), "success");
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
      resetToLobby();
    },

    retryDeal(): void {
      /* guest deals instantly — there is nothing to re-seal. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      obs.myTotalWon.set(0);
      obs.mySolves.set(0);
      obs.myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
