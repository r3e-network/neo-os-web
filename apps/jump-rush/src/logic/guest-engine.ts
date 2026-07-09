/**
 * Guest (free / local) engine for Jump Rush.
 *
 * Guest mode is a purely LOCAL platform runner: the platform route is generated
 * with the Web-Crypto RNG (the local analog of the enclave seed), played and
 * scored entirely client-side, and (optionally) submitted to the OFF-CHAIN
 * guest leaderboard. The engine drives the SAME observables + dispatch actions
 * the Phaser scene reads (gameStatus / platformsView / dealtAt / deadline /
 * undosUsed / ...), so the frozen scene contract is reused verbatim. It NEVER
 * makes a chain, oracle, or reward call — the framework guest guard therefore
 * never fires.
 *
 * The scene already runs the jump gameplay locally (charge/release, landing,
 * miss, undo, clear). Guest mode simply replaces the chain/TEE seal-and-bind
 * (startGame) and the on-chain settlement (submitRun) with local equivalents,
 * and records the cleared-jump count off-chain instead of paying GAS.
 */
import type { LeaderEntry, RunRow } from "../main";
import { MAX_UNDOS, ruleOf } from "./game-rules";

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
  gameStatus: Obs<string>;
  activeGameId: Obs<string>;
  gameDifficulty: Obs<number>;
  platformsView: Obs<number[]>;
  commitment: Obs<string>;
  dealtAt: Obs<number>;
  deadline: Obs<number>;
  undosUsed: Obs<number>;
  lastPayout: Obs<string>;
  lastElapsedMs: Obs<number>;
  leaderboard: Obs<LeaderEntry[]>;
  myRank: Obs<number>;
  myTotalWon: Obs<number>;
  myRuns: Obs<number>;
  myHistory: Obs<RunRow[]>;
  isStarting: Obs<boolean>;
  isDealing: Obs<boolean>;
  isSubmitting: Obs<boolean>;
  isUndoing: Obs<boolean>;
  lastStatus: Obs<string>;
  jumpCount: Obs<number>;
  currentPlatform: Obs<number>;
  perfectCount: Obs<number>;
  comboCount: Obs<number>;
  chargeLevel: Obs<number>;
  isCharging: Obs<boolean>;
  isJumping: Obs<boolean>;
  missedPlatform: Obs<boolean>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordJump(platformIndex: number): void;
  useUndo(): void;
  submitRun(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";

/** The scene caps its visible route at 16 platforms; keep guest routes inside
 *  that band so every generated jump is reachable and scored. */
const MIN_ROUTE_BYTES = 5;
const MAX_ROUTE_BYTES = 15;

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Web-Crypto (Math.random fallback) array of platform-layout bytes 0..255. */
function randomRouteBytes(length: number): number[] {
  const bytes = new Uint8Array(length);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes);
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    gameStatus,
    activeGameId,
    gameDifficulty,
    platformsView,
    commitment,
    dealtAt,
    deadline,
    undosUsed,
    lastPayout,
    lastElapsedMs,
    leaderboard,
    myRank,
    myTotalWon,
    myRuns,
    myHistory,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    lastStatus,
    jumpCount,
    currentPlatform,
    perfectCount,
    comboCount,
    chargeLevel,
    isCharging,
    isJumping,
    missedPlatform,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Jumps cleared in the active run (highest platform index reached). Full-clear
  // is the only path that reaches submitRun, so this equals the route length.
  let jumpsThisRun = 0;
  let routeLength = 0;

  const resetRunCounters = (): void => {
    jumpsThisRun = 0;
    undosUsed.set(0);
    jumpCount.set(0);
    currentPlatform.set(0);
    perfectCount.set(0);
    comboCount.set(0);
    chargeLevel.set(0);
    isCharging.set(false);
    isJumping.set(false);
    missedPlatform.set(false);
  };

  const resetToLobby = (): void => {
    gameStatus.set("idle");
    activeGameId.set("0");
    commitment.set("");
    platformsView.set([]);
    dealtAt.set(0);
    deadline.set(0);
    lastPayout.set("");
    lastElapsedMs.set(0);
    isStarting.set(false);
    isDealing.set(false);
    isSubmitting.set(false);
    isUndoing.set(false);
    routeLength = 0;
    resetRunCounters();
    lastStatus.set(t("guestStatusReady"));
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
          runs: 1,
          isUser: false,
        }));
      leaderboard.set(ranked);
    } catch {
      leaderboard.set([]);
    }
  };

  return {
    startGame(difficulty: number): void {
      if (isStarting.get() || gameStatus.get() === "dealt") return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      isStarting.set(true);
      lastStatus.set(t("guestStatusStarting"));

      routeLength = Math.max(
        MIN_ROUTE_BYTES,
        Math.min(MAX_ROUTE_BYTES, rule.targetJumps),
      );
      const view = randomRouteBytes(routeLength);

      gameDifficulty.set(diff);
      activeGameId.set(GUEST_GAME_ID);
      commitment.set("");
      resetRunCounters();
      platformsView.set(view);

      const now = Date.now();
      dealtAt.set(now);
      deadline.set(now + rule.limitMs);
      gameStatus.set("dealt");
      isStarting.set(false);
      lastStatus.set(t("guestStatusDealt"));
    },

    recordJump(platformIndex: number): void {
      if (gameStatus.get() !== "dealt") return;
      const reached = Number.isFinite(platformIndex) ? Math.max(0, Math.round(platformIndex)) : 0;
      if (reached > jumpsThisRun) {
        jumpsThisRun = reached;
        jumpCount.set(reached);
        currentPlatform.set(reached);
      }
    },

    useUndo(): void {
      if (gameStatus.get() !== "dealt") return;
      if (undosUsed.get() >= MAX_UNDOS) {
        setStatus(t("undoLimitReached"), "info");
        return;
      }
      // Bumping undosUsed is exactly what the scene watches to clear the miss
      // state and re-arm the run — no transaction, no TEE op.
      const undos = undosUsed.get() + 1;
      undosUsed.set(undos);
      lastStatus.set(t("guestStatusUndo", { left: MAX_UNDOS - undos }));
      setStatus(lastStatus.get(), "info");
    },

    async submitRun(): Promise<void> {
      if (gameStatus.get() !== "dealt" || isSubmitting.get()) return;
      isSubmitting.set(true);
      const cleared = jumpsThisRun > 0 ? jumpsThisRun : routeLength;
      const elapsed = Math.max(0, Date.now() - dealtAt.get());
      lastElapsedMs.set(elapsed);
      lastPayout.set(String(cleared));
      myTotalWon.set(Math.max(myTotalWon.get(), cleared));
      myRuns.set(myRuns.get() + 1);
      gameStatus.set("solved");
      activeGameId.set("0");
      await submitScore(cleared);
      await refreshLeaderboard();
      lastStatus.set(t("guestRunComplete", { count: cleared }));
      setStatus(lastStatus.get(), "success");
      isSubmitting.set(false);
    },

    expireGame(): void {
      resetToLobby();
      setStatus(t("guestStatusReady"), "info");
    },

    retryDeal(): void {
      /* guest deals instantly — there is nothing to re-seal. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read never bleeds into the guest surface, then load the
      // off-chain guest board.
      myRank.set(0);
      myTotalWon.set(0);
      myRuns.set(0);
      myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
