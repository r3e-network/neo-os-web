import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../sheep-solitaire/src/logic/guest-engine";
import {
  GUEST_RUN_STORAGE_KEY,
  type GuestEngineDeps,
  type GuestStorage,
} from "../../sheep-solitaire/src/logic/guest-engine";
import { ruleOf } from "../../sheep-solitaire/src/logic/game-rules";

/**
 * Guest engine tests for Sheep Solitaire.
 *
 * The guest engine is a purely LOCAL match-3 tile game — it drives the same
 * scene observables the gamefi flow does while making ZERO chain / oracle /
 * reward calls. These tests exercise the local pick / match / tool / end-state
 * rules and assert the off-chain leaderboard is the ONLY external surface it
 * ever touches (and only on settle / refresh, never during play).
 */

// A controllable layout so a deterministic win can be forced; null → real layout.
type Layout = {
  cards: Array<{ id: number; symbol: number; layer: number; col: number; row: number }>;
  totalCards: number;
  cardTypes: number;
};
const layoutMock = vi.hoisted(() => ({ result: null as Layout | null }));
const activeEngines: Array<{ dispose(): void }> = [];

vi.mock("../../sheep-solitaire/src/logic/sheep-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../sheep-solitaire/src/logic/sheep-engine")>();
  return {
    ...actual,
    generateCardLayout: (seed: number, cardTypes: number) =>
      layoutMock.result ?? actual.generateCardLayout(seed, cardTypes),
  };
});

interface CardView {
  id: number;
  symbol: number;
  layer: number;
  exposed: boolean;
  picked: boolean;
}

function memoryStorage(): GuestStorage & { has(key: string): boolean; write(key: string, value: unknown): void } {
  const values = new Map<string, unknown>();
  return {
    get: <T,>(key: string, fallback: T): T => (values.has(key) ? values.get(key) as T : fallback),
    set: (key, value) => values.set(key, structuredClone(value)),
    delete: (key) => { values.delete(key); },
    has: (key) => values.has(key),
    write: (key, value) => values.set(key, structuredClone(value)),
  };
}

function setup(storage?: GuestStorage) {
  const obs = {
    gameStatus: createObservable("idle"),
    activeGameId: createObservable("0"),
    gameDifficulty: createObservable(0),
    commitment: createObservable(""),
    dealtAt: createObservable(0),
    deadline: createObservable(0),
    undosUsed: createObservable(0),
    pileCards: createObservable<CardView[]>([]),
    slotCards: createObservable<CardView[]>([]),
    isMatching: createObservable(false),
    isGameOver: createObservable(false),
    failureReason: createObservable<"none" | "tray" | "timeout">("none"),
    shuffleLeft: createObservable(1),
    remove3Left: createObservable(1),
    isStarting: createObservable(false),
    isDealing: createObservable(false),
    isSubmitting: createObservable(false),
    isUndoing: createObservable(false),
    isPicking: createObservable(false),
    lastPayout: createObservable(""),
    lastElapsedMs: createObservable(0),
    leaderboard: createObservable<Array<{ rank: number; address: string; totalWon: number; solves: number; isUser: boolean }>>([]),
    myRank: createObservable(0),
    myTotalWon: createObservable(0),
    mySolves: createObservable(0),
    myHistory: createObservable<unknown[]>([]),
    credit: createObservable(0),
    poolFree: createObservable(0),
    lastStatus: createObservable(""),
  };

  const submit = vi.fn(async (_score: number | string) => {});
  const boardRows: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => boardRows.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = { ...obs, guestLeaderboard, storage, t, setStatus };
  const engine = createGuestEngine(deps);
  activeEngines.push(engine);

  const notPicked = () => obs.pileCards.get().filter((c) => !c.picked);
  const pickTopLayer = () => {
    const card = obs.pileCards.get().find((c) => c.exposed && c.layer === 0 && !c.picked);
    if (card) engine.pickCard(card.id);
    return card?.id;
  };
  const pickAnyExposed = () => {
    const card = obs.pileCards.get().find((c) => c.exposed && !c.picked);
    if (card) engine.pickCard(card.id);
    return card?.id;
  };
  const pickDistinctExposed = (count: number) => {
    const symbols = new Set<number>();
    const pickedIds: number[] = [];
    while (pickedIds.length < count) {
      const card = obs.pileCards
        .get()
        .find((candidate) => candidate.exposed && !symbols.has(candidate.symbol));
      if (!card) break;
      symbols.add(card.symbol);
      pickedIds.push(card.id);
      engine.pickCard(card.id);
    }
    return pickedIds;
  };

  return {
    engine,
    ...obs,
    submit,
    get,
    boardRows,
    setStatus,
    notPicked,
    pickTopLayer,
    pickAnyExposed,
    pickDistinctExposed,
  };
}

afterEach(() => {
  activeEngines.splice(0).forEach((engine) => engine.dispose());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  layoutMock.result = null;
});

describe("sheep-solitaire guest engine", () => {
  it("deals a fully local board on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame(0);

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.activeGameId.get()).toBe("guest");
    expect(h.commitment.get()).toBe(""); // no on-chain commitment in guest
    expect(h.pileCards.get()).toHaveLength(24); // easy = 8 types x 3
    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.shuffleLeft.get()).toBe(1);
    expect(h.remove3Left.get()).toBe(1);
    expect(h.undosUsed.get()).toBe(0);
    expect(h.deadline.get() - h.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // The whole top layer is exposed and contains four immediately playable
    // triples, rather than seven-plus distinct tiles that force a tray lock.
    const exposedTop = h.pileCards.get().filter((c) => c.layer === 0 && c.exposed);
    expect(exposedTop).toHaveLength(12);
    const topCounts = new Map<number, number>();
    for (const card of exposedTop) {
      topCounts.set(card.symbol, (topCounts.get(card.symbol) ?? 0) + 1);
    }
    expect([...topCounts.values()]).toEqual([3, 3, 3, 3]);
    // Dealing a board never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("moves an exposed card into the tray on pick and ignores unknown / blocked ids", () => {
    const h = setup();
    h.engine.startGame(0);

    const id = h.pickTopLayer();
    expect(id).toBeTypeOf("number");
    expect(h.slotCards.get()).toHaveLength(1);
    expect(h.notPicked()).toHaveLength(23);

    // Unknown id + a definitely-blocked bottom-layer card are both no-ops.
    h.engine.pickCard(9999);
    const blocked = h.pileCards.get().find((c) => !c.exposed);
    if (blocked) h.engine.pickCard(blocked.id);
    expect(h.slotCards.get()).toHaveLength(1);
    // Picking never writes to the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("auto-eliminates a completed triple and settles a full clear as a win", async () => {
    // Force a single-symbol, 3-layer stack so peeling collects a matching triple.
    layoutMock.result = {
      cards: [
        { id: 0, symbol: 0, layer: 0, col: 0, row: 0 },
        { id: 1, symbol: 0, layer: 1, col: 0, row: 0 },
        { id: 2, symbol: 0, layer: 2, col: 0, row: 0 },
      ],
      totalCards: 3,
      cardTypes: 1,
    };
    const h = setup();
    h.engine.startGame(0);

    h.pickAnyExposed(); // id 0 (top)
    expect(h.slotCards.get()).toHaveLength(1);
    h.pickAnyExposed(); // id 1 (now exposed)
    expect(h.slotCards.get()).toHaveLength(2);
    h.pickAnyExposed(); // id 2 → completes the triple → match → board cleared

    await Promise.resolve();
    await Promise.resolve();

    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.notPicked()).toHaveLength(0);
    expect(h.gameStatus.get()).toBe("solved");
    expect(h.lastPayout.get()).toBe(""); // no GAS payout in guest
    expect(h.myTotalWon.get()).toBe(3); // free-play best clear, not a GAS amount
    expect(h.mySolves.get()).toBe(1);
    expect(h.submit).toHaveBeenCalledWith(3); // full clear = all tiles
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after the win
  });

  it.each([
    [0, "easy"],
    [1, "medium"],
    [2, "hard"],
  ])("clears the real generated %s/%s board using exposed triples only", async (difficulty) => {
    const h = setup();
    h.engine.startGame(difficulty);
    const expectedCards = ruleOf(difficulty).cardTypes * 3;
    let guard = expectedCards + 1;

    while (h.gameStatus.get() === "dealt" && !h.isGameOver.get() && guard > 0) {
      guard -= 1;
      const exposedBySymbol = new Map<number, CardView[]>();
      for (const card of h.pileCards.get()) {
        if (!card.exposed || card.picked) continue;
        const group = exposedBySymbol.get(card.symbol) ?? [];
        group.push(card);
        exposedBySymbol.set(card.symbol, group);
      }
      const triple = [...exposedBySymbol.values()].find((group) => group.length >= 3);
      expect(triple, `stalled with ${h.pileCards.get().length} cards`).toBeDefined();
      if (!triple) break;

      for (const card of triple.slice(0, 3)) h.engine.pickCard(card.id);
      expect(h.slotCards.get()).toHaveLength(0);
      expect(h.isGameOver.get()).toBe(false);
    }

    await vi.waitFor(() => expect(h.submit).toHaveBeenCalledWith(expectedCards));
    expect(guard).toBeGreaterThan(0);
    expect(h.gameStatus.get()).toBe("solved");
    expect(h.pileCards.get()).toHaveLength(0);
    expect(h.slotCards.get()).toHaveLength(0);
  });

  it("ends the run as game over when the tray fills without a match", () => {
    // Keep a deliberately invalid/dead fixture to test the loss transition in
    // isolation. Production layouts no longer start in this state.
    layoutMock.result = {
      cards: Array.from({ length: 8 }, (_, id) => ({
        id,
        symbol: id,
        layer: 0,
        col: id % 4,
        row: Math.floor(id / 4),
      })),
      totalCards: 8,
      cardTypes: 8,
    };
    const h = setup();
    h.engine.startGame(0);

    // The 8 top-layer cards are all distinct symbols; 7 picks fill the tray.
    for (let i = 0; i < 7; i++) h.pickTopLayer();

    expect(h.slotCards.get()).toHaveLength(7);
    expect(h.isGameOver.get()).toBe(true);
    // gameStatus stays "dealt" + isGameOver (the frozen scene's result trigger).
    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.failureReason.get()).toBe("tray");
    // Zero tiles cleared → best-effort submit is skipped for a 0 score.
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("locks a local board at its real deadline and cancels the timer on reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    const h = setup();
    h.engine.startGame(0);

    await vi.advanceTimersByTimeAsync(ruleOf(0).limitMs);

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.isGameOver.get()).toBe(true);
    expect(h.failureReason.get()).toBe("timeout");
    expect(h.lastStatus.get()).toBe("guestTimeUpHint");

    h.engine.expireGame();
    expect(h.gameStatus.get()).toBe("idle");
    expect(h.failureReason.get()).toBe("none");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("undo returns the most recent tray tile to the pile and burns an undo", () => {
    const h = setup();
    h.engine.startGame(0);
    expect(h.pickDistinctExposed(3)).toHaveLength(3);
    expect(h.slotCards.get()).toHaveLength(3);

    h.engine.useUndo();

    expect(h.slotCards.get()).toHaveLength(2);
    expect(h.notPicked()).toHaveLength(22);
    expect(h.undosUsed.get()).toBe(1);
  });

  it("shuffle empties the tray, reshuffles, and consumes its one use", () => {
    const h = setup();
    h.engine.startGame(0);
    expect(h.pickDistinctExposed(2)).toHaveLength(2);

    h.engine.useShuffle();

    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.notPicked()).toHaveLength(24);
    expect(h.shuffleLeft.get()).toBe(0);
    // A reshuffle preserves every symbol's {0,3} multiplicity (still 8 x 3).
    const counts = new Map<number, number>();
    for (const c of h.pileCards.get()) counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBe(3);

    // The shuffle keeps complete triples within a layer, so it remains
    // constructively solvable instead of becoming a random dead board.
    let guard = 30;
    while (h.gameStatus.get() === "dealt" && guard > 0) {
      guard -= 1;
      const exposedBySymbol = new Map<number, CardView[]>();
      for (const card of h.pileCards.get()) {
        if (!card.exposed) continue;
        const group = exposedBySymbol.get(card.symbol) ?? [];
        group.push(card);
        exposedBySymbol.set(card.symbol, group);
      }
      const triple = [...exposedBySymbol.values()].find((group) => group.length >= 3);
      expect(triple).toBeDefined();
      if (!triple) break;
      triple.slice(0, 3).forEach((card) => h.engine.pickCard(card.id));
    }
    expect(h.gameStatus.get()).toBe("solved");
  });

  it("remove-3 frees three tray slots back to the pile and consumes its one use", () => {
    const h = setup();
    h.engine.startGame(0);
    expect(h.pickDistinctExposed(4)).toHaveLength(4);
    expect(h.slotCards.get()).toHaveLength(4);

    h.engine.useRemove3();

    expect(h.slotCards.get()).toHaveLength(1);
    expect(h.notPicked()).toHaveLength(23);
    expect(h.remove3Left.get()).toBe(0);
  });

  it("submitRun refreshes the board and returns to a clean local lobby", async () => {
    layoutMock.result = {
      cards: [
        { id: 0, symbol: 0, layer: 0, col: 0, row: 0 },
        { id: 1, symbol: 0, layer: 1, col: 0, row: 0 },
        { id: 2, symbol: 0, layer: 2, col: 0, row: 0 },
      ],
      totalCards: 3,
      cardTypes: 1,
    };
    const h = setup();
    h.engine.startGame(0);
    h.pickAnyExposed();
    h.pickAnyExposed();
    h.pickAnyExposed(); // win
    await Promise.resolve();
    h.get.mockClear();

    await h.engine.submitRun();

    expect(h.gameStatus.get()).toBe("idle");
    expect(h.activeGameId.get()).toBe("0");
    expect(h.pileCards.get()).toHaveLength(0);
    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.get).toHaveBeenCalled();
  });

  it("expireGame resets to the lobby without any chain call", () => {
    const h = setup();
    h.engine.startGame(0);
    h.pickTopLayer();

    h.engine.expireGame();

    expect(h.gameStatus.get()).toBe("idle");
    expect(h.activeGameId.get()).toBe("0");
    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.pileCards.get()).toHaveLength(0);
  });

  it("enter() zeroes on-chain-only counters and loads the off-chain board", async () => {
    const h = setup();
    // Pretend a prior gamefi read populated these before switching to guest.
    h.credit.set(5);
    h.poolFree.set(9);
    h.myRank.set(3);
    h.myTotalWon.set(12);
    h.mySolves.set(4);

    await h.engine.enter();

    expect(h.credit.get()).toBe(0);
    expect(h.poolFree.get()).toBe(0);
    expect(h.myRank.get()).toBe(0);
    expect(h.myTotalWon.get()).toBe(0);
    expect(h.mySolves.get()).toBe(0);
    expect(h.gameStatus.get()).toBe("idle");
    expect(h.get).toHaveBeenCalled(); // guest board loaded
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("restores an exact in-progress local board after refresh", async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame(1);
    expect(first.pickDistinctExposed(2)).toHaveLength(2);
    const savedPile = first.pileCards.get();
    const savedSlots = first.slotCards.get();
    const savedDeadline = first.deadline.get();
    first.engine.dispose();

    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.gameStatus.get()).toBe("dealt");
    expect(restored.gameDifficulty.get()).toBe(1);
    expect(restored.pileCards.get()).toEqual(savedPile);
    expect(restored.slotCards.get()).toEqual(savedSlots);
    expect(restored.deadline.get()).toBe(savedDeadline);
    expect(restored.lastStatus.get()).toBe("guestProgressRestored");
    expect(restored.setStatus).toHaveBeenCalledWith("guestProgressRestored", "info");
  });

  it("rejects a corrupt saved board and returns to a clean lobby", async () => {
    const storage = memoryStorage();
    storage.write(GUEST_RUN_STORAGE_KEY, {
      version: 1,
      status: "dealt",
      difficulty: 0,
      pile: [{ id: 1, symbol: 99, layer: 0, col: 0, row: 0 }],
      slots: [],
      totalCards: 24,
      dealtAt: Date.now(),
      deadline: Date.now() + ruleOf(0).limitMs,
      undosUsed: 0,
      shuffleLeft: 1,
      remove3Left: 1,
      isGameOver: false,
      failureReason: "none",
      lastElapsedMs: 0,
    });
    const h = setup(storage);

    await h.engine.enter();

    expect(h.gameStatus.get()).toBe("idle");
    expect(h.pileCards.get()).toEqual([]);
    expect(storage.has(GUEST_RUN_STORAGE_KEY)).toBe(false);
  });

  it("restores an elapsed local board directly into its timeout result", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T02:00:00Z"));
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame(0);
    first.pickTopLayer();
    first.engine.dispose();

    vi.setSystemTime(new Date("2026-07-11T02:06:00Z"));
    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.gameStatus.get()).toBe("dealt");
    expect(restored.isGameOver.get()).toBe(true);
    expect(restored.failureReason.get()).toBe("timeout");
    expect(restored.lastStatus.get()).toBe("guestTimeUpHint");
  });

  it("fails closed instead of using Math.random when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const h = setup();

    h.engine.startGame(0);

    expect(h.gameStatus.get()).toBe("idle");
    expect(h.isStarting.get()).toBe(false);
    expect(h.lastStatus.get()).toBe("secureRandomUnavailable");
    expect(h.setStatus).toHaveBeenCalledWith("secureRandomUnavailable", "error");
  });

  it("maps the off-chain guest board into ranked leaderboard entries", async () => {
    const h = setup();
    h.boardRows.push({ user: "NplayerA", score: "18" });
    h.boardRows.push({ user: "NplayerB", score: "45" });

    await h.engine.refreshLeaderboard();

    const ranked = h.leaderboard.get();
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.address).toBe("NplayerB");
    expect(ranked[0]?.totalWon).toBe(45);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });
});
