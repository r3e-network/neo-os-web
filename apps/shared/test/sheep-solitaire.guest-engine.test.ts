import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../sheep-solitaire/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../sheep-solitaire/src/logic/guest-engine";
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

function setup() {
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

  const deps: GuestEngineDeps = { ...obs, guestLeaderboard, t, setStatus };
  const engine = createGuestEngine(deps);

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

  return { engine, ...obs, submit, get, boardRows, setStatus, notPicked, pickTopLayer, pickAnyExposed };
}

afterEach(() => {
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
    // The whole top layer (8 distinct symbols) is exposed at deal.
    expect(h.pileCards.get().filter((c) => c.layer === 0 && c.exposed)).toHaveLength(8);
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
    expect(h.submit).toHaveBeenCalledWith(3); // full clear = all tiles
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after the win
  });

  it("ends the run as game over when the tray fills without a match", () => {
    const h = setup();
    h.engine.startGame(0);

    // The 8 top-layer cards are all distinct symbols; 7 picks fill the tray.
    for (let i = 0; i < 7; i++) h.pickTopLayer();

    expect(h.slotCards.get()).toHaveLength(7);
    expect(h.isGameOver.get()).toBe(true);
    // gameStatus stays "dealt" + isGameOver (the frozen scene's result trigger).
    expect(h.gameStatus.get()).toBe("dealt");
    // Zero tiles cleared → best-effort submit is skipped for a 0 score.
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("undo returns the whole tray to the pile and burns an undo", () => {
    const h = setup();
    h.engine.startGame(0);
    h.pickTopLayer();
    h.pickTopLayer();
    h.pickTopLayer();
    expect(h.slotCards.get()).toHaveLength(3);

    h.engine.useUndo();

    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.notPicked()).toHaveLength(24);
    expect(h.undosUsed.get()).toBe(1);
  });

  it("shuffle empties the tray, reshuffles, and consumes its one use", () => {
    const h = setup();
    h.engine.startGame(0);
    h.pickTopLayer();
    h.pickTopLayer();

    h.engine.useShuffle();

    expect(h.slotCards.get()).toHaveLength(0);
    expect(h.notPicked()).toHaveLength(24);
    expect(h.shuffleLeft.get()).toBe(0);
    // A reshuffle preserves every symbol's {0,3} multiplicity (still 8 x 3).
    const counts = new Map<number, number>();
    for (const c of h.pileCards.get()) counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBe(3);
  });

  it("remove-3 frees three tray slots back to the pile and consumes its one use", () => {
    const h = setup();
    h.engine.startGame(0);
    for (let i = 0; i < 4; i++) h.pickTopLayer();
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
