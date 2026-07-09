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
  draw(range: GuestRange): void;
  /** Reset to a clean local lobby + load the off-chain guest board. */
  enter(): Promise<void>;
  /** Reload the off-chain guest board into the guest board observable. */
  refreshLeaderboard(): Promise<void>;
}

const ONE_POINT_FIXED8 = 100000000n;
/** Board scores are stored as centi-points integers to keep the board clean. */
const SCORE_SCALE = 100;

/** Web-Crypto (Math.random fallback) uniform float in [0, 1). */
function randomUnit(): number {
  const buffer = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(buffer);
  } else {
    buffer[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return (buffer[0] ?? 0) / 0x100000000;
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
    draw(range: GuestRange): void {
      const min = Number.isFinite(range.min) && range.min > 0 ? range.min : 1;
      const max =
        Number.isFinite(range.max) && range.max >= min ? range.max : min;
      const raw = min + randomUnit() * (max - min);
      const prize = Math.round(raw * 100) / 100; // 2-decimal points
      const luck =
        max > min
          ? Math.max(
              1,
              Math.min(100, Math.round(((prize - min) / (max - min)) * 100)),
            )
          : 50;

      resetRewardState();
      lastClaimLuckPercent.set(String(luck));
      // Setting the amount drives the scene's signature reward reveal (roll-up +
      // coin burst); the scene compares against its own last value, so an equal
      // consecutive draw simply stays put (no spurious re-reveal needed).
      lastClaimAmount.set(pointsToFixed8(prize));

      guestLast.set(prize);
      if (prize > guestBest.get()) guestBest.set(prize);
      guestDraws.set(guestDraws.get() + 1);
      setStatus(
        t("guestDrawResult", { amount: prize.toFixed(2), luck }),
        "success",
      );

      void (async () => {
        await submitScore(prize);
        await refreshLeaderboard();
      })();
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      // Clean local lobby: no claim context (keeps the scene in the draw panel),
      // and zero every on-chain-only surface so a prior gamefi mount-time read
      // never bleeds into the guest view.
      resetRewardState();
      lastClaimAmount.set(0n);
      lastClaimLuckPercent.set("");
      currentClaimKey.set("");
      currentPoolId.set("");
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
