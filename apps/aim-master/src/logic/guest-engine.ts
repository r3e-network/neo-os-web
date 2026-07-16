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
import {
  evaluateHitResults,
  generateDifficultyPattern,
  type HitResult,
} from "./aim-engine";
import { ruleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

interface GuestStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
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
  scorePoints: Obs<number>;
  combo: Obs<number>;
  maxCombo: Obs<number>;
  guestLeaderboard: GuestLeaderboardApi;
  storage?: GuestStorage;
  seedSource?: () => string;
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
const GUEST_PROFILE_KEY = "miniapp-aim-master:guest-profile:v1";

/**
 * Web-Crypto 32-byte hex seed — the local stand-in for the per-game enclave
 * secret that seeds the deterministic target pattern. Guest play fails closed
 * when a secure RNG is unavailable; Math.random must never silently shape a
 * score-bearing run.
 */
export function secureRandomSeed(
  cryptoApi: Pick<Crypto, "getRandomValues"> | null = globalThis.crypto,
): string {
  const bytes = new Uint8Array(32);
  if (!cryptoApi?.getRandomValues) throw new Error("secure-random-unavailable");
  cryptoApi.getRandomValues(bytes);
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
    scorePoints,
    combo,
    maxCombo,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;
  const storage = deps.storage;
  const seedSource = deps.seedSource ?? secureRandomSeed;

  const readProfile = (): { bestScore: number; solves: number } => {
    try {
      const saved = storage?.get<{ bestScore?: unknown; solves?: unknown }>(
        GUEST_PROFILE_KEY,
        null,
      ) ?? null;
      return {
        bestScore: Math.max(0, Math.floor(Number(saved?.bestScore) || 0)),
        solves: Math.max(0, Math.floor(Number(saved?.solves) || 0)),
      };
    } catch {
      return { bestScore: 0, solves: 0 };
    }
  };

  const writeProfile = (bestScore: number, solves: number): void => {
    try {
      storage?.set(GUEST_PROFILE_KEY, { bestScore, solves });
    } catch {
      /* Private-mode/quota failures must never invalidate a completed run. */
    }
  };

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
    scorePoints.set(0);
    combo.set(0);
    maxCombo.set(0);
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
      if (
        obs.isStarting.get()
        || obs.isSubmitting.get()
        || obs.gameStatus.get() === "dealt"
        || obs.gameStatus.get() === "committed"
      ) return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      obs.isStarting.set(true);
      obs.lastStatus.set(t("guestLobbyStatus"));
      let positions: number[];
      try {
        // Local target pattern from a Web-Crypto seed (no enclave, no chain).
        // Cover the whole run instead of looping a short, learnable 12-second
        // sample for a 60/90/120-second lane.
        positions = generateDifficultyPattern(seedSource(), diff, rule.limitMs);
      } catch {
        obs.isStarting.set(false);
        obs.lastStatus.set(t("guestEntropyUnavailable"));
        setStatus(t("guestEntropyUnavailable"), "error");
        return;
      }
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
      if (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get()) {
        this.expireGame();
        return;
      }

      // ringsHit / totalRings / totalPoints are intentionally ignored. Rebuild
      // the state from signed offsets and only accept an append-only shot log.
      const next = evaluateHitResults(form.roundResults);
      const previous = evaluateHitResults(roundResults.get());
      // One user gesture may append exactly one shot. Rejecting bulk injection
      // keeps the local leaderboard honest about the interaction path (while it
      // remains explicitly non-economic and off-chain).
      if (next.results.length !== previous.results.length + 1) return;
      const prefixMatches = previous.results.every(
        (result, index) => result.offset === next.results[index]?.offset,
      );
      if (!prefixMatches) return;

      roundResults.set(next.results);
      ringsHit.set(next.summary.accuracyHits);
      roundIndex.set(next.summary.totalShots);
      scorePoints.set(next.summary.score);
      combo.set(next.summary.combo);
      maxCombo.set(next.summary.maxCombo);
      // No enclave op-log stream in guest — scoring is fully local but derived
      // from the canonical shot log, never from client counters.
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.isSubmitting.get()) return;
      if (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get()) {
        this.expireGame();
        return;
      }
      if (ringsHit.get() < targetAccuracy.get()) return;
      obs.isSubmitting.set(true);
      try {
        // Re-evaluate once more at the settlement boundary so even a mutated
        // observable cannot turn UI counters into authority.
        const evaluated = evaluateHitResults(roundResults.get());
        if (evaluated.summary.accuracyHits < targetAccuracy.get()) return;
        const points = evaluated.summary.score;
        const profile = readProfile();
        const nextProfile = {
          bestScore: Math.max(profile.bestScore, points),
          solves: profile.solves + 1,
        };
        writeProfile(nextProfile.bestScore, nextProfile.solves);
        obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
        obs.lastPayout.set(t("guestScoreValue", { points }));
        obs.myTotalWon.set(nextProfile.bestScore);
        obs.mySolves.set(nextProfile.solves);
        obs.activeGameId.set("0");
        obs.gameStatus.set("solved");
        obs.lastStatus.set(t("guestRunComplete", { points }));
        setStatus(t("guestRunComplete", { points }), "success");
        await submitScore(points);
        await refreshLeaderboard();
      } finally {
        obs.isSubmitting.set(false);
      }
    },

    expireGame(): void {
      if (obs.gameStatus.get() !== "dealt" && obs.gameStatus.get() !== "committed") return;
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
      const profile = readProfile();
      obs.myTotalWon.set(profile.bestScore);
      obs.mySolves.set(profile.solves);
      obs.myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
