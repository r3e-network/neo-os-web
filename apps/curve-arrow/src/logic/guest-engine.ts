/**
 * Guest (free / local) engine for Curve Arrow.
 *
 * Guest mode is a purely LOCAL archery game: the wall/target layouts are
 * generated with the Web-Crypto RNG (the local analog of the enclave seed),
 * flown and scored entirely client-side with the SAME deterministic flight
 * engine the TEE replays (`arrow-engine.ts`), and (optionally) submitted to the
 * OFF-CHAIN guest leaderboard. The engine drives the SAME observables + dispatch
 * actions the Phaser scene reads (gameStatus / clues / gameDifficulty / deadline
 * / dealtAt / lastStatus / ...), so the frozen scene contract is reused verbatim.
 * It NEVER makes a chain, oracle, or reward call — the framework guest guard
 * therefore never fires.
 *
 * Because the scene runs its own local run off the dealt `clues` JSON, this
 * engine mirrors that run (via the same `applyShot`) from the shots the scene
 * records, so `submitSolution` knows the cleared count without any enclave.
 */
import type { GameSessionObservables, LeaderEntry, SolveRow } from "@framework/game";
import { ruleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import {
  FIELD_H,
  LEVEL_TARGETS,
  TICKS_MAX,
  applyShot,
  createRun,
  normalizeHolds,
  simulateShot,
} from "./arrow-engine";
import type { LevelSpec, ObstacleSpec, RunState } from "./arrow-engine";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

interface GuestStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables<SolveRow>;
  clues: Obs<string>;
  guestLeaderboard: GuestLeaderboardApi;
  levelsCleared?: Obs<number>;
  arrowsUsed?: Obs<number>;
  runDone?: Obs<boolean>;
  runWon?: Obs<boolean>;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  storage?: GuestStorage;
  createLevels?: (difficulty: number) => LevelSpec[];
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  selectDifficulty(difficulty: number): void;
  recordShot(holds: readonly number[]): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "miniapp-curve-arrow:guest-profile:v1";

/** Web-Crypto (Math.random fallback) integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  if (max <= min) return min;
  const span = max - min + 1;
  const buffer = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(buffer);
  } else {
    buffer[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return min + (buffer[0] % span);
}

// ── Local level generation (faithful stand-in for the enclave dealer) ─────────
//
// Every generated level is proven CLEARABLE with the real flight engine before
// it is dealt, so a skilled guest can always finish the range. Walls rise from
// the floor and cross the bow's level line (y = 450), forcing the player to
// curve the arrow up and over them onto a target that sits above the wall.

/**
 * Find a clearing shot for a level, or null. The generator only deals targets
 * that sit ABOVE the walls (never behind/under them), so a single hold-and-level
 * curve — the core control — always suffices; no loop/descent search is needed.
 * Returns the first clearing holds so callers can both gate AND replay.
 */
function findClearingHolds(level: LevelSpec): number[] | null {
  if (simulateShot(level, []).hit) return [];
  for (let press = 0; press <= 60; press += 3) {
    for (let dur = 4; dur <= 220; dur += 4) {
      const release = press + dur;
      if (release >= TICKS_MAX) break;
      if (simulateShot(level, [press, release]).hit) return [press, release];
    }
  }
  return null;
}

function isClearable(level: LevelSpec): boolean {
  return findClearingHolds(level) !== null;
}

/** A guaranteed-clearable open level: a straight shot lands inside the rings. */
function fallbackLevel(): LevelSpec {
  return { target: { x: randInt(1240, 1360), y: randInt(415, 485) }, obstacles: [] };
}

/** One random candidate level scaled to difficulty (may or may not be solvable). */
function makeCandidate(difficulty: number): LevelSpec {
  const roll = randInt(0, 99);

  // ── Open curve level (no wall): a raised target that needs a climb ─────────
  const openThreshold = difficulty === 0 ? 45 : difficulty === 1 ? 30 : 20;
  if (roll < openThreshold) {
    const targetY = difficulty === 0 ? randInt(320, 430)
      : difficulty === 1 ? randInt(250, 410)
      : randInt(200, 380);
    return { target: { x: randInt(1180, 1420), y: targetY }, obstacles: [] };
  }

  // ── Curve-over-wall level: the wall crosses the level line and forces a loop
  const topMax = difficulty === 0 ? 440 : difficulty === 1 ? 420 : 390;
  const topMin = difficulty === 0 ? 360 : difficulty === 1 ? 330 : 300;
  const top = randInt(topMin, topMax);
  const wallW = randInt(58, 88);
  const wallX = randInt(560, difficulty === 0 ? 860 : 940);
  const obstacles: ObstacleSpec[] = [
    { x: wallX, y: top, w: wallW, h: FIELD_H - top },
  ];

  // Second (higher, later) wall on hard ranges for a tighter gauntlet.
  if (difficulty === 2 && roll > 60) {
    const top2 = randInt(280, 360);
    const wallX2 = randInt(wallX + wallW + 120, 1080);
    if (wallX2 + 70 <= 1120) {
      obstacles.push({ x: wallX2, y: top2, w: randInt(58, 80), h: FIELD_H - top2 });
    }
  }

  const highestTop = Math.min(...obstacles.map((o) => o.y));
  const targetY = randInt(Math.max(160, highestTop - 150), Math.max(170, highestTop - 50));
  const wallRight = Math.max(...obstacles.map((o) => o.x + o.w));
  const targetX = randInt(Math.min(1420, wallRight + 200), 1440);
  return { target: { x: targetX, y: targetY }, obstacles };
}

/** Generate `count` clearable levels for a difficulty. */
function generateLevels(difficulty: number): LevelSpec[] {
  const count = LEVEL_TARGETS[difficulty] ?? LEVEL_TARGETS[0];
  const levels: LevelSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    let level: LevelSpec | null = null;
    for (let attempt = 0; attempt < 36 && !level; attempt += 1) {
      const candidate = makeCandidate(difficulty);
      if (isClearable(candidate)) level = candidate;
    }
    levels.push(level ?? fallbackLevel());
  }
  return levels;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const { obs, clues, guestLeaderboard, t, setStatus } = deps;
  const storage: GuestStorage | undefined = deps.storage ?? (() => {
    try {
      const local = globalThis.localStorage;
      return {
        get<T>(key: string, fallback: T | null = null): T | null {
          const raw = local.getItem(key);
          return raw === null ? fallback : JSON.parse(raw) as T;
        },
        set(key: string, value: unknown): void { local.setItem(key, JSON.stringify(value)); },
      };
    } catch {
      return undefined;
    }
  })();

  // Shadow run: mirrors the scene's local run so submitSolution knows the score.
  let levels: LevelSpec[] | null = null;
  let run: RunState | null = null;

  const readProfile = (): { bestCleared: number; solves: number } => {
    try {
      const parsed = storage?.get<{ bestCleared?: unknown; solves?: unknown }>(
        GUEST_PROFILE_KEY,
        null,
      ) ?? null;
      return {
        bestCleared: Math.max(0, Math.floor(Number(parsed?.bestCleared) || 0)),
        solves: Math.max(0, Math.floor(Number(parsed?.solves) || 0)),
      };
    } catch {
      return { bestCleared: 0, solves: 0 };
    }
  };

  const writeProfile = (bestCleared: number, solves: number): void => {
    try {
      storage?.set(GUEST_PROFILE_KEY, { bestCleared, solves });
    } catch {
      /* Private-mode/local quota failures must never break a free run. */
    }
  };

  const publishRun = (): void => {
    deps.levelsCleared?.set(run?.cleared ?? 0);
    deps.arrowsUsed?.set(run?.arrowsUsed ?? 0);
    deps.runDone?.set(run?.done ?? false);
    deps.runWon?.set(run?.won ?? false);
  };

  const resetToLobby = (): void => {
    levels = null;
    run = null;
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.commitment.set("");
    obs.lastPayout.set("");
    obs.lastElapsedMs.set(0);
    obs.isStarting.set(false);
    obs.isDealing.set(false);
    obs.isSubmitting.set(false);
    clues.set("");
    publishRun();
    obs.lastStatus.set(t("guestStatusReady"));
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

  const targetsOf = (difficulty: number): number =>
    LEVEL_TARGETS[difficulty] ?? LEVEL_TARGETS[0];

  return {
    startGame(difficulty: number): void {
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const diff = clampDifficulty(difficulty);
      obs.isStarting.set(true);
      const dealt = (deps.createLevels ?? generateLevels)(diff);
      levels = dealt;
      run = createRun(dealt, diff);
      obs.gameDifficulty.set(diff);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.lastPayout.set("");
      obs.lastElapsedMs.set(0);
      clues.set(JSON.stringify({ levels: dealt }));
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + ruleOf(diff).limitMs);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestStatusDealt"));
      obs.isStarting.set(false);
      publishRun();
      setStatus(t("guestStatusDealt"), "success");
    },

    selectDifficulty(difficulty: number): void {
      obs.gameDifficulty.set(clampDifficulty(difficulty));
    },

    recordShot(holds: readonly number[]): void {
      if (
        obs.gameStatus.get() !== "dealt" ||
        !levels ||
        !run ||
        run.done ||
        (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get())
      ) return;
      if (normalizeHolds(holds) === null) return;
      const applied = applyShot(run, levels, holds);
      run = applied.run;
      publishRun();
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.isSubmitting.get()) return;
      const currentRun = run;
      const deadlinePassed = obs.deadline.get() > 0 && Date.now() >= obs.deadline.get();
      if (!currentRun || (!currentRun.done && !deadlinePassed)) {
        const msg = t("guestRunIncomplete");
        obs.lastStatus.set(msg);
        setStatus(msg, "warning");
        return;
      }
      obs.isSubmitting.set(true);
      const diff = clampDifficulty(obs.gameDifficulty.get());
      const cleared = currentRun.cleared;
      const won = currentRun.won && !deadlinePassed;
      const targets = targetsOf(diff);
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      obs.lastPayout.set("");
      obs.gameStatus.set(won ? "solved" : "expired");
      obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), cleared));
      obs.mySolves.set(obs.mySolves.get() + (won ? 1 : 0));
      writeProfile(obs.myTotalWon.get(), obs.mySolves.get());
      obs.activeGameId.set("0");
      levels = null;
      run = null;
      publishRun();
      if (won) {
        obs.lastStatus.set(t("guestRunComplete", { cleared, target: targets }));
        setStatus(t("guestRunComplete", { cleared, target: targets }), "success");
      } else {
        obs.lastStatus.set(t("guestRunOver", { cleared, target: targets }));
        setStatus(t("guestRunOver", { cleared, target: targets }), "info");
      }
      await submitScore(cleared);
      await refreshLeaderboard();
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
      resetToLobby();
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, and open every range (no on-chain progression gate).
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      const profile = readProfile();
      obs.myTotalWon.set(profile.bestCleared);
      obs.mySolves.set(profile.solves);
      obs.myHistory.set([]);
      obs.progressionReady.set(true);
      obs.progressionRequiredDifficulty.set(0);
      obs.progressionMaxDifficulty.set(2);
      obs.lastStatus.set(t("guestStatusReady"));
      deps.arrowsUsed?.set(0);
      deps.levelsCleared?.set(0);
      deps.runDone?.set(false);
      deps.runWon?.set(false);
      await refreshLeaderboard();
    },
  };
}
