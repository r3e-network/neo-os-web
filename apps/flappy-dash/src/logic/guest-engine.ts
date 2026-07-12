/**
 * Guest (free / local) engine for Flappy Dash.
 *
 * Guest mode is a purely LOCAL runner: the pipe seed is generated with the
 * Web-Crypto RNG (the local analog of the enclave seed), the flight is played
 * and scored entirely client-side by the Phaser scene (which owns the physics
 * via `logic/flappy-engine.ts`), and the final score is (optionally) submitted
 * to the OFF-CHAIN guest leaderboard.
 *
 * The engine drives the SAME observables + dispatch actions the scene reads
 * (gameStatus / seed / deadline / pipesPassed / lastStatus / ...), so the frozen
 * scene contract is reused verbatim. It NEVER makes a chain, oracle, or reward
 * call — the framework guest guard therefore never fires.
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
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

/** app.storage.local surface (framework-owned, localStorage-backed). */
interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  seed: Obs<string>;
  pipesPassed: Obs<number>;
  guestLeaderboard: GuestLeaderboardApi;
  storage: LocalStore;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordFlap(pipes: number): void;
  syncScore(pipes: number): void;
  submitSolution(pipes: number): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "guest:profile";

interface GuestProfile {
  bestScore: number;
  clears: number;
}

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Web-Crypto (Math.random fallback) 32-char hex seed — local analog of the enclave seed. */
function randomSeed(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const { obs, seed, pipesPassed, guestLeaderboard, storage, t, setStatus } = deps;

  const loadProfile = (): GuestProfile => {
    try {
      const raw = storage.get<Partial<GuestProfile>>(GUEST_PROFILE_KEY, {});
      const bestScore = Math.max(0, Math.floor(Number(raw?.bestScore) || 0));
      const clears = Math.max(0, Math.floor(Number(raw?.clears) || 0));
      return { bestScore, clears };
    } catch {
      return { bestScore: 0, clears: 0 };
    }
  };

  const saveProfile = (profile: GuestProfile): void => {
    try {
      storage.set(GUEST_PROFILE_KEY, profile);
    } catch {
      // A storage policy or quota failure must never block local play.
    }
  };

  const resetToLobby = (): void => {
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.lastStatus.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.commitment.set("");
    obs.lastPayout.set("");
    obs.lastElapsedMs.set(0);
    obs.isStarting.set(false);
    obs.isDealing.set(false);
    obs.isSubmitting.set(false);
    seed.set("");
    pipesPassed.set(0);
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
      if (obs.isStarting.get()) return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      obs.isStarting.set(true);
      // Fresh local seed — the scene hashes it into a deterministic pipe layout.
      const localSeed = randomSeed();
      obs.gameDifficulty.set(diff);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      pipesPassed.set(0);
      seed.set(localSeed);
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      // Set the "dealt" trigger LAST so the scene reads the fresh seed with it.
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestStatusDealt"));
      obs.isStarting.set(false);
    },

    recordFlap(pipes: number): void {
      if (obs.gameStatus.get() !== "dealt") return;
      const next = Number.isFinite(pipes) ? pipes : 0;
      pipesPassed.set(Math.max(pipesPassed.get(), next));
    },

    syncScore(pipes: number): void {
      if (obs.gameStatus.get() !== "dealt") return;
      const next = Number.isFinite(pipes) ? Math.max(0, pipes) : 0;
      pipesPassed.set(next);
    },

    async submitSolution(pipes: number): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.isSubmitting.get()) return;
      obs.isSubmitting.set(true);
      const reported = Number.isFinite(pipes) ? pipes : 0;
      const score = Math.max(pipesPassed.get(), reported);
      const cleared = score >= ruleOf(obs.gameDifficulty.get()).targetPipes;
      const profile = loadProfile();
      const nextProfile = {
        bestScore: Math.max(profile.bestScore, score),
        clears: profile.clears + (cleared ? 1 : 0),
      };
      saveProfile(nextProfile);
      pipesPassed.set(score);
      obs.myTotalWon.set(nextProfile.bestScore);
      obs.mySolves.set(nextProfile.clears);
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      obs.lastPayout.set(t("guestLastPayout", { pipes: score }));
      const statusKey = cleared ? "guestRunComplete" : "guestScoreSaved";
      obs.gameStatus.set(cleared ? "solved" : "expired");
      obs.lastStatus.set(t(statusKey, { count: score }));
      obs.activeGameId.set("0");
      await submitScore(score);
      await refreshLeaderboard();
      setStatus(t(statusKey, { count: score }), cleared ? "success" : "info");
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
      obs.gameStatus.set("expired");
      obs.activeGameId.set("0");
      obs.lastStatus.set(t("guestExpired"));
      seed.set("");
      pipesPassed.set(0);
      setStatus(t("guestExpired"), "info");
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
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
      const profile = loadProfile();
      obs.myTotalWon.set(profile.bestScore);
      obs.mySolves.set(profile.clears);
      obs.myHistory.set([]);
      obs.lastStatus.set(t("guestStatusReady"));
      await refreshLeaderboard();
    },
  };
}
