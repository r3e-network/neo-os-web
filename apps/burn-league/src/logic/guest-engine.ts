/**
 * Guest (free / local) engine for Burn League.
 *
 * Guest mode is a purely LOCAL single-player "burn streak" challenge: the player
 * stokes a fire with fuel capsules, each stoke rolls a Web-Crypto RNG heat
 * multiplier and adds to the current run's heat while a streak builds. Push your
 * luck — bank deliberately, because past a safe window each stoke risks a
 * flare-out that loses the unbanked heat and starts a fresh run.
 *
 * The engine drives the SAME observables + dispatch actions the Phaser scene
 * reads (seasonPhase / prizePoolDisplay / userBurnedDisplay / formattedRank /
 * leaderboardPreview / isBurning / actionNotice / ...), reusing the frozen scene
 * contract verbatim. It makes ZERO chain / oracle / reward calls — the framework
 * guest guard therefore never fires. All randomness comes from
 * crypto.getRandomValues (the local analog of the enclave seed), and the only
 * off-chain touch is the best-effort guest leaderboard after a deliberate bank.
 */
import type { LeaderEntry } from "../composables/useBurnLeague";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

interface SettleResult {
  won: boolean;
  amount: string;
  token: number;
}

export interface GuestEngineDeps {
  // ── Base observables the guest engine drives (derived displays follow) ──────
  rewardPool: Obs<number>;
  totalBurned: Obs<number>;
  userBurned: Obs<number>;
  rank: Obs<number>;
  burnCount: Obs<number>;
  leaderboard: Obs<LeaderEntry[]>;
  isBurning: Obs<boolean>;
  isSettling: Obs<boolean>;
  seasonId: Obs<number>;
  seasonEndMs: Obs<number>;
  topBurnerAddress: Obs<string | null>;
  topBurnedGas: Obs<number>;
  prepaidCredit: Obs<number>;
  actionNotice: Obs<string>;
  serviceNotice: Obs<string>;
  burnValidationError: Obs<string | null>;
  lastSettleResult: Obs<SettleResult | null>;
  burnAmount: Obs<string>;
  minBurnGas: Obs<number>;
  maxBurnGas: Obs<number>;
  /** Guest-only streak counter surfaced to the PlayArea/scene (new bridge key). */
  guestStreak: Obs<number>;
  /** Connected wallet address (optional) — for guest-board self-marking. */
  address: Obs<string | null>;
  // ── Off-chain board + i18n / status ────────────────────────────────────────
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  /** Stoke the fire once (backs the `burn` dispatch action in guest mode). */
  stoke(amount?: unknown): void;
  /** Safely bank the current run before the next flare-out check. */
  bank(): boolean;
  /** Reset to a clean local lobby + load the off-chain guest board. */
  enter(): Promise<void>;
  /** Clear any pending stoke timer (component cleanup). */
  dispose(): void;
}

// ── Tuning ────────────────────────────────────────────────────────────────
/** Stokes that are always flare-proof (a gentle on-ramp before the risk grows). */
const SAFE_STOKES = 3;
/** Added flare-out probability per streak beyond the safe window. */
const RISK_STEP = 0.07;
/** Cap on flare-out probability so a long streak is never a coin-flip-or-worse. */
const MAX_RISK = 0.55;
/** RNG heat multiplier band applied to the fuel of each successful stoke. */
const HEAT_MIN = 0.8;
const HEAT_MAX = 2.0;
/** Extra heat per point of streak (rewards pushing the run further). */
const STREAK_BONUS = 0.05;
/** Chance a successful stoke "surges" for double heat. */
const SURGE_CHANCE = 0.1;
/** Local burn animation window before the outcome resolves (ms). */
const BURN_MS = 280;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Web-Crypto float in [0, 1); chance play never downgrades to Math.random. */
function rand01(): number {
  const buf = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error("secure-random-unavailable");
  }
  try {
    webCrypto.getRandomValues(buf);
    return buf[0]! / 4294967296;
  } catch {
    throw new Error("secure-random-unavailable");
  }
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    rewardPool,
    totalBurned,
    userBurned,
    rank,
    burnCount,
    leaderboard,
    isBurning,
    isSettling,
    seasonId,
    seasonEndMs,
    topBurnerAddress,
    topBurnedGas,
    prepaidCredit,
    actionNotice,
    serviceNotice,
    burnValidationError,
    lastSettleResult,
    burnAmount,
    minBurnGas,
    maxBurnGas,
    guestStreak,
    address,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Engine-local run state (never surfaced directly; drives the observables).
  let runHeat = 0;
  let bestHeat = 0;
  let boardRanked: LeaderEntry[] = [];
  let burnTimer: ReturnType<typeof setTimeout> | null = null;
  let leaderboardSync = Promise.resolve();

  const clearTimer = (): void => {
    if (burnTimer !== null) {
      clearTimeout(burnTimer);
      burnTimer = null;
    }
  };

  const clampFuel = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return NaN;
    const min = minBurnGas.get() || 1;
    const max = maxBurnGas.get() || 1000;
    return clamp(value, min, max);
  };

  const projectRank = (heat: number): void => {
    if (heat <= 0) {
      rank.set(0);
      return;
    }
    const better = boardRanked.filter((entry) => entry.burned > heat).length;
    rank.set(better + 1);
  };

  const refreshBoard = async (): Promise<void> => {
    let rows: Array<{ user: string; score: string }> = [];
    try {
      rows = await guestLeaderboard.get(50);
    } catch {
      rows = [];
    }
    const me = (address.get() ?? "").trim().toLowerCase();
    boardRanked = rows
      .map((row) => ({ address: String(row.user ?? "").trim(), burned: Number(row.score) || 0 }))
      .filter((row) => row.address.length > 0)
      .sort((a, b) => b.burned - a.burned)
      .map((row, index) => ({
        rank: index + 1,
        address: row.address,
        burned: row.burned,
        isUser: me.length > 0 && row.address.toLowerCase() === me,
      }));
    leaderboard.set(boardRanked);
    const top = boardRanked[0];
    topBurnerAddress.set(top?.address ?? "");
    topBurnedGas.set(top?.burned ?? 0);
    const myBest = boardRanked
      .filter((entry) => entry.isUser)
      .reduce((value, entry) => Math.max(value, entry.burned), 0);
    bestHeat = Math.max(bestHeat, myBest);
    rewardPool.set(bestHeat);
    totalBurned.set(bestHeat);
  };

  const submitBankedScore = (score: number): void => {
    leaderboardSync = leaderboardSync.then(async () => {
      if (score > 0) {
        try {
          // Off-chain, best-effort — wallet optional; a wallet-less guest simply
          // doesn't get a board row. Never touches chain/oracle/reward.
          await guestLeaderboard.submit(score);
        } catch {
          /* guest board unreachable / no wallet — scores are best-effort */
        }
      }
      await refreshBoard();
      projectRank(runHeat);
    });
    void leaderboardSync;
  };

  const succeed = (fuel: number): void => {
    const heatMult = HEAT_MIN + rand01() * (HEAT_MAX - HEAT_MIN);
    const streakBonus = 1 + guestStreak.get() * STREAK_BONUS;
    const surge = rand01() < SURGE_CHANCE;
    const gained = Math.max(1, Math.round(fuel * heatMult * streakBonus * (surge ? 2 : 1)));
    const nextStreak = guestStreak.get() + 1;

    runHeat += gained;
    guestStreak.set(nextStreak);
    userBurned.set(runHeat);
    burnCount.set(burnCount.get() + 1);
    projectRank(runHeat);

    const msg = surge
      ? t("guestSurge", { gained, streak: nextStreak })
      : t("guestStoked", { gained, streak: nextStreak });
    actionNotice.set(msg);
    setStatus(msg, "success");
  };

  const flareOut = (): void => {
    const lostScore = Math.round(runHeat);
    const reached = guestStreak.get();
    runHeat = 0;
    guestStreak.set(0);
    userBurned.set(0);
    projectRank(0);

    const msg = t("guestFlareOut", { score: lostScore, streak: reached });
    actionNotice.set(msg);
    setStatus(msg, "warning");
  };

  const resolveStoke = (fuel: number): void => {
    // The stoke has "landed" — drop the burning flag so the scene fires its
    // one-shot reveal cue on the true→false transition.
    isBurning.set(false);
    try {
      const streak = guestStreak.get();
      // `streak` is the number already completed, so the first risky attempt is
      // the one immediately after SAFE_STOKES (3 completed -> stoke #4).
      const flareProb = clamp((streak - SAFE_STOKES + 1) * RISK_STEP, 0, MAX_RISK);
      if (streak >= SAFE_STOKES && rand01() < flareProb) {
        flareOut();
      } else {
        succeed(fuel);
      }
    } catch {
      const msg = t("guestSecureRandomUnavailable");
      burnValidationError.set(msg);
      actionNotice.set(msg);
      setStatus(msg, "error");
    }
  };

  return {
    stoke(amount?: unknown): void {
      if (isBurning.get()) return;
      const requested = amount === undefined || amount === null || amount === ""
        ? Number(burnAmount.get())
        : Number(amount);
      const fuel = clampFuel(requested);
      if (!(fuel > 0)) {
        const msg = t("guestFuelInvalid", {
          min: minBurnGas.get() || 1,
          max: maxBurnGas.get() || 1000,
        });
        burnValidationError.set(msg);
        setStatus(msg, "error");
        return;
      }
      burnValidationError.set(null);
      isBurning.set(true);
      actionNotice.set(t("guestStoking"));
      clearTimer();
      burnTimer = setTimeout(() => {
        burnTimer = null;
        resolveStoke(fuel);
      }, BURN_MS);
    },

    bank(): boolean {
      if (isBurning.get() || !(runHeat > 0)) return false;
      const score = Math.round(runHeat);
      const reached = guestStreak.get();
      runHeat = 0;
      bestHeat = Math.max(bestHeat, score);
      rewardPool.set(bestHeat);
      totalBurned.set(bestHeat);
      userBurned.set(0);
      guestStreak.set(0);
      projectRank(0);
      const msg = t("guestBanked", { score, streak: reached });
      actionNotice.set(msg);
      setStatus(msg, "success");
      submitBankedScore(score);
      return true;
    },

    async enter(): Promise<void> {
      clearTimer();
      runHeat = 0;
      bestHeat = 0;
      // A dormant, id-less "season" so the scene keeps burns enabled while the
      // PlayArea auto-hides the GAS season/countdown badges (no reward framing).
      seasonId.set(0);
      seasonEndMs.set(0);
      rewardPool.set(0);
      totalBurned.set(0);
      userBurned.set(0);
      rank.set(0);
      burnCount.set(0);
      topBurnerAddress.set("");
      topBurnedGas.set(0);
      // Guest never has on-chain credit / settle / pending results.
      prepaidCredit.set(0);
      isBurning.set(false);
      isSettling.set(false);
      burnValidationError.set(null);
      serviceNotice.set("");
      lastSettleResult.set(null);
      guestStreak.set(0);
      actionNotice.set(t("guestIntro"));
      await leaderboardSync;
      await refreshBoard();
      projectRank(0);
    },

    dispose(): void {
      clearTimer();
      // A mode switch can happen during the 280ms stoke reveal. Cancel the
      // local result and release the shared busy flag before GameFi state loads.
      isBurning.set(false);
    },
  };
}
