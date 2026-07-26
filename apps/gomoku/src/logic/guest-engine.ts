/**
 * Guest (free / local) engine for Gomoku Arena.
 *
 * Guest mode is a purely LOCAL Gomoku game: the player (black) plays against
 * an AI opponent (white) on a 15×15 board. The engine drives the SAME
 * observables + dispatch actions the Phaser scene reads, so the scene contract
 * is reused verbatim. It NEVER makes a chain, oracle, or reward call.
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import { MAX_UNDOS, ruleOf } from "./game-rules";
import { clampDifficulty as clampDifficulty02 } from "@framework/game-rules";
import {
  BOARD_SIZE,
  CELL_COUNT,
  checkWinAt,
  computeAiMove,
  createBoard,
  idx,
  isBoardFull,
  type Board,
  type Difficulty,
  type MoveRecord,
  type Player,
} from "./gomoku-engine";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  walletConnected: Obs<boolean>;
  isPaused: Obs<boolean>;
  storage: BoardStorage;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(form: unknown): void;
  selectDifficulty(form: unknown): void;
  placeStone(form: unknown): void;
  useUndo(): void;
  togglePause(): void;
  restartGame(form?: unknown): void;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  enter(): Promise<void>;
}

export interface BoardStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const GUEST_GAME_ID = "guest";
const GUEST_SESSION_KEY = "gomoku-guest-session:v1";
const GUEST_PROFILE_KEY = "gomoku-guest-profile:v1";
const GUEST_POOL = 9999;

interface GuestSessionRecord {
  version: 1;
  difficulty: Difficulty;
  dealtAt: number;
  deadline: number;
  moves: MoveRecord[];
  isPaused: boolean;
  pausedAt: number;
  /**
   * Undos already spent this game. Persisted so reloading mid-game cannot
   * launder the counter back to zero and hand out a fresh undo allowance.
   */
  undosUsed: number;
}

interface GuestProfileRecord {
  version: 1;
  bestScore: number;
  wins: number;
  losses: number;
}

function clampDifficulty(value: number): Difficulty {
  return clampDifficulty02(value) as Difficulty;
}

function readSession(storage: BoardStorage): GuestSessionRecord | null {
  try {
    const value = storage.get<GuestSessionRecord>(GUEST_SESSION_KEY, null);
    if (
      !value || value.version !== 1 ||
      !Number.isInteger(value.difficulty) || value.difficulty < 0 || value.difficulty > 2 ||
      !Number.isFinite(value.dealtAt) || value.dealtAt <= 0 ||
      !Number.isFinite(value.deadline) || value.deadline <= value.dealtAt ||
      !Array.isArray(value.moves) ||
      typeof value.isPaused !== "boolean" ||
      !Number.isFinite(value.pausedAt) || value.pausedAt < 0
    ) return null;
    // `undosUsed` was added after the first release: records written by the
    // earlier version omit it, so absent counts as none spent. Anything present
    // must be a sane count, and is clamped to the allowance.
    const rawUndos = (value as { undosUsed?: unknown }).undosUsed;
    if (rawUndos !== undefined && (!Number.isInteger(rawUndos) || (rawUndos as number) < 0)) return null;
    const undosUsed = Math.min(MAX_UNDOS, rawUndos === undefined ? 0 : rawUndos as number);
    return { ...value, undosUsed };
  } catch {
    return null;
  }
}

function readProfile(storage: BoardStorage): GuestProfileRecord {
  try {
    const value = storage.get<GuestProfileRecord>(GUEST_PROFILE_KEY, null);
    if (
      value?.version === 1 &&
      Number.isFinite(value.bestScore) && value.bestScore >= 0 &&
      Number.isInteger(value.wins) && value.wins >= 0 &&
      Number.isInteger(value.losses) && value.losses >= 0
    ) return value;
  } catch {
    // Fall through
  }
  return { version: 1, bestScore: 0, wins: 0, losses: 0 };
}

/**
 * Score: rewards speed and difficulty. Winning faster on harder difficulty
 * yields a higher score.
 */
function computeScore(
  difficulty: Difficulty,
  elapsedMs: number,
  moveCount: number,
): number {
  const rule = ruleOf(difficulty);
  const remainingSec = Math.max(0, Math.round((rule.limitMs - elapsedMs) / 1000));
  const base = (difficulty + 1) * 400 + remainingSec;
  // Fewer moves = more efficient play
  const efficiencyBonus = Math.max(0, 100 - moveCount * 2);
  return Math.max(1, base + efficiencyBonus);
}

/** Rebuild the board from a move list. */
function replayMoves(moves: MoveRecord[]): Board {
  const board = createBoard();
  for (const move of moves) {
    if (move.cell >= 0 && move.cell < CELL_COUNT) {
      board[move.cell] = move.player;
    }
  }
  return board;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const { obs, walletConnected, isPaused, storage, guestLeaderboard, t, setStatus } = deps;

  let board: Board = createBoard();
  let moves: MoveRecord[] = [];
  let currentTurn: Player = 1; // Human always goes first (black)
  let gameOver = false;
  let pausedAt = 0;

  const clearPersistedSession = (): void => {
    try { storage.delete(GUEST_SESSION_KEY); } catch { /* noop */ }
  };

  const persistLiveSession = (): void => {
    if (obs.gameStatus.get() !== "dealt" || gameOver) return;
    const record: GuestSessionRecord = {
      version: 1,
      difficulty: clampDifficulty(obs.gameDifficulty.get()),
      dealtAt: obs.dealtAt.get(),
      deadline: obs.deadline.get(),
      moves: [...moves],
      isPaused: isPaused.get(),
      pausedAt,
      undosUsed: Math.min(MAX_UNDOS, Math.max(0, obs.undosUsed.get())),
    };
    try { storage.set(GUEST_SESSION_KEY, record); } catch { /* noop */ }
  };

  const resetToLobby = (clearProgress = true): void => {
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.lastStatus.set("");
    obs.commitment.set("");
    obs.dealtAt.set(0);
    obs.deadline.set(0);
    obs.undosUsed.set(0);
    obs.lastPayout.set("");
    obs.lastElapsedMs.set(0);
    isPaused.set(false);
    pausedAt = 0;
    board = createBoard();
    moves = [];
    currentTurn = 1;
    gameOver = false;
    if (clearProgress) clearPersistedSession();
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try { await guestLeaderboard.submit(score); } catch { /* best-effort */ }
  };

  const refreshLeaderboard = async (): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const ranked: LeaderEntry[] = rows
        .map((row) => ({
          address: String(row.user ?? "").slice(0, 96),
          score: Number(row.score) || 0,
        }))
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

  const dispatchBoardUpdate = (): void => {
    // Push board state to the scene via the observable pattern
    obs.lastStatus.set(JSON.stringify({
      type: "boardUpdate",
      board: board.map((cell) => String(cell)).join(""),
      currentTurn,
      gameOver,
      moves: moves.length,
    }));
  };

  const handleWin = (winner: Player, winLine: number[]): void => {
    gameOver = true;
    const difficulty = clampDifficulty(obs.gameDifficulty.get());
    const elapsedMs = Math.max(0, Date.now() - obs.dealtAt.get());

    if (winner === 1) {
      // Human wins
      const score = computeScore(difficulty, elapsedMs, moves.length);
      obs.lastElapsedMs.set(elapsedMs);
      obs.lastPayout.set(String(score));
      obs.gameStatus.set("solved");
      obs.activeGameId.set("0");

      const profile = readProfile(storage);
      const updated: GuestProfileRecord = {
        version: 1,
        bestScore: Math.max(profile.bestScore, score),
        wins: profile.wins + 1,
        losses: profile.losses,
      };
      obs.myTotalWon.set(updated.bestScore);
      obs.mySolves.set(updated.wins);
      try { storage.set(GUEST_PROFILE_KEY, updated); } catch { /* noop */ }

      clearPersistedSession();
      void submitScore(score).then(() => refreshLeaderboard());
      setStatus(t("guestWin", { score }), "success");
    } else {
      // AI wins
      obs.gameStatus.set("expired");
      obs.activeGameId.set("0");

      const profile = readProfile(storage);
      const updated: GuestProfileRecord = {
        version: 1,
        bestScore: profile.bestScore,
        wins: profile.wins,
        losses: profile.losses + 1,
      };
      obs.mySolves.set(updated.wins);
      try { storage.set(GUEST_PROFILE_KEY, updated); } catch { /* noop */ }

      clearPersistedSession();
      setStatus(t("guestLose"), "info");
    }

    dispatchBoardUpdate();
  };

  const handleDraw = (): void => {
    gameOver = true;
    obs.gameStatus.set("expired");
    obs.activeGameId.set("0");
    clearPersistedSession();
    setStatus(t("guestDraw"), "info");
    dispatchBoardUpdate();
  };

  const doAiMove = (): void => {
    if (gameOver || currentTurn !== 2) return;
    const difficulty = clampDifficulty(obs.gameDifficulty.get());
    const aiCell = computeAiMove(board, difficulty, 2);
    board[aiCell] = 2;
    moves.push({ cell: aiCell, player: 2 });

    const winLine = checkWinAt(board, aiCell, 2);
    if (winLine) {
      handleWin(2, winLine);
      return;
    }
    if (isBoardFull(board)) {
      handleDraw();
      return;
    }

    currentTurn = 1;
    persistLiveSession();
    dispatchBoardUpdate();
  };

  const startGame = (form: unknown): void => {
    if (obs.isStarting.get() || obs.isDealing.get()) return;
    const difficulty = clampDifficulty(
      Number((form as { difficulty?: unknown })?.difficulty ?? obs.gameDifficulty.get()),
    );
    const rule = ruleOf(difficulty);
    obs.isStarting.set(true);
    try {
      board = createBoard();
      moves = [];
      currentTurn = 1;
      gameOver = false;
      pausedAt = 0;

      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      obs.lastPayout.set("");
      obs.lastElapsedMs.set(0);
      isPaused.set(false);

      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set("");
      persistLiveSession();
      dispatchBoardUpdate();
    } finally {
      obs.isStarting.set(false);
    }
  };

  return {
    startGame,

    selectDifficulty(form: unknown): void {
      const difficulty = clampDifficulty(
        Number((form as { difficulty?: unknown })?.difficulty ?? 0),
      );
      obs.gameDifficulty.set(difficulty);
    },

    placeStone(form: unknown): void {
      if (obs.gameStatus.get() !== "dealt" || gameOver || isPaused.get()) return;
      if (currentTurn !== 1) return; // Not human's turn

      // Coerce only genuinely numeric input: `Number(null)` and `Number("")`
      // are both 0, which would otherwise land a stone on (0,0) for a frame
      // that carried no cell at all.
      const raw = (form as { cell?: unknown } | null | undefined)?.cell;
      if (typeof raw !== "number" && (typeof raw !== "string" || raw.trim() === "")) return;
      const cell = Number(raw);
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return;
      if (board[cell] !== 0) return; // Cell occupied

      board[cell] = 1;
      moves.push({ cell, player: 1 });

      const winLine = checkWinAt(board, cell, 1);
      if (winLine) {
        handleWin(1, winLine);
        return;
      }
      if (isBoardFull(board)) {
        handleDraw();
        return;
      }

      currentTurn = 2;
      persistLiveSession();
      dispatchBoardUpdate();

      // AI responds after a brief delay for natural feel
      setTimeout(() => doAiMove(), 300);
    },

    useUndo(): void {
      if (obs.gameStatus.get() !== "dealt" || gameOver || isPaused.get()) return;
      if (moves.length < 2) return; // Need at least one pair to undo
      // Bounded like every other mode: without this an unlimited rewind would
      // let a guest brute-force a win and still post a full-credit score.
      if (obs.undosUsed.get() >= MAX_UNDOS) {
        setStatus(t("undoLimitReached"), "info");
        return;
      }

      // Undo the AI's last move and the human's last move
      const aiMove = moves.pop();
      const humanMove = moves.pop();
      if (aiMove) board[aiMove.cell] = 0;
      if (humanMove) board[humanMove.cell] = 0;

      currentTurn = 1;
      const undos = obs.undosUsed.get() + 1;
      obs.undosUsed.set(undos);
      persistLiveSession();
      dispatchBoardUpdate();
      setStatus(t("guestUndoUsed"), "info");
    },

    togglePause(): void {
      if (obs.gameStatus.get() !== "dealt" || gameOver) return;
      const now = Date.now();
      if (!isPaused.get()) {
        pausedAt = now;
        isPaused.set(true);
        persistLiveSession();
        setStatus(t("guestPaused"), "info");
        return;
      }
      const pausedFor = Math.max(0, now - pausedAt);
      obs.dealtAt.set(obs.dealtAt.get() + pausedFor);
      obs.deadline.set(obs.deadline.get() + pausedFor);
      pausedAt = 0;
      isPaused.set(false);
      persistLiveSession();
      setStatus(t("guestResumed"), "info");
    },

    restartGame(form?: unknown): void {
      const difficulty = Number(
        (form as { difficulty?: unknown } | undefined)?.difficulty ?? obs.gameDifficulty.get(),
      );
      startGame({ difficulty });
    },

    expireGame(): void {
      if (obs.gameStatus.get() !== "dealt") {
        resetToLobby();
        return;
      }
      gameOver = true;
      obs.gameStatus.set("expired");
      obs.activeGameId.set("0");
      obs.lastStatus.set("");
      obs.deadline.set(0);
      isPaused.set(false);
      pausedAt = 0;
      clearPersistedSession();
      setStatus(t("guestExpired"), "info");
      dispatchBoardUpdate();
    },

    retryDeal(): void {
      /* Guest deals instantly */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby(false);
      obs.credit.set(0);
      obs.poolFree.set(GUEST_POOL);
      obs.myRank.set(0);

      const profile = readProfile(storage);
      obs.myTotalWon.set(profile.bestScore);
      obs.mySolves.set(profile.wins);
      obs.myHistory.set([]);
      walletConnected.set(true);
      obs.progressionReady.set(true);
      obs.progressionRequiredDifficulty.set(0);
      obs.progressionMaxDifficulty.set(2);
      obs.progressionHardChallengeLevel.set(0);
      obs.progressionEffectiveLimitMs.set(0);

      const saved = readSession(storage);
      if (saved) {
        try {
          obs.gameDifficulty.set(saved.difficulty);
          if (!saved.isPaused && saved.deadline <= Date.now()) {
            clearPersistedSession();
            obs.gameStatus.set("expired");
            obs.lastStatus.set(t("guestExpired"));
          } else {
            board = replayMoves(saved.moves);
            moves = [...saved.moves];
            // Determine whose turn it is
            currentTurn = moves.length % 2 === 0 ? 1 : 2;
            gameOver = false;
            pausedAt = saved.isPaused ? saved.pausedAt : 0;

            obs.activeGameId.set(GUEST_GAME_ID);
            obs.commitment.set("");
            obs.undosUsed.set(saved.undosUsed);
            obs.lastPayout.set("");
            obs.lastElapsedMs.set(0);
            obs.dealtAt.set(saved.dealtAt);
            obs.deadline.set(saved.deadline);
            isPaused.set(saved.isPaused);
            obs.gameStatus.set("dealt");
            obs.lastStatus.set(t("guestRestored"));
            dispatchBoardUpdate();

            // If it was AI's turn, let it move
            if (currentTurn === 2 && !saved.isPaused) {
              setTimeout(() => doAiMove(), 500);
            }
          }
        } catch {
          clearPersistedSession();
          resetToLobby(false);
        }
      } else {
        clearPersistedSession();
      }
      await refreshLeaderboard();
    },
  };
}
