/**
 * Guest (free / local) engine for Aim Master.
 *
 * Guest mode is a purely LOCAL target-shooting game: the reticle pattern is
 * seeded with the Web-Crypto RNG (the local analog of the enclave seed), played
 * and scored entirely client-side, and (optionally) submitted to the OFF-CHAIN
 * guest leaderboard. The engine drives the SAME observables + dispatch actions
 * the Phaser scene reads (gameStatus / pattern / targetAccuracy / ringsHit /
 * roundIndex / roundResults / lastStatus / deadline / dealtAt / ...), so the
 * frozen scene contract is reused verbatim.
 *
 * It NEVER makes a chain, oracle, or reward call — the framework guest guard
 * therefore never fires. Scoring reuses the pure `logic/aim-engine.ts` rules
 * (the same physics the enclave replays in gamefi).
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import { generateTargetPattern, totalPoints, type HitResult } from "./aim-engine";
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

/** The `aimHit` dispatch payload the scene emits on every tap. */
interface AimHitForm {
  ringsHit?: unknown;
  totalRings?: unknown;
  roundResults?: unknown;
  totalPoints?: unknown;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  pattern: Obs<string>;
  targetAccuracy: Obs<number>;
  ringsHit: Obs<number>;
  roundIndex: Obs<number>;
  roundResults: Obs<HitResult[]>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  aimHit(form: AimHitForm): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/**
 * Web-Crypto (Math.random fallback) 32-byte hex seed — the local stand-in for
 * the per-game enclave secret that seeds the deterministic target pattern.
 */
function randomSeed(): string {
  const bytes = new Uint8Array(32);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    pattern,
    targetAccuracy,
    ringsHit,
    roundIndex,
    roundResults,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Latest totalPoints reported by the scene's per-tap aimHit dispatch. Used as
  // the local run score (rewards precise shots, not just hit count).
  let lastPoints = 0;

  const resetRound = (): void => {
    obs.activeGameId.set("0");
    obs.commitment.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    pattern.set("");
    ringsHit.set(0);
    roundIndex.set(0);
    roundResults.set([]);
    lastPoints = 0;
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
      obs.lastStatus.set(t("guestLobbyStatus"));
      // Local target pattern from a Web-Crypto seed (no enclave, no chain).
      const positions = generateTargetPattern(randomSeed());
      resetRound();
      obs.gameDifficulty.set(diff);
      targetAccuracy.set(rule.targetAccuracy);
      obs.activeGameId.set(GUEST_GAME_ID);
      pattern.set(positions.join(","));
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.lastPayout.set("");
      obs.isStarting.set(false);
      // Set status last so the scene's dealt-transition sfx/reset run with the
      // pattern already in place.
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestDealt"));
    },

    aimHit(form: AimHitForm): void {
      if (obs.gameStatus.get() !== "dealt") return;
      const hitRings = Number(form.ringsHit ?? 0);
      const total = Number(form.totalRings ?? 0);
      const results = (form.roundResults ?? []) as HitResult[];
      ringsHit.set(Number.isFinite(hitRings) ? hitRings : 0);
      roundIndex.set(Number.isFinite(total) ? total : 0);
      roundResults.set(Array.isArray(results) ? results : []);
      const reported = Number(form.totalPoints);
      lastPoints = Number.isFinite(reported)
        ? reported
        : totalPoints((Array.isArray(results) ? results : []).map((r) => r.ring));
      // No enclave op-log stream in guest — scoring is fully local.
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.isSubmitting.get()) return;
      obs.isSubmitting.set(true);
      const points = Math.max(0, Math.round(lastPoints));
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      obs.lastPayout.set(t("guestScoreValue", { points }));
      obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), points));
      obs.mySolves.set(obs.mySolves.get() + 1);
      obs.activeGameId.set("0");
      obs.gameStatus.set("solved");
      obs.lastStatus.set(t("guestRunComplete", { points }));
      setStatus(t("guestRunComplete", { points }), "success");
      await submitScore(points);
      await refreshLeaderboard();
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
      resetRound();
      obs.gameStatus.set("expired");
      obs.lastStatus.set(t("guestExpired"));
      setStatus(t("guestExpired"), "info");
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetRound();
      obs.gameStatus.set("idle");
      obs.lastStatus.set(t("guestLobbyStatus"));
      obs.lastPayout.set("");
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
