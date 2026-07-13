/**
 * Guest (free / local) engine for OneGate Vault — a purely LOCAL lucky draw.
 *
 * Guest mode turns the vault into a stakes-free lucky-draw game: the player picks
 * a luck tier and taps Draw, a random prize (local "luck points") is rolled with
 * the Web-Crypto RNG (the local analog of the enclave seed), and the signature
 * reward reveal fires on the canvas. The engine drives the SAME observables the
 * frozen Phaser scene reads (lastClaimAmount / lastClaimLuckPercent / …) so the
 * scene reacts identically to the gamefi claim flow — no scene changes needed.
 *
 * It NEVER makes a chain, oracle, or reward call: no app.chain / app.oracle /
 * app.funds / app.game.reward. Scores are best-effort submitted to the OFF-CHAIN
 * guest leaderboard (app.mode.guestLeaderboard) and read back for a local board.
 * The framework guest guard therefore never fires in normal guest play.
 */
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

/** One row of the local (off-chain) luck board. */
export interface GuestBoardRow {
  user: string;
  score: number;
}

/** A draw range in whole "luck points" (GAS-equivalent, but framed as points). */
export interface GuestRange {
  min: number;
  max: number;
}

export interface GuestEngineDeps {
  // Scene-facing observables (same keys the gamefi flow drives).
  lastClaimAmount: Obs<bigint>;
  lastClaimLuckPercent: Obs<string>;
  lastError: Obs<string>;
  lastTxid: Obs<string>;
  lastSuccessType: Obs<string>;
  claimStatus: Obs<string>;
  claimProgress: Obs<string>;
  currentClaimKey: Obs<string>;
  currentPoolId: Obs<string>;
  currentPool: Obs<unknown>;
  recentPools: Obs<unknown[]>;
  recentClaims: Obs<unknown[]>;
  gasCredit: Obs<bigint>;
  // Guest-only stat observables surfaced to the PlayArea.
  guestBest: Obs<number>;
  guestLast: Obs<number>;
  guestDraws: Obs<number>;
  guestBoard: Obs<GuestBoardRow[]>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  /** Roll a local prize inside `range` and reveal it on the canvas. */
  draw(range: GuestRange): boolean;
  /** Reset to a clean local lobby + load the off-chain guest board. */
  enter(options?: { preserveClaimContext?: boolean }): Promise<void>;
  /** Reload the off-chain guest board into the guest board observable. */
  refreshLeaderboard(): Promise<void>;
}

const ONE_POINT_FIXED8 = 100000000n;
/** Board scores are stored as centi-points integers to keep the board clean. */
const SCORE_SCALE = 100;
const MIN_GUEST_POINT = 1;
const MAX_GUEST_POINT = 50;

/** Keep every caller — including host-dispatched payloads — inside game rules. */
export function normalizeGuestRange(range: GuestRange): GuestRange {
  const rawMin = Number(range.min);
  const rawMax = Number(range.max);
  const min = Math.max(
    MIN_GUEST_POINT,
    Math.min(MAX_GUEST_POINT, Number.isFinite(rawMin) ? rawMin : MIN_GUEST_POINT),
  );
  const max = Math.max(
    min,
    Math.min(MAX_GUEST_POINT, Number.isFinite(rawMax) ? rawMax : min),
  );
  return { min, max };
}

/**
 * Web Crypto uniform float in [0, 1).
 *
 * A chance game must never silently downgrade to Math.random. Embedded
 * WebViews without a working CSPRNG fail closed and leave the previous score
 * untouched; the caller can then show a recoverable error instead of a result
 * that looks secure but is not.
 */
function secureRandomUint32(): number {
  const buffer = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error("secure-random-unavailable");
  }
  try {
    webCrypto.getRandomValues(buffer);
  } catch {
    throw new Error("secure-random-unavailable");
  }
  return buffer[0] ?? 0;
}

export function secureRandomUnit(): number {
  return secureRandomUint32() / 0x100000000;
}

/** Uniform integer selection with rejection sampling (no modulo bias). */
export function secureRandomIntegerInclusive(min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  const span = upper - lower + 1;
  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || span < 1 || span > 0x100000000) {
    throw new Error("invalid-secure-random-range");
  }
  const limit = Math.floor(0x100000000 / span) * span;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const value = secureRandomUint32();
    if (value < limit) return lower + (value % span);
  }
  throw new Error("secure-random-unavailable");
}

/** Points (with up to 2 decimals) → fixed8 bigint the scene formats via formatGas. */
function pointsToFixed8(points: number): bigint {
  const centi = Math.max(0, Math.round(points * 100));
  return (BigInt(centi) * ONE_POINT_FIXED8) / 100n;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    lastClaimAmount,
    lastClaimLuckPercent,
    lastError,
    lastTxid,
    lastSuccessType,
    claimStatus,
    claimProgress,
    currentClaimKey,
    currentPoolId,
    currentPool,
    recentPools,
    recentClaims,
    gasCredit,
    guestBest,
    guestLast,
    guestDraws,
    guestBoard,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;
  let leaderboardSync = Promise.resolve();

  const submitScore = async (points: number): Promise<void> => {
    if (!(points > 0)) return;
    try {
      await guestLeaderboard.submit(Math.round(points * SCORE_SCALE));
    } catch {
      /* wallet optional / board unreachable — guest scores are best-effort */
    }
  };

  const refreshLeaderboard = async (): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const board: GuestBoardRow[] = rows
        .map((row) => ({
          user: row.user,
          score: (Number(row.score) || 0) / SCORE_SCALE,
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      guestBoard.set(board);
    } catch {
      guestBoard.set([]);
    }
  };

  const resetRewardState = (): void => {
    lastError.set("");
    lastTxid.set("");
    lastSuccessType.set("");
    claimStatus.set("");
    claimProgress.set("");
  };

  return {
    draw(range: GuestRange): boolean {
      const { min, max } = normalizeGuestRange(range);
      let prizeCenti: number;
      try {
        prizeCenti = secureRandomIntegerInclusive(
          Math.ceil(min * 100),
          Math.floor(max * 100),
        );
      } catch {
        resetRewardState();
        lastClaimAmount.set(0n);
        lastClaimLuckPercent.set("");
        const message = t("guestSecureRandomUnavailable");
        lastError.set(message);
        setStatus(message, "error");
        return false;
      }
      const prize = prizeCenti / 100;
      const luck =
        max > min
          ? Math.max(
              1,
              Math.min(100, Math.round(((prize - min) / (max - min)) * 100)),
            )
          : 50;

      resetRewardState();
      lastClaimLuckPercent.set(String(luck));
      // guestDraws is also bridged as the reveal nonce, so equal consecutive
      // prizes still get their own complete roll-up and coin-burst beat.
      lastClaimAmount.set(pointsToFixed8(prize));

      guestLast.set(prize);
      if (prize > guestBest.get()) guestBest.set(prize);
      guestDraws.set(guestDraws.get() + 1);
      setStatus(
        t("guestDrawResult", { amount: prize.toFixed(2), luck }),
        "success",
      );

      leaderboardSync = leaderboardSync.then(async () => {
        await submitScore(prize);
        await refreshLeaderboard();
      });
      void leaderboardSync;
      return true;
    },

    refreshLeaderboard,

    async enter(options = {}): Promise<void> {
      // Clean the local lobby and every on-chain-only surface so a prior
      // gamefi mount-time read never bleeds into guest play. A maintenance
      // launch may retain its claim identity for a later safe retry.
      resetRewardState();
      lastClaimAmount.set(0n);
      lastClaimLuckPercent.set("");
      if (!options.preserveClaimContext) {
        currentClaimKey.set("");
        currentPoolId.set("");
      }
      currentPool.set(null);
      recentPools.set([]);
      recentClaims.set([]);
      gasCredit.set(0n);
      guestBest.set(0);
      guestLast.set(0);
      guestDraws.set(0);
      await refreshLeaderboard();
    },
  };
}
