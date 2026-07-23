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
 * miss, undo, clear). Guest mode simply replaces the chain/TEE session
 * (startGame) and the on-chain settlement (submitRun) with local equivalents,
 * and records the cleared-jump count off-chain instead of paying GAS.
 */
import type { LeaderEntry, RunRow } from "../main";
import { MAX_UNDOS, ruleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import type { Platform } from "./jump-engine";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface GuestEngineDeps {
  gameStatus: Obs<string>;
  activeGameId: Obs<string>;
  gameDifficulty: Obs<number>;
  platformsView: Obs<Platform[]>;
  commitment: Obs<string>;
  dealtAt: Obs<number>;
  deadline: Obs<number>;
  undosUsed: Obs<number>;
  lastPayout: Obs<string>;
  lastElapsedMs: Obs<number>;
  leaderboard: Obs<LeaderEntry[]>;
  // `number | undefined`: these rest at `undefined` (unread) until the guest
  // profile is loaded, so the shell chrome shows its pendingKey copy instead of
  // a fabricated 0. The guest engine only ever SETS them (to real numbers).
  myRank: Obs<number | undefined>;
  myTotalWon: Obs<number | undefined>;
  myRuns: Obs<number | undefined>;
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
  storage: LocalStore;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordJump(platformIndex: number, landed: boolean, perfect: boolean): void;
  useUndo(): void;
  submitRun(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "guest:profile";
const GUEST_ACTIVE_RUN_KEY = "guest:active-run/v1";
const GUEST_ACTIVE_RUN_VERSION = 1;

interface GuestProfile {
  bestJumps: number;
  runs: number;
  history: RunRow[];
}

interface StoredGuestRun {
  version: 1;
  difficulty: number;
  platforms: Platform[];
  dealtAt: number;
  deadline: number;
  currentPlatform: number;
  jumpCount: number;
  perfectCount: number;
  comboCount: number;
  undosUsed: number;
  missedPlatform: boolean;
}

/** Generate a local route with the same difficulty gap ranges as the engine. */
function randomRoute(length: number, difficulty: number): Platform[] {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secure local randomness unavailable");
  const config = difficulty === 2
    ? { minWidth: 70, maxWidth: 100, minGap: 140, maxGap: 260 }
    : difficulty === 1
      ? { minWidth: 85, maxWidth: 115, minGap: 100, maxGap: 180 }
      : { minWidth: 100, maxWidth: 140, minGap: 60, maxGap: 120 };
  const randomInt = (min: number, max: number): number => {
    const range = max - min + 1;
    const limit = Math.floor(0x1_0000_0000 / range) * range;
    const word = new Uint32Array(1);
    do {
      webCrypto.getRandomValues(word);
    } while ((word[0] ?? limit) >= limit);
    return min + ((word[0] ?? 0) % range);
  };
  const route: Platform[] = [{ x: 60, width: 120, gap: 0 }];
  for (let index = 0; index < length; index += 1) {
    const previous = route[route.length - 1];
    if (!previous) throw new Error("local route generation failed");
    const width = randomInt(config.minWidth, config.maxWidth);
    const gap = randomInt(config.minGap, config.maxGap);
    route.push({ x: previous.x + previous.width + gap, width, gap });
  }
  return route;
}

function finiteInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number") return null;
  const parsed = value;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function validStoredRoute(value: unknown, difficulty: number): Platform[] | null {
  if (!Array.isArray(value)) return null;
  const target = ruleOf(difficulty).targetJumps;
  if (value.length !== target + 1) return null;
  const route: Platform[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const candidate = raw as Record<string, unknown>;
    const x = finiteInteger(candidate.x, 0, 1_000_000);
    const width = finiteInteger(candidate.width, 60, 160);
    const gap = finiteInteger(candidate.gap, 0, 320);
    if (x === null || width === null || gap === null) return null;
    if (index === 0) {
      if (x !== 60 || width !== 120 || gap !== 0) return null;
    } else {
      const previous = route[index - 1];
      if (!previous || gap <= 0 || x !== previous.x + previous.width + gap) return null;
    }
    route.push({ x, width, gap });
  }
  return route;
}

function parseStoredRun(value: unknown, now: number): StoredGuestRun | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== GUEST_ACTIVE_RUN_VERSION) return null;
  const difficulty = finiteInteger(raw.difficulty, 0, 2);
  if (difficulty === null) return null;
  const rule = ruleOf(difficulty);
  const platforms = validStoredRoute(raw.platforms, difficulty);
  const dealtAt = finiteInteger(raw.dealtAt, 1, Number.MAX_SAFE_INTEGER);
  const deadline = finiteInteger(raw.deadline, 1, Number.MAX_SAFE_INTEGER);
  const currentPlatform = finiteInteger(raw.currentPlatform, 0, rule.targetJumps);
  const jumpCount = finiteInteger(raw.jumpCount, 0, rule.targetJumps);
  const perfectCount = finiteInteger(raw.perfectCount, 0, rule.targetJumps);
  const comboCount = finiteInteger(raw.comboCount, 0, rule.targetJumps);
  const storedUndos = finiteInteger(raw.undosUsed, 0, MAX_UNDOS);
  if (
    !platforms || dealtAt === null || deadline === null || currentPlatform === null ||
    jumpCount === null || perfectCount === null || comboCount === null || storedUndos === null ||
    deadline !== dealtAt + rule.limitMs || deadline <= now || jumpCount !== currentPlatform ||
    perfectCount > jumpCount || comboCount > perfectCount || typeof raw.missedPlatform !== "boolean"
  ) {
    return null;
  }
  return {
    version: 1,
    difficulty,
    platforms,
    dealtAt,
    deadline,
    currentPlatform,
    jumpCount,
    perfectCount,
    comboCount,
    undosUsed: storedUndos,
    missedPlatform: raw.missedPlatform,
  };
}

function parseHistory(value: unknown): RunRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): RunRow[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const row = raw as Partial<RunRow>;
    const difficulty = finiteInteger(row.difficulty, 0, 2);
    const elapsedMs = finiteInteger(row.elapsedMs, 0, 3_600_000);
    const undos = finiteInteger(row.undos, 0, MAX_UNDOS);
    const jumps = finiteInteger(row.jumps, 0, 100);
    const perfects = finiteInteger(row.perfects, 0, jumps ?? 0);
    if (
      difficulty === null || elapsedMs === null || undos === null || jumps === null ||
      perfects === null || typeof row.gameId !== "string" || row.gameId.length === 0 || row.gameId.length > 80
    ) {
      return [];
    }
    return [{
      gameId: row.gameId,
      difficulty,
      elapsedMs,
      undos,
      jumps,
      perfects,
      payout: String(jumps),
    }];
  }).slice(0, 12);
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
    storage,
    t,
    setStatus,
  } = deps;

  // Jumps cleared in the active run (highest platform index reached). Full-clear
  // is the only path that reaches submitRun, so this equals the route length.
  let jumpsThisRun = 0;
  let routeLength = 0;

  const loadProfile = (): GuestProfile => {
    try {
      const raw = storage.get<Partial<GuestProfile>>(GUEST_PROFILE_KEY, {});
      return {
        bestJumps: finiteInteger(raw?.bestJumps, 0, 100) ?? 0,
        runs: finiteInteger(raw?.runs, 0, 1_000_000) ?? 0,
        history: parseHistory(raw?.history),
      };
    } catch {
      return { bestJumps: 0, runs: 0, history: [] };
    }
  };

  const saveProfile = (profile: GuestProfile): void => {
    try {
      storage.set(GUEST_PROFILE_KEY, profile);
    } catch {
      // Storage policy/quota failures must never block a local run.
    }
  };

  const clearActiveRun = (): void => {
    try {
      storage.delete(GUEST_ACTIVE_RUN_KEY);
    } catch {
      /* stale recovery data is harmless in local-only play */
    }
  };

  const saveActiveRun = (): void => {
    if (gameStatus.get() !== "dealt" || routeLength <= 0) return;
    const snapshot: StoredGuestRun = {
      version: 1,
      difficulty: gameDifficulty.get(),
      platforms: platformsView.get().map((platform) => ({ ...platform })),
      dealtAt: dealtAt.get(),
      deadline: deadline.get(),
      currentPlatform: currentPlatform.get(),
      jumpCount: jumpCount.get(),
      perfectCount: perfectCount.get(),
      comboCount: comboCount.get(),
      undosUsed: undosUsed.get(),
      missedPlatform: missedPlatform.get(),
    };
    try {
      storage.set(GUEST_ACTIVE_RUN_KEY, snapshot);
    } catch {
      // Storage policy/quota failures never block the active local run.
    }
  };

  const restoreActiveRun = (): boolean => {
    let stored: StoredGuestRun | null = null;
    try {
      stored = parseStoredRun(storage.get<unknown>(GUEST_ACTIVE_RUN_KEY, null), Date.now());
    } catch {
      stored = null;
    }
    if (!stored) {
      clearActiveRun();
      return false;
    }
    routeLength = ruleOf(stored.difficulty).targetJumps;
    jumpsThisRun = stored.jumpCount;
    gameDifficulty.set(stored.difficulty);
    activeGameId.set(GUEST_GAME_ID);
    commitment.set("");
    platformsView.set(stored.platforms.map((platform) => ({ ...platform })));
    dealtAt.set(stored.dealtAt);
    deadline.set(stored.deadline);
    undosUsed.set(stored.undosUsed);
    jumpCount.set(stored.jumpCount);
    currentPlatform.set(stored.currentPlatform);
    perfectCount.set(stored.perfectCount);
    comboCount.set(stored.comboCount);
    chargeLevel.set(0);
    isCharging.set(false);
    isJumping.set(false);
    missedPlatform.set(stored.missedPlatform);
    gameStatus.set("dealt");
    lastStatus.set(t("guestRunRecovered"));
    return true;
  };

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

  const resetToLobby = (clearStoredRun = true): void => {
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
    if (clearStoredRun) clearActiveRun();
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
        .flatMap((row) => {
          const score = Number(row.score);
          if (
            typeof row.user !== "string" || row.user.length === 0 || row.user.length > 160 ||
            !Number.isFinite(score) || score < 0 || score > 100
          ) {
            return [];
          }
          return [{ address: row.user, score: Math.floor(score) }];
        })
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
      try {
        routeLength = rule.targetJumps;
        const view = randomRoute(routeLength, diff);

        gameDifficulty.set(diff);
        activeGameId.set(GUEST_GAME_ID);
        commitment.set("");
        resetRunCounters();
        platformsView.set(view);

        const now = Date.now();
        dealtAt.set(now);
        deadline.set(now + rule.limitMs);
        gameStatus.set("dealt");
        lastStatus.set(t("guestStatusDealt"));
        saveActiveRun();
      } catch {
        routeLength = 0;
        gameStatus.set("idle");
        activeGameId.set("0");
        platformsView.set([]);
        lastStatus.set(t("guestRandomUnavailable"));
        setStatus(lastStatus.get(), "error");
      } finally {
        isStarting.set(false);
      }
    },

    recordJump(platformIndex: number, landed: boolean, perfect: boolean): void {
      if (gameStatus.get() !== "dealt") return;
      if (!landed) {
        missedPlatform.set(true);
        comboCount.set(0);
        saveActiveRun();
        return;
      }
      const reached = Number.isFinite(platformIndex) ? Math.round(platformIndex) : 0;
      if (reached !== jumpsThisRun + 1 || reached > routeLength) return;
      jumpsThisRun = reached;
      jumpCount.set(reached);
      currentPlatform.set(reached);
      if (perfect) {
        perfectCount.set(perfectCount.get() + 1);
        comboCount.set(comboCount.get() + 1);
      } else {
        comboCount.set(0);
      }
      missedPlatform.set(false);
      saveActiveRun();
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
      missedPlatform.set(false);
      lastStatus.set(t("guestStatusUndo", { left: MAX_UNDOS - undos }));
      setStatus(lastStatus.get(), "info");
      saveActiveRun();
    },

    async submitRun(): Promise<void> {
      if (gameStatus.get() !== "dealt" || isSubmitting.get()) return;
      isSubmitting.set(true);
      if (routeLength <= 0 || jumpsThisRun < routeLength) {
        isSubmitting.set(false);
        lastStatus.set(t("statusBoardIncomplete"));
        setStatus(lastStatus.get(), "info");
        return;
      }
      const cleared = jumpsThisRun;
      const elapsed = Math.max(0, Date.now() - dealtAt.get());
      const profile = loadProfile();
      const historyRow: RunRow = {
        gameId: `guest-${Date.now()}`,
        difficulty: gameDifficulty.get(),
        elapsedMs: elapsed,
        undos: undosUsed.get(),
        jumps: cleared,
        perfects: perfectCount.get(),
        payout: String(cleared),
      };
      const nextProfile = {
        bestJumps: Math.max(profile.bestJumps, cleared),
        runs: profile.runs + 1,
        history: [historyRow, ...profile.history].slice(0, 12),
      };
      saveProfile(nextProfile);
      clearActiveRun();
      lastElapsedMs.set(elapsed);
      lastPayout.set(String(cleared));
      myTotalWon.set(nextProfile.bestJumps);
      myRuns.set(nextProfile.runs);
      myHistory.set(nextProfile.history);
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
      resetToLobby(false);
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read never bleeds into the guest surface, then load the
      // off-chain guest board.
      myRank.set(0);
      const profile = loadProfile();
      myTotalWon.set(profile.bestJumps);
      myRuns.set(profile.runs);
      myHistory.set(profile.history);
      restoreActiveRun();
      await refreshLeaderboard();
    },
  };
}
