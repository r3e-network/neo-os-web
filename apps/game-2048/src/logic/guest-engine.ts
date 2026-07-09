/**
 * Guest (free / local) engine for 2048 Rush.
 *
 * Guest mode is a purely LOCAL 2048: the initial board and every tile spawn are
 * generated with the Web-Crypto RNG (the local analog of the enclave spawn
 * stream), the board is played and scored entirely client-side, and (optionally)
 * the best tile is submitted to the OFF-CHAIN guest leaderboard. The engine
 * drives the SAME observables + dispatch actions the Phaser scene reads
 * (gameStatus / runBoard / runMoveCount / runMaxExp / isMoving / lastStatus / …),
 * so the frozen scene contract is reused verbatim. It NEVER makes a chain,
 * oracle, or reward call — the framework guest guard therefore never fires.
 *
 * The slide/merge/fold rules are the shared pure modules (engine-2048 +
 * run-store) — the very same rules the enclave twins in gamefi mode — so a
 * guest run is mechanically identical to a reward run minus the chain.
 */
import type { GameSessionObservables } from "@framework/game";
import { applyMove, hasAnyMove, tileValue } from "./engine-2048";
import { MAX_MOVES, ruleOf } from "./game-rules";
import { applyStep, buildRun, trimLastMove } from "./run-store";
import type { LiveRun, TeeSpawn } from "./run-store";

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
  runBoard: Obs<number[]>;
  runMoveCount: Obs<number>;
  runMaxExp: Obs<number>;
  isMoving: Obs<boolean>;
  balancesReady: Obs<boolean>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(form: unknown): void;
  playMove(form: unknown): void;
  useUndo(): void;
  submitRun(): Promise<void>;
  expireGame(): Promise<void>;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
/**
 * Local move latency. A valid move flips `isMoving` true, then commits the fold
 * one macrotask later — mirroring the gamefi enclave round-trip so the scene
 * observes the true→false transition and plays its slide/merge animation
 * exactly as it does for a reward run (a synchronous commit would coalesce into
 * one snapshot and skip the animation).
 */
const MOVE_LATENCY_MS = 110;
/** Chance (out of this many) that a spawned tile is a "4" (exp 2) instead of "2". */
const FOUR_SPAWN_IN = 10;

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Uniform integer in [0, maxExclusive) from Web-Crypto (Math.random fallback). */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    webCrypto.getRandomValues(buffer);
    return (buffer[0] ?? 0) % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** Pick a random empty cell + exponent for the next spawn, or null if full. */
function pickSpawn(board: number[]): TeeSpawn | null {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if ((board[i] ?? 0) === 0) empties.push(i);
  }
  if (empties.length === 0) return null;
  const pos = empties[randomInt(empties.length)] ?? empties[0]!;
  const exp = randomInt(FOUR_SPAWN_IN) === 0 ? 2 : 1;
  return { pos, exp };
}

/** Fresh 16-cell board seeded with two starting tiles. */
function initialBoard(): number[] {
  const board: number[] = new Array(16).fill(0);
  for (let k = 0; k < 2; k += 1) {
    const spawn = pickSpawn(board);
    if (spawn) board[spawn.pos] = spawn.exp;
  }
  return board;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    runBoard,
    runMoveCount,
    runMaxExp,
    isMoving,
    balancesReady,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Internal run + session-scoped guest stats (never touch the chain).
  let run: LiveRun | null = null;
  let guestBestTile = 0;
  let runsPlayed = 0;

  const publishRun = (): void => {
    runBoard.set(run ? [...run.board] : []);
    runMoveCount.set(run ? run.moves.length : 0);
    runMaxExp.set(run ? run.maxExp : 0);
  };

  const resetToLobby = (): void => {
    run = null;
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.commitment.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.lastPayout.set("");
    publishRun();
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
      const ranked = rows
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

  /** Settle the current run (win or dead board), record + submit the best tile. */
  const finishRun = async (won: boolean): Promise<void> => {
    const score = run ? tileValue(run.maxExp) : 0;
    obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
    run = null;
    obs.activeGameId.set("0");
    publishRun();

    if (score > 0) {
      guestBestTile = Math.max(guestBestTile, score);
      runsPlayed += 1;
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(runsPlayed);
    }

    obs.gameStatus.set(won ? "solved" : "expired");
    if (won) {
      obs.lastStatus.set(t("guestRunComplete", { tile: score }));
      setStatus(t("guestRunComplete", { tile: score }), "success");
    } else {
      obs.lastStatus.set(t("guestGameOver", { tile: score }));
      setStatus(t("guestGameOver", { tile: score }), "info");
    }

    await submitScore(score);
    await refreshLeaderboard();
  };

  const commitMove = (dir: number): void => {
    // Guard against a reset/stop landing during the move latency window.
    if (!run || obs.gameStatus.get() !== "dealt") {
      isMoving.set(false);
      return;
    }
    const post = [...run.board];
    if (!applyMove(post, dir)) {
      isMoving.set(false);
      return;
    }
    const spawn = pickSpawn(post);
    const next = spawn ? applyStep(run, dir, spawn) : null;
    if (!next) {
      isMoving.set(false);
      return;
    }
    run = next;
    publishRun();
    isMoving.set(false);

    const rule = ruleOf(obs.gameDifficulty.get());
    if (run.maxExp < rule.targetExp && !hasAnyMove(run.board)) {
      // Local game over: no target, no moves left — settle to a fresh lobby.
      void finishRun(false);
    }
  };

  return {
    startGame(form: unknown): void {
      if (obs.isStarting.get() || obs.gameStatus.get() === "dealt") return;
      const difficulty = clampDifficulty(Number((form as { difficulty?: unknown })?.difficulty ?? 0));
      const rule = ruleOf(difficulty);
      obs.isStarting.set(true);
      run = buildRun(initialBoard(), [], []);
      const now = Date.now();
      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.lastPayout.set("");
      publishRun();
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestDealt"));
      obs.isStarting.set(false);
    },

    playMove(form: unknown): void {
      if (!run || obs.gameStatus.get() !== "dealt" || isMoving.get()) return;
      if (run.moves.length >= MAX_MOVES) return;
      const dir = Number((form as { dir?: unknown })?.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      const deadline = obs.deadline.get();
      if (deadline > 0 && Date.now() >= deadline) return;
      if (!applyMove([...run.board], dir)) return; // no-op move
      isMoving.set(true);
      setTimeout(() => commitMove(dir), MOVE_LATENCY_MS);
    },

    useUndo(): void {
      if (!run || run.moves.length === 0) return;
      if (obs.gameStatus.get() !== "dealt" || obs.isUndoing.get() || isMoving.get()) return;
      obs.isUndoing.set(true);
      run = trimLastMove(run);
      publishRun();
      obs.lastStatus.set(t("guestUndo"));
      obs.isUndoing.set(false);
    },

    async submitRun(): Promise<void> {
      if (!run || obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      obs.isSubmitting.set(true);
      await finishRun(true);
      obs.isSubmitting.set(false);
    },

    async expireGame(): Promise<void> {
      if (!run) {
        resetToLobby();
        return;
      }
      await finishRun(false);
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads the chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(runsPlayed);
      obs.myHistory.set([]);
      balancesReady.set(true);
      obs.lastStatus.set(t("statusReady"));
      await refreshLeaderboard();
    },
  };
}
