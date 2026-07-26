import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameSessionObservables } from "@framework/game";
import { createObservable } from "../react/context";
import { createGuestEngine, type BoardStorage, type GuestEngineDeps } from "../../gomoku/src/logic/guest-engine";
import { MAX_UNDOS, ruleOf } from "../../gomoku/src/logic/game-rules";
import { CELL_COUNT, checkWinAt, checkWinner, idx, stringToBoard } from "../../gomoku/src/logic/gomoku-engine";

/**
 * Guest engine for Gomoku Arena is a purely LOCAL game: the player (black)
 * against a deterministic local AI (white). These tests drive the engine over
 * the same observables the Phaser scene reads and assert it never needs a
 * chain / oracle / reward surface — only the best-effort guest leaderboard.
 *
 * They also pin the two fairness properties the mode depends on: undos are
 * bounded by MAX_UNDOS exactly like every other mode, and the spent count
 * survives a reload so a refresh cannot launder a fresh allowance.
 */

const SESSION_KEY = "gomoku-guest-session:v1";
const PROFILE_KEY = "gomoku-guest-profile:v1";

interface SessionRecord {
  version: number;
  difficulty: number;
  dealtAt: number;
  deadline: number;
  moves: Array<{ cell: number; player: number }>;
  isPaused: boolean;
  pausedAt: number;
  undosUsed?: number;
}

function memoryStorage(seed: Record<string, unknown> = {}): BoardStorage & { raw: Map<string, unknown> } {
  const values = new Map<string, unknown>(Object.entries(seed));
  return {
    raw: values,
    get<T>(key: string, fallback: T | null = null): T | null {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key: string, value: unknown): void { values.set(key, structuredClone(value)); },
    delete(key: string): void { values.delete(key); },
  };
}

function setup(storage: BoardStorage = memoryStorage()) {
  const obs = createGameSessionObservables();
  const walletConnected = createObservable<boolean>(false);
  const isPaused = createObservable<boolean>(false);
  const submit = vi.fn(async (_score: number | string) => {});
  const rows: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => rows.slice());
  const guestLeaderboard = { submit, get };
  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  const deps: GuestEngineDeps = { obs, walletConnected, isPaused, storage, guestLeaderboard, t, setStatus };
  const engine = createGuestEngine(deps);
  return { engine, obs, walletConnected, isPaused, storage, submit, get, rows, setStatus };
}

/** Alternating human/AI moves over the given cells, human first. */
function alternating(cells: number[]): Array<{ cell: number; player: number }> {
  return cells.map((cell, i) => ({ cell, player: i % 2 === 0 ? 1 : 2 }));
}

function sessionOf(partial: Partial<SessionRecord> = {}): SessionRecord {
  return {
    version: 1,
    difficulty: 0,
    dealtAt: 1_000_000,
    deadline: 1_000_000 + ruleOf(0).limitMs,
    moves: [],
    isPaused: false,
    pausedAt: 0,
    undosUsed: 0,
    ...partial,
  };
}

/** Decoded payload of the boardUpdate frame the engine pushes to the scene. */
function lastBoardUpdate(raw: string): { type: string; board: string; currentTurn: number; gameOver: boolean; moves: number } {
  return JSON.parse(raw) as { type: string; board: string; currentTurn: number; gameOver: boolean; moves: number };
}

/**
 * A live game with ten stones placed in two harmless far-apart clusters, so
 * undo bookkeeping can be exercised without anyone being one move from five.
 */
const LIVE_TEN = alternating([
  idx(0, 0), idx(14, 14),
  idx(0, 2), idx(14, 12),
  idx(0, 4), idx(14, 10),
  idx(2, 0), idx(12, 14),
  idx(2, 2), idx(12, 12),
]);

describe("gomoku guest engine", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("enter() opens a local lobby with no chain surface and a free pool", async () => {
    const { engine, obs, walletConnected, get, submit } = setup();

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("idle");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.credit.get()).toBe(0);
    expect(obs.poolFree.get()).toBe(9999);
    expect(obs.myRank.get()).toBe(0);
    expect(obs.myHistory.get()).toEqual([]);
    // Guest mode fakes a connected wallet so the scene renders the board.
    expect(walletConnected.get()).toBe(true);
    // Progression is fully unlocked locally: every difficulty is playable.
    expect(obs.progressionReady.get()).toBe(true);
    expect(obs.progressionRequiredDifficulty.get()).toBe(0);
    expect(obs.progressionMaxDifficulty.get()).toBe(2);
    expect(obs.progressionHardChallengeLevel.get()).toBe(0);
    expect(obs.progressionEffectiveLimitMs.get()).toBe(0);
    // Reads the off-chain board, never writes a score on entry.
    expect(get).toHaveBeenCalledWith(50);
    expect(submit).not.toHaveBeenCalled();
  });

  it("enter() surfaces stored wins/best score as the local profile", async () => {
    const storage = memoryStorage({
      [PROFILE_KEY]: { version: 1, bestScore: 1234, wins: 7, losses: 3 },
    });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.myTotalWon.get()).toBe(1234);
    expect(obs.mySolves.get()).toBe(7);
  });

  it("startGame deals instantly at the requested difficulty without a leaderboard write", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const now = Date.now();
    const { engine, obs, storage, submit, get } = setup();

    engine.startGame({ difficulty: 2 });

    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.activeGameId.get()).toBe("guest");
    expect(obs.gameDifficulty.get()).toBe(2);
    expect(obs.commitment.get()).toBe("");
    expect(obs.dealtAt.get()).toBe(now);
    expect(obs.deadline.get()).toBe(now + ruleOf(2).limitMs);
    expect(obs.undosUsed.get()).toBe(0);
    expect(obs.lastPayout.get()).toBe("");
    expect(obs.lastElapsedMs.get()).toBe(0);
    expect(submit).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();

    const saved = storage.get<SessionRecord>(SESSION_KEY);
    expect(saved?.difficulty).toBe(2);
    expect(saved?.moves).toEqual([]);
    expect(saved?.undosUsed).toBe(0);
  });

  it("startGame clamps an out-of-range difficulty instead of dealing a bogus rule", () => {
    const { engine, obs } = setup();

    engine.startGame({ difficulty: 9 });
    expect(obs.gameDifficulty.get()).toBe(2);

    engine.startGame({ difficulty: -4 });
    expect(obs.gameDifficulty.get()).toBe(0);

    engine.startGame({ difficulty: "not-a-number" });
    expect(obs.gameDifficulty.get()).toBe(0);
  });

  it("selectDifficulty clamps the lobby selection", () => {
    const { engine, obs } = setup();

    engine.selectDifficulty({ difficulty: 1 });
    expect(obs.gameDifficulty.get()).toBe(1);

    engine.selectDifficulty({ difficulty: 12 });
    expect(obs.gameDifficulty.get()).toBe(2);

    engine.selectDifficulty({});
    expect(obs.gameDifficulty.get()).toBe(0);
  });

  it("restartGame re-deals at the requested difficulty and drops the old board", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const storage = memoryStorage({ [SESSION_KEY]: sessionOf({ moves: LIVE_TEN, dealtAt: Date.now(), deadline: Date.now() + ruleOf(0).limitMs }) });
    const { engine, obs } = setup(storage);
    await engine.enter();
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(10);

    engine.restartGame({ difficulty: 1 });

    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.gameDifficulty.get()).toBe(1);
    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.moves).toBe(0);
    expect(frame.currentTurn).toBe(1);
    expect(frame.board).toBe("0".repeat(CELL_COUNT));
  });

  it("placeStone publishes a boardUpdate frame the scene can decode", () => {
    vi.useFakeTimers();
    const { engine, obs } = setup();
    engine.startGame({ difficulty: 0 });

    engine.placeStone({ cell: idx(7, 7) });

    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.type).toBe("boardUpdate");
    expect(frame.board).toHaveLength(CELL_COUNT);
    expect(frame.board[idx(7, 7)]).toBe("1");
    expect(frame.currentTurn).toBe(2);
    expect(frame.gameOver).toBe(false);
    expect(frame.moves).toBe(1);
  });

  it("the AI answers a human stone after its think delay", async () => {
    vi.useFakeTimers();
    const { engine, obs } = setup();
    engine.startGame({ difficulty: 0 });

    engine.placeStone({ cell: idx(7, 7) });
    expect(lastBoardUpdate(obs.lastStatus.get()).currentTurn).toBe(2);

    await vi.advanceTimersByTimeAsync(300);

    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.moves).toBe(2);
    expect(frame.currentTurn).toBe(1);
    const board = stringToBoard(frame.board);
    expect(board.filter((cell) => cell === 2)).toHaveLength(1);
  });

  it("placeStone rejects every illegal move without corrupting the board", async () => {
    vi.useFakeTimers();
    const { engine, obs, isPaused } = setup();

    // Not dealt yet.
    engine.placeStone({ cell: idx(7, 7) });
    expect(obs.lastStatus.get()).toBe("");

    engine.startGame({ difficulty: 0 });
    const empty = "0".repeat(CELL_COUNT);

    for (const bad of [-1, CELL_COUNT, 3.5, Number.NaN, "abc", null, undefined]) {
      engine.placeStone({ cell: bad });
    }
    engine.placeStone({});
    engine.placeStone(null);
    expect(lastBoardUpdate(obs.lastStatus.get()).board).toBe(empty);

    engine.placeStone({ cell: idx(7, 7) });
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(1);

    // Human cannot move again while the AI owes a reply.
    engine.placeStone({ cell: idx(7, 8) });
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(1);

    await vi.advanceTimersByTimeAsync(300);
    const afterAi = lastBoardUpdate(obs.lastStatus.get());

    // Occupied cell is refused.
    engine.placeStone({ cell: idx(7, 7) });
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(afterAi.moves);

    // Paused board is frozen.
    isPaused.set(true);
    engine.placeStone({ cell: idx(0, 0) });
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(afterAi.moves);
  });

  it("a human five scores, banks the profile, submits once, then reloads the board", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    // Human holds (7,3)..(7,6); AI stones parked in far corners.
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: alternating([
          idx(7, 3), idx(0, 0),
          idx(7, 4), idx(0, 1),
          idx(7, 5), idx(14, 14),
          idx(7, 6), idx(14, 13),
        ]),
      }),
    });
    const { engine, obs, submit, get, setStatus } = setup(storage);
    await engine.enter();
    expect(obs.gameStatus.get()).toBe("dealt");
    get.mockClear();

    vi.setSystemTime(dealtAt + 42_000);
    engine.placeStone({ cell: idx(7, 7) });

    expect(obs.gameStatus.get()).toBe("solved");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.lastElapsedMs.get()).toBe(42_000);

    // score = (difficulty+1)*400 + remainingSec + max(0, 100 - moves*2)
    const remainingSec = Math.round((ruleOf(0).limitMs - 42_000) / 1000);
    const expected = 400 + remainingSec + Math.max(0, 100 - 9 * 2);
    expect(obs.lastPayout.get()).toBe(String(expected));
    expect(obs.myTotalWon.get()).toBe(expected);
    expect(obs.mySolves.get()).toBe(1);
    expect(setStatus).toHaveBeenCalledWith(`guestWin:{"score":${expected}}`, "success");

    const profile = storage.get<{ bestScore: number; wins: number; losses: number }>(PROFILE_KEY);
    expect(profile).toEqual({ version: 1, bestScore: expected, wins: 1, losses: 0 });
    // Finished game is not resumable.
    expect(storage.get(SESSION_KEY)).toBeNull();

    await vi.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(expected);
    expect(get).toHaveBeenCalledWith(50);
  });

  it("keeps the previous best score when a later win is worse", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [PROFILE_KEY]: { version: 1, bestScore: 999_999, wins: 4, losses: 1 },
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: alternating([
          idx(7, 3), idx(0, 0),
          idx(7, 4), idx(0, 1),
          idx(7, 5), idx(14, 14),
          idx(7, 6), idx(14, 13),
        ]),
      }),
    });
    const { engine, obs } = setup(storage);
    await engine.enter();

    engine.placeStone({ cell: idx(7, 7) });

    expect(obs.gameStatus.get()).toBe("solved");
    expect(obs.myTotalWon.get()).toBe(999_999);
    expect(obs.mySolves.get()).toBe(5);
    const profile = storage.get<{ bestScore: number; wins: number }>(PROFILE_KEY);
    expect(profile?.bestScore).toBe(999_999);
    expect(profile?.wins).toBe(5);
  });

  it("an AI five ends the game as a loss with no score submitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    // AI owns an open four on row 3; the restored turn belongs to the AI.
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: [
          { cell: idx(3, 3), player: 2 },
          { cell: idx(3, 4), player: 2 },
          { cell: idx(3, 5), player: 2 },
          { cell: idx(3, 6), player: 2 },
          { cell: idx(12, 0), player: 1 },
          { cell: idx(12, 3), player: 1 },
          { cell: idx(12, 6), player: 1 },
        ],
      }),
    });
    const { engine, obs, submit, setStatus } = setup(storage);
    await engine.enter();
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(lastBoardUpdate(obs.lastStatus.get()).currentTurn).toBe(2);

    await vi.advanceTimersByTimeAsync(500);

    expect(obs.gameStatus.get()).toBe("expired");
    expect(obs.activeGameId.get()).toBe("0");
    expect(setStatus).toHaveBeenCalledWith("guestLose", "info");
    expect(submit).not.toHaveBeenCalled();
    expect(obs.lastPayout.get()).toBe("");

    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.gameOver).toBe(true);
    const won = checkWinner(stringToBoard(frame.board));
    expect(won.winner).toBe(2);

    const profile = storage.get<{ wins: number; losses: number }>(PROFILE_KEY);
    expect(profile).toEqual({ version: 1, bestScore: 0, wins: 0, losses: 1 });
    expect(storage.get(SESSION_KEY)).toBeNull();
  });

  it("a full board with no five settles as a draw", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    // (r + 2c) % 4 < 2 colouring caps every run at two stones, so a full
    // board has no five in any direction. (0,0) is left for the last move.
    const colorOf = (cell: number): number => {
      const r = Math.floor(cell / 15);
      const c = cell % 15;
      return (r + 2 * c) % 4 < 2 ? 1 : 2;
    };
    const human: number[] = [];
    const ai: number[] = [];
    for (let cell = 1; cell < CELL_COUNT; cell++) {
      (colorOf(cell) === 1 ? human : ai).push(cell);
    }
    expect(human).toHaveLength(112);
    expect(ai).toHaveLength(112);
    const moves: Array<{ cell: number; player: number }> = [];
    for (let i = 0; i < 112; i++) {
      moves.push({ cell: human[i]!, player: 1 });
      moves.push({ cell: ai[i]!, player: 2 });
    }

    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves }),
    });
    const { engine, obs, submit, setStatus } = setup(storage);
    await engine.enter();
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(lastBoardUpdate(obs.lastStatus.get()).currentTurn).toBe(1);

    engine.placeStone({ cell: 0 });

    expect(obs.gameStatus.get()).toBe("expired");
    expect(obs.activeGameId.get()).toBe("0");
    expect(setStatus).toHaveBeenCalledWith("guestDraw", "info");
    expect(submit).not.toHaveBeenCalled();

    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.gameOver).toBe(true);
    expect(frame.board).not.toContain("0");
    const settled = checkWinner(stringToBoard(frame.board));
    expect(settled.winner).toBe(0);
    expect(settled.draw).toBe(true);
    expect(storage.get(SESSION_KEY)).toBeNull();
  });

  it("undo rewinds a human/AI pair and stops at the MAX_UNDOS allowance", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN }),
    });
    const { engine, obs, setStatus } = setup(storage);
    await engine.enter();
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(10);

    for (let n = 1; n <= MAX_UNDOS; n++) {
      engine.useUndo();
      expect(obs.undosUsed.get()).toBe(n);
      const frame = lastBoardUpdate(obs.lastStatus.get());
      expect(frame.moves).toBe(10 - n * 2);
      // Rewinding always hands the move back to the human.
      expect(frame.currentTurn).toBe(1);
      expect(setStatus).toHaveBeenLastCalledWith("guestUndoUsed", "info");
    }

    // Bounded like every other mode: an unlimited rewind would let a guest
    // brute-force a win and still post a full-credit score.
    const spent = lastBoardUpdate(obs.lastStatus.get());
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(MAX_UNDOS);
    expect(lastBoardUpdate(obs.lastStatus.get())).toEqual(spent);
    expect(setStatus).toHaveBeenLastCalledWith("undoLimitReached", "info");
  });

  it("undo clears the board cells it rewinds so they can be replayed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN }),
    });
    const { engine, obs } = setup(storage);
    await engine.enter();
    const lastHuman = LIVE_TEN[8]!.cell;
    const lastAi = LIVE_TEN[9]!.cell;

    engine.useUndo();

    const board = stringToBoard(lastBoardUpdate(obs.lastStatus.get()).board);
    expect(board[lastHuman]).toBe(0);
    expect(board[lastAi]).toBe(0);

    // The freed cell is playable again.
    engine.placeStone({ cell: lastHuman });
    expect(stringToBoard(lastBoardUpdate(obs.lastStatus.get()).board)[lastHuman]).toBe(1);
  });

  it("undo is a no-op before a full pair exists, while paused, and outside a live game", async () => {
    vi.useFakeTimers();
    const { engine, obs, isPaused, setStatus } = setup();

    // No live game.
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(0);
    expect(setStatus).not.toHaveBeenCalled();

    engine.startGame({ difficulty: 0 });
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(0);

    engine.placeStone({ cell: idx(7, 7) });
    // Only the human stone is down — nothing to rewind as a pair yet.
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(0);

    await vi.advanceTimersByTimeAsync(300);
    isPaused.set(true);
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(0);

    isPaused.set(false);
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(1);
  });

  it("a reload cannot launder the spent undo allowance back to zero", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN }),
    });
    const first = setup(storage);
    await first.engine.enter();
    for (let n = 0; n < MAX_UNDOS; n++) first.engine.useUndo();
    expect(first.obs.undosUsed.get()).toBe(MAX_UNDOS);
    expect(storage.get<SessionRecord>(SESSION_KEY)?.undosUsed).toBe(MAX_UNDOS);

    const second = setup(storage);
    await second.engine.enter();

    expect(second.obs.gameStatus.get()).toBe("dealt");
    expect(second.obs.undosUsed.get()).toBe(MAX_UNDOS);
    second.engine.useUndo();
    expect(second.obs.undosUsed.get()).toBe(MAX_UNDOS);
    expect(second.setStatus).toHaveBeenLastCalledWith("undoLimitReached", "info");
  });

  it("restores a pre-undo-counter record as a full allowance instead of rejecting it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const legacy = sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN });
    delete legacy.undosUsed;
    const storage = memoryStorage({ [SESSION_KEY]: legacy });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.undosUsed.get()).toBe(0);
    engine.useUndo();
    expect(obs.undosUsed.get()).toBe(1);
  });

  it("clamps an inflated undo counter down to the allowance", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN, undosUsed: 99 }),
    });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.undosUsed.get()).toBe(MAX_UNDOS);
  });

  it("drops a session record whose fields are not the shape it wrote", async () => {
    const dealtAt = 1_000_000;
    const good = { dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN };
    const corrupt: unknown[] = [
      null,
      "not-an-object",
      sessionOf({ ...good, version: 2 }),
      sessionOf({ ...good, difficulty: 3 }),
      sessionOf({ ...good, difficulty: -1 }),
      sessionOf({ ...good, difficulty: 1.5 }),
      sessionOf({ ...good, dealtAt: 0 }),
      sessionOf({ ...good, dealtAt: Number.NaN }),
      sessionOf({ ...good, deadline: dealtAt }),
      sessionOf({ ...good, deadline: dealtAt - 1 }),
      { ...sessionOf(good), moves: "nope" },
      { ...sessionOf(good), isPaused: "yes" },
      sessionOf({ ...good, pausedAt: -1 }),
      sessionOf({ ...good, undosUsed: -1 }),
      sessionOf({ ...good, undosUsed: 1.5 }),
      { ...sessionOf(good), undosUsed: "1" },
    ];

    for (const record of corrupt) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
      const storage = memoryStorage({ [SESSION_KEY]: record });
      const { engine, obs } = setup(storage);

      await engine.enter();

      expect(obs.gameStatus.get()).toBe("idle");
      expect(obs.activeGameId.get()).toBe("0");
      // A record it cannot trust is discarded, not carried forward.
      expect(storage.get(SESSION_KEY)).toBeNull();
      vi.useRealTimers();
    }
  });

  it("skips replaying a move that points outside the board", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: [
          { cell: idx(7, 7), player: 1 },
          { cell: CELL_COUNT + 5, player: 2 },
        ],
      }),
    });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("dealt");
    const board = stringToBoard(lastBoardUpdate(obs.lastStatus.get()).board);
    expect(board[idx(7, 7)]).toBe(1);
    expect(board.filter((cell) => cell !== 0)).toHaveLength(1);
  });

  it("expires a restored session whose clock ran out while away", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now() - ruleOf(0).limitMs - 60_000;
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves: LIVE_TEN }),
    });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("expired");
    expect(obs.lastStatus.get()).toBe("guestExpired");
    expect(storage.get(SESSION_KEY)).toBeNull();
  });

  it("keeps a paused session alive even past its stored deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now() - ruleOf(0).limitMs - 60_000;
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: LIVE_TEN,
        isPaused: true,
        pausedAt: dealtAt + 1_000,
      }),
    });
    const { engine, obs, isPaused } = setup(storage);

    await engine.enter();

    // The player paused: the countdown is theirs to resume, not to lose.
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(isPaused.get()).toBe(true);
    expect(obs.activeGameId.get()).toBe("guest");
    expect(obs.dealtAt.get()).toBe(dealtAt);
  });

  it("restores a mid-game board with the turn the move count implies", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        difficulty: 1,
        dealtAt,
        deadline: dealtAt + ruleOf(1).limitMs,
        moves: LIVE_TEN,
        undosUsed: 1,
      }),
    });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.gameDifficulty.get()).toBe(1);
    expect(obs.activeGameId.get()).toBe("guest");
    expect(obs.commitment.get()).toBe("");
    expect(obs.dealtAt.get()).toBe(dealtAt);
    expect(obs.deadline.get()).toBe(dealtAt + ruleOf(1).limitMs);
    expect(obs.undosUsed.get()).toBe(1);
    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.moves).toBe(10);
    expect(frame.currentTurn).toBe(1);
    expect(frame.gameOver).toBe(false);
  });

  it("finishes the AI's owed reply when a restored board is mid-turn", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: [...LIVE_TEN, { cell: idx(6, 6), player: 1 }],
      }),
    });
    const { engine, obs } = setup(storage);

    await engine.enter();
    expect(lastBoardUpdate(obs.lastStatus.get()).currentTurn).toBe(2);

    await vi.advanceTimersByTimeAsync(500);

    const frame = lastBoardUpdate(obs.lastStatus.get());
    expect(frame.moves).toBe(12);
    expect(frame.currentTurn).toBe(1);
  });

  it("does not move for a paused AI turn until the player resumes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: [...LIVE_TEN, { cell: idx(6, 6), player: 1 }],
        isPaused: true,
        pausedAt: dealtAt + 1_000,
      }),
    });
    const { engine, obs } = setup(storage);

    await engine.enter();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(11);
  });

  it("togglePause credits the paused span back to both clocks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const { engine, obs, isPaused, setStatus } = setup();
    engine.startGame({ difficulty: 0 });
    const dealtAt = obs.dealtAt.get();
    const deadline = obs.deadline.get();

    engine.togglePause();
    expect(isPaused.get()).toBe(true);
    expect(setStatus).toHaveBeenLastCalledWith("guestPaused", "info");

    vi.setSystemTime(dealtAt + 45_000);
    engine.togglePause();

    expect(isPaused.get()).toBe(false);
    // Elapsed time is measured from dealtAt for scoring, so both shift.
    expect(obs.dealtAt.get()).toBe(dealtAt + 45_000);
    expect(obs.deadline.get()).toBe(deadline + 45_000);
    expect(setStatus).toHaveBeenLastCalledWith("guestResumed", "info");
  });

  it("togglePause is inert outside a live game", () => {
    const { engine, isPaused, setStatus } = setup();

    engine.togglePause();

    expect(isPaused.get()).toBe(false);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("expireGame ends a live board and resets a stale lobby", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const storage = memoryStorage();
    const { engine, obs, setStatus } = setup(storage);
    engine.startGame({ difficulty: 0 });

    engine.expireGame();

    expect(obs.gameStatus.get()).toBe("expired");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.deadline.get()).toBe(0);
    expect(setStatus).toHaveBeenCalledWith("guestExpired", "info");
    expect(storage.get(SESSION_KEY)).toBeNull();
    expect(lastBoardUpdate(obs.lastStatus.get()).gameOver).toBe(true);

    // A second call from the finished screen just clears back to the lobby.
    engine.expireGame();
    expect(obs.gameStatus.get()).toBe("idle");
    expect(obs.lastStatus.get()).toBe("");
  });

  it("retryDeal is a safe no-op because guest deals are instant", async () => {
    vi.useFakeTimers();
    const { engine, obs, submit, get } = setup();
    engine.startGame({ difficulty: 0 });
    const before = obs.lastStatus.get();
    get.mockClear();

    engine.retryDeal();

    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.lastStatus.get()).toBe(before);
    expect(submit).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("ranks the guest board by score and truncates hostile addresses", async () => {
    const { engine, obs, rows } = setup();
    rows.push(
      { user: "NLow", score: "10" },
      { user: "N".repeat(200), score: "900" },
      { user: "NMid", score: "500" },
      { user: "NBad", score: "not-a-number" },
    );

    await engine.refreshLeaderboard();

    const ranked = obs.leaderboard.get();
    expect(ranked.map((row) => row.totalWon)).toEqual([900, 500, 10, 0]);
    expect(ranked.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(ranked[0]?.address).toHaveLength(96);
    expect(ranked[1]?.address).toBe("NMid");
    expect(ranked[3]?.totalWon).toBe(0);
    expect(ranked.every((row) => row.solves === 1 && row.isUser === false)).toBe(true);
  });

  it("empties the board rather than throwing when the guest leaderboard fails", async () => {
    const { engine, obs, get } = setup();
    obs.leaderboard.set([{ rank: 1, address: "NStale", totalWon: 5, solves: 1, isUser: false }]);
    get.mockRejectedValueOnce(new Error("offline"));

    await engine.refreshLeaderboard();

    expect(obs.leaderboard.get()).toEqual([]);
  });

  it("keeps playing when a score submit fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: alternating([
          idx(7, 3), idx(0, 0),
          idx(7, 4), idx(0, 1),
          idx(7, 5), idx(14, 14),
          idx(7, 6), idx(14, 13),
        ]),
      }),
    });
    const { engine, obs, submit } = setup(storage);
    await engine.enter();
    submit.mockRejectedValueOnce(new Error("offline"));

    engine.placeStone({ cell: idx(7, 7) });
    await vi.advanceTimersByTimeAsync(0);

    // The local result still stands: the board is best-effort only.
    expect(obs.gameStatus.get()).toBe("solved");
    expect(Number(obs.lastPayout.get())).toBeGreaterThan(0);
  });

  it("plays on when persistence is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const hostile: BoardStorage = {
      get: () => { throw new Error("blocked"); },
      set: () => { throw new Error("full"); },
      delete: () => { throw new Error("blocked"); },
    };
    const { engine, obs } = setup(hostile);

    await engine.enter();
    expect(obs.gameStatus.get()).toBe("idle");

    engine.startGame({ difficulty: 0 });
    expect(obs.gameStatus.get()).toBe("dealt");

    engine.placeStone({ cell: idx(7, 7) });
    await vi.advanceTimersByTimeAsync(300);
    expect(lastBoardUpdate(obs.lastStatus.get()).moves).toBe(2);
  });

  it("returns to the lobby when a stored board cannot be replayed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    // A record that passes the shape check (`moves` is a real array) but whose
    // entries blow up when the replay reads them.
    const moves: Array<{ cell: number; player: number }> = [...LIVE_TEN];
    moves.push({
      player: 1,
      get cell(): number { throw new Error("hostile"); },
    } as unknown as { cell: number; player: number });
    const record = sessionOf({ dealtAt, deadline: dealtAt + ruleOf(0).limitMs, moves });
    const storage = memoryStorage({ [SESSION_KEY]: record });
    const { engine, obs } = setup(storage);

    await engine.enter();

    expect(obs.gameStatus.get()).toBe("idle");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.undosUsed.get()).toBe(0);
  });

  it("keeps the win line contiguous for the stroke the scene draws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const dealtAt = Date.now();
    const storage = memoryStorage({
      [SESSION_KEY]: sessionOf({
        dealtAt,
        deadline: dealtAt + ruleOf(0).limitMs,
        moves: alternating([
          idx(7, 3), idx(0, 0),
          idx(7, 4), idx(0, 1),
          idx(7, 6), idx(14, 14),
          idx(7, 7), idx(14, 13),
        ]),
      }),
    });
    const { engine, obs } = setup(storage);
    await engine.enter();

    // The gap-filling stone: the run is built around it, not from it.
    engine.placeStone({ cell: idx(7, 5) });

    expect(obs.gameStatus.get()).toBe("solved");
    const board = stringToBoard(lastBoardUpdate(obs.lastStatus.get()).board);
    const line = checkWinAt(board, idx(7, 5), 1);
    expect(line).toEqual([idx(7, 3), idx(7, 4), idx(7, 5), idx(7, 6), idx(7, 7)]);
  });
});
