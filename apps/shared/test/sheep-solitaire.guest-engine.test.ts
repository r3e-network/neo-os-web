import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../sheep-solitaire/src/logic/guest-engine";
import {
  GUEST_MAX_UNDOS,
  GUEST_RUN_STORAGE_KEY,
  type GuestEngineDeps,
  type GuestStorage,
} from "../../sheep-solitaire/src/logic/guest-engine";
// These engine exports are NOT overridden by the vi.mock below (its factory
// spreads the actual module), so they are the real implementations; the two
// generator wrappers fall through to the real ones while layoutMock is null.
import {
  DAILY_LEVEL_PRESETS,
  cardUnitPos,
  computeExposed,
  generateDailyLevel,
  generateTightLayout,
  gridCovers,
  simulateSolvability,
} from "../../sheep-solitaire/src/logic/sheep-engine";
import type { CardData } from "../../sheep-solitaire/src/logic/sheep-engine";
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
// zone/stackIndex are optional here on purpose: legacy-shaped fixtures exercise
// the engine's v2 defaulting (missing zone ⇒ "grid", missing stackIndex ⇒ 0).
type Layout = {
  cards: Array<{
    id: number;
    symbol: number;
    layer: number;
    col: number;
    row: number;
    zone?: "grid" | "stackL" | "stackR";
    stackIndex?: number;
  }>;
  totalCards: number;
  cardTypes: number;
};
const layoutMock = vi.hoisted(() => ({
  result: null as Layout | null,
  daily: null as Layout | null,
}));
const activeEngines: Array<{ dispose(): void }> = [];

vi.mock("../../sheep-solitaire/src/logic/sheep-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../sheep-solitaire/src/logic/sheep-engine")>();
  return {
    ...actual,
    // The rewritten guest engine deals PRACTICE boards through generateTightLayout
    // (and daily boards through generateDailyLevel), not generateCardLayout, so the
    // deterministic-layout override now intercepts generateTightLayout — the function
    // that actually sits on the deal path. layoutMock.result === null falls through to
    // the real generator, which the "real generated board" solve tests rely on.
    generateTightLayout: (
      seed: number,
      cardTypes: number,
      opts: import("../../sheep-solitaire/src/logic/sheep-engine").TightLayoutOptions,
    ) => layoutMock.result ?? actual.generateTightLayout(seed, cardTypes, opts),
    // Same override for the DAILY deal path (generateDailyLevel samples up to 200
    // real variants, so the persistence / revive / retry tests use a synthetic
    // board of the exact contract size instead). layoutMock.daily === null falls
    // through to the real sampler, which the L1 end-to-end solve test relies on.
    generateDailyLevel: (dateSeed: number, level: 1 | 2, cardTypes: number) =>
      layoutMock.daily ?? actual.generateDailyLevel(dateSeed, level, cardTypes),
  };
});

/**
 * Synthetic daily boards of the exact v2 contract sizes (L1: 18 cards / 6
 * types grid-only, L2: 90 cards / 15 types × 6 with two 9-card side stacks).
 * The L1 board is a single fully-exposed layer in adjacent same-symbol triples
 * so a test can deterministically solve it (pick ids in order); the L2 board
 * loses deterministically by picking 7 distinct symbols, and its stacks
 * (ids 72..80 = stackL bottom→top, 81..89 = stackR) exercise stack exposure,
 * persistence, shuffle, and undo.
 */
function syntheticDaily(level: 1 | 2): Layout {
  if (level === 1) {
    return {
      cards: Array.from({ length: 18 }, (_, id) => ({
        id,
        symbol: Math.floor(id / 3),
        layer: 0,
        col: id % 6,
        row: Math.floor(id / 6),
        zone: "grid" as const,
        stackIndex: 0,
      })),
      totalCards: 18,
      cardTypes: 6,
    };
  }
  const cards: Layout["cards"] = [];
  for (let id = 0; id < 72; id += 1) {
    // Layers 0/1: 6×5 full grids; layer 2: 6×2. symbol = id % 15 → ×6 pancakes
    // 15 distinct symbols onto the fully-exposed top layer.
    const layer = id < 30 ? 0 : id < 60 ? 1 : 2;
    const local = layer === 0 ? id : layer === 1 ? id - 30 : id - 60;
    cards.push({
      id,
      symbol: id % 15,
      layer,
      col: local % 6,
      row: Math.floor(local / 6),
      zone: "grid" as const,
      stackIndex: 0,
    });
  }
  for (let depth = 0; depth < 9; depth += 1) {
    cards.push({ id: 72 + depth, symbol: (72 + depth) % 15, layer: 0, col: 0, row: 0, zone: "stackL" as const, stackIndex: depth });
    cards.push({ id: 81 + depth, symbol: (81 + depth) % 15, layer: 0, col: 0, row: 0, zone: "stackR" as const, stackIndex: depth });
  }
  return { cards, totalCards: 90, cardTypes: 15 };
}

/** Seven exposed layer-0 ids of DISTINCT symbols on the synthetic L2 board. */
const L2_DISTINCT_PICKS = [0, 1, 2, 3, 4, 5, 6] as const;

interface CardView {
  id: number;
  symbol: number;
  layer: number;
  col?: number;
  row?: number;
  exposed: boolean;
  picked: boolean;
}

function memoryStorage(): GuestStorage & {
  has(key: string): boolean;
  write(key: string, value: unknown): void;
  read(key: string): unknown;
} {
  const values = new Map<string, unknown>();
  return {
    get: <T,>(key: string, fallback: T): T => (values.has(key) ? values.get(key) as T : fallback),
    set: (key, value) => values.set(key, structuredClone(value)),
    delete: (key) => { values.delete(key); },
    has: (key) => values.has(key),
    write: (key, value) => values.set(key, structuredClone(value)),
    read: (key) => structuredClone(values.get(key)),
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
    // P1 daily/level/revive surface the rewritten engine drives. These observables
    // are declared in GuestEngineDeps and are `.set()` on every deal (startGame ->
    // level/mode/dailyDate/revivesLeft), so the harness must provide them exactly
    // like the real MiniApp wiring does; omitting them is what made every deal throw
    // "Cannot read properties of undefined (reading 'set')".
    level: createObservable(1),
    dailyDate: createObservable(0),
    revivesLeft: createObservable(0),
    mode: createObservable("practice"),
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
  layoutMock.daily = null;
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
    // Original parity: guest boards are UNTIMED — no deadline is ever armed.
    expect(h.dealtAt.get()).toBeGreaterThan(0);
    expect(h.deadline.get()).toBe(0);
    // The whole top layer (12 cards of the 4×3 grid) is exposed: the tight-layout
    // generator only swaps symbol VALUES across layers, never card positions, so
    // layer 0 stays fully packed and immediately clickable. It NO LONGER holds four
    // clean same-symbol triples up top — spread 0.12 deliberately scatters each
    // symbol's copies across layers (redesign §4.1), retiring the constructive
    // "same-layer triple" structure of the old generateCardLayout. The invariants
    // that still hold, and that guarantee a playable (non-instant-lock) opening:
    // every symbol appears exactly 3× board-wide (a legal match-3 layout), and by
    // pigeonhole (12 exposed top cards over 8 symbols) at least one symbol has ≥2
    // exposed copies up top, so progress can begin at once.
    const exposedTop = h.pileCards.get().filter((c) => c.layer === 0 && c.exposed);
    expect(exposedTop).toHaveLength(12);
    const boardCounts = new Map<number, number>();
    for (const card of h.pileCards.get()) {
      boardCounts.set(card.symbol, (boardCounts.get(card.symbol) ?? 0) + 1);
    }
    expect(boardCounts.size).toBe(8);
    for (const n of boardCounts.values()) expect(n).toBe(3);
    const topCounts = new Map<number, number>();
    for (const card of exposedTop) {
      topCounts.set(card.symbol, (topCounts.get(card.symbol) ?? 0) + 1);
    }
    expect(Math.max(...topCounts.values())).toBeGreaterThanOrEqual(2);
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
    [0, "easy", 8],
    [1, "medium", 12],
    [2, "hard", 15],
  ])("deals a legal practice %s (difficulty %s) board of the right size", (difficulty, _key, cardTypes) => {
    // The retired assertion here played each PRACTICE board to a full clear using
    // an exposed-same-layer-triples-only solver. That solver only ever witnessed
    // the old generateCardLayout's constructive solution; the tight-layout deal
    // (spread 0.12 / 0.45 / 0.82) is intentionally NOT zero-prop solvable that way
    // (medium/hard essentially always need props, redesign §4.1 & §5). The
    // guaranteed-solvable board class is the DAILY level, exercised end-to-end in
    // the next test. What every practice deal still guarantees — and what we assert
    // — is a legal, correctly-sized match-3 layout dealt with no leaderboard write.
    const h = setup();
    h.engine.startGame(difficulty);

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.mode.get()).toBe("practice");
    const cards = h.pileCards.get();
    expect(cards).toHaveLength(cardTypes * 3);
    const counts = new Map<number, number>();
    for (const card of cards) counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
    expect(counts.size).toBe(cardTypes);
    for (const n of counts.values()) expect(n).toBe(3);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("clears the daily level-1 board end-to-end with zero props (engine win)", async () => {
    // Daily level 1 is the board class the redesign GUARANTEES is zero-prop
    // solvable: generateDailyLevel samples variants until simulateSolvability
    // reports passNoItems (redesign §4.3). Playing it through the real engine with
    // a realistic strategy — complete a triple when possible, else advance a symbol
    // already in the tray, holding partials in the 7-slot tray (which the retired
    // same-layer-triple solver never did) — must reach a full clear / win. This
    // strategy was verified to win across 400 consecutive daily date seeds before
    // landing, so it is deterministic, not flaky.
    const h = setup();
    h.engine.startGame({ mode: "daily", level: 1 });

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.mode.get()).toBe("daily");
    expect(h.level.get()).toBe(1);
    const total = h.pileCards.get().length;
    expect(total).toBe(18); // daily L1 v2 preset: 6 symbol types × 3, 2 layers

    let guard = total + 1;
    while (h.gameStatus.get() === "dealt" && !h.isGameOver.get() && guard-- > 0) {
      const inTray = new Map<number, number>();
      for (const c of h.slotCards.get()) inTray.set(c.symbol, (inTray.get(c.symbol) ?? 0) + 1);
      const exposed = h.pileCards.get().filter((c) => c.exposed && !c.picked);
      const pick =
        exposed.find((c) => (inTray.get(c.symbol) ?? 0) === 2) ??
        exposed.find((c) => (inTray.get(c.symbol) ?? 0) === 1) ??
        exposed[0];
      expect(pick, `stalled with ${h.pileCards.get().length} cards`).toBeDefined();
      if (!pick) break;
      h.engine.pickCard(pick.id);
      expect(h.isGameOver.get()).toBe(false);
    }

    await vi.waitFor(() => expect(h.submit).toHaveBeenCalledWith(18));
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

  it("never times out a guest run — no countdown is armed and old limits pass harmlessly", async () => {
    // Original parity: free play has NO clock. The GameFi flow keeps its
    // TTL/deadline in main.tsx (chain/TEE constraint) — its rule clocks are
    // asserted unchanged below.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    const h = setup();
    h.engine.startGame(0);

    expect(h.deadline.get()).toBe(0);
    expect(vi.getTimerCount()).toBe(0); // no deadline timer was ever scheduled

    await vi.advanceTimersByTimeAsync(ruleOf(0).limitMs * 3);

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.isGameOver.get()).toBe(false);
    expect(h.failureReason.get()).toBe("none");
    // Picks still work long after the retired 5:00 easy limit.
    h.pickTopLayer();
    expect(h.slotCards.get()).toHaveLength(1);

    // GameFi rule times unchanged (contract mirror — do not touch).
    expect(ruleOf(0).limitMs).toBe(300_000);
    expect(ruleOf(1).limitMs).toBe(480_000);
    expect(ruleOf(2).limitMs).toBe(720_000);

    h.engine.expireGame(); // explicit player reset still works
    expect(h.gameStatus.get()).toBe("idle");
  });

  it("undo returns the most recent pick to the pile and grants exactly ONE undo per run", () => {
    const h = setup();
    h.engine.startGame(0);
    expect(h.pickDistinctExposed(3)).toHaveLength(3);
    expect(h.slotCards.get()).toHaveLength(3);

    h.engine.useUndo();

    expect(h.slotCards.get()).toHaveLength(2);
    expect(h.notPicked()).toHaveLength(22);
    expect(h.undosUsed.get()).toBe(1);

    // Original parity: guest grants ONE free undo per run — a second is a no-op.
    expect(GUEST_MAX_UNDOS).toBe(1);
    h.engine.useUndo();
    expect(h.slotCards.get()).toHaveLength(2);
    expect(h.notPicked()).toHaveLength(22);
    expect(h.undosUsed.get()).toBe(1);
  });

  it("undo removes the JUST-PICKED tile even when cluster-insertion parked it mid-tray", () => {
    // Tray [A(sym0), B(sym1)]; picking A2(sym0) cluster-inserts it between them
    // → tray [A, A2, B]. Undo must remove A2 (the last PICK), not B (the
    // rightmost tray tile), and return it to its exact board cell.
    layoutMock.result = {
      cards: [
        { id: 0, symbol: 0, layer: 0, col: 0, row: 0 },
        { id: 1, symbol: 1, layer: 0, col: 2, row: 0 },
        { id: 2, symbol: 0, layer: 0, col: 4, row: 0 },
        { id: 3, symbol: 2, layer: 0, col: 0, row: 2 },
      ],
      totalCards: 4,
      cardTypes: 3,
    };
    const h = setup();
    h.engine.startGame(0);

    h.engine.pickCard(0); // A
    h.engine.pickCard(1); // B
    h.engine.pickCard(2); // A2 → clusters next to A
    expect(h.slotCards.get().map((c) => c.id)).toEqual([0, 2, 1]);

    h.engine.useUndo();

    expect(h.slotCards.get().map((c) => c.id)).toEqual([0, 1]); // A2 left, A and B stay
    const returned = h.pileCards.get().find((c) => c.id === 2);
    expect(returned).toMatchObject({ id: 2, symbol: 0, layer: 0, col: 4, row: 0 });
    expect(returned?.exposed).toBe(true);
    expect(h.undosUsed.get()).toBe(1);
  });

  it("shuffle leaves the tray untouched, reshuffles only the board, and consumes its one use", () => {
    const h = setup();
    h.engine.startGame(0);
    expect(h.pickDistinctExposed(4)).toHaveLength(4);
    const trayBefore = h.slotCards.get();
    expect(trayBefore).toHaveLength(4);
    const pileSymbolsBefore = h.pileCards.get().map((c) => c.symbol).sort((a, b) => a - b);
    const pileCellsBefore = h.pileCards.get()
      .map((c) => `${c.id}:${c.layer}:${c.col}:${c.row}`)
      .sort();

    h.engine.useShuffle();

    // Original parity: shuffle re-randomizes only the remaining BOARD tiles —
    // the player's tray planning survives untouched.
    expect(h.slotCards.get()).toEqual(trayBefore);
    expect(h.shuffleLeft.get()).toBe(0);

    // The 20 remaining board tiles keep their exact position skeleton (only
    // symbol VALUES are permuted) and their symbol multiset, so every symbol
    // still totals exactly 3 across pile + tray.
    const pileAfter = h.pileCards.get();
    expect(pileAfter).toHaveLength(20);
    expect(
      pileAfter.map((c) => `${c.id}:${c.layer}:${c.col}:${c.row}`).sort(),
    ).toEqual(pileCellsBefore);
    expect(pileAfter.map((c) => c.symbol).sort((a, b) => a - b)).toEqual(pileSymbolsBefore);
    const counts = new Map<number, number>();
    for (const c of [...pileAfter, ...h.slotCards.get()]) {
      counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1);
    }
    expect(counts.size).toBe(8);
    for (const n of counts.values()) expect(n).toBe(3);
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
    expect(savedDeadline).toBe(0); // guest runs are untimed
    expect(restored.deadline.get()).toBe(0);
    expect(restored.lastStatus.get()).toBe("guestProgressRestored");
    expect(restored.setStatus).toHaveBeenCalledWith("guestProgressRestored", "info");

    // The restored undo stack still resolves the exact last pick.
    const trayBefore = restored.slotCards.get();
    restored.engine.useUndo();
    expect(restored.slotCards.get()).toEqual(trayBefore.slice(0, -1));
  });

  it("rejects a corrupt saved board and returns to a clean lobby", async () => {
    const storage = memoryStorage();
    storage.write(GUEST_RUN_STORAGE_KEY, {
      version: 3,
      status: "dealt",
      difficulty: 0,
      level: 1,
      dailyDate: 0,
      mode: "practice",
      pile: [{ id: 1, symbol: 99, layer: 0, col: 0, row: 0, zone: "grid", stackIndex: 0 }],
      slots: [],
      pickOrder: [],
      totalCards: 24,
      dealtAt: Date.now(),
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

  it.each([
    ["missing zone", { zone: undefined, stackIndex: 0 }],
    ["bogus zone", { zone: "stackC", stackIndex: 0 }],
    ["missing stackIndex", { zone: "grid", stackIndex: undefined }],
    ["negative stackIndex", { zone: "grid", stackIndex: -1 }],
    ["grid card with stack depth", { zone: "grid", stackIndex: 3 }],
    ["stack card on a stack-less practice board", { zone: "stackL", stackIndex: 0 }],
  ])("rejects a v3 save whose cards carry a malformed v2 field (%s)", async (_name, v2Fields) => {
    const storage = memoryStorage();
    storage.write(GUEST_RUN_STORAGE_KEY, {
      version: 3,
      status: "dealt",
      difficulty: 0,
      level: 1,
      dailyDate: 0,
      mode: "practice",
      pile: [{ id: 1, symbol: 1, layer: 0, col: 0, row: 0, ...v2Fields }],
      slots: [],
      pickOrder: [],
      totalCards: 24,
      dealtAt: Date.now(),
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

  it.each([
    [1],
    [2],
  ])("rejects a legacy v%s saved run wholesale (schema bump)", async (version) => {
    const storage = memoryStorage();
    storage.write(GUEST_RUN_STORAGE_KEY, {
      version,
      status: "dealt",
      difficulty: 0,
      level: 1,
      dailyDate: 0,
      mode: "practice",
      revivesUsed: 0,
      // v1/v2 cards predate the zone/stackIndex contract.
      pile: [{ id: 1, symbol: 1, layer: 0, col: 0, row: 0 }],
      slots: [],
      pickOrder: [],
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
    expect(storage.has(GUEST_RUN_STORAGE_KEY)).toBe(false);
  });

  it("rejects a saved run whose undo stack does not match the tray", async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame(0);
    first.pickTopLayer();
    first.engine.dispose();
    const saved = storage.read(GUEST_RUN_STORAGE_KEY) as Record<string, unknown>;
    expect(Array.isArray(saved.pickOrder)).toBe(true);
    storage.write(GUEST_RUN_STORAGE_KEY, { ...saved, pickOrder: [] });

    const h = setup(storage);
    await h.engine.enter();

    expect(h.gameStatus.get()).toBe("idle");
    expect(storage.has(GUEST_RUN_STORAGE_KEY)).toBe(false);
  });

  it("restores a stale practice save as still playable — untimed runs never expire", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T02:00:00Z"));
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame(0);
    first.pickTopLayer();
    first.engine.dispose();

    // Far beyond the retired 5:00 easy clock (and even days later).
    vi.setSystemTime(new Date("2026-07-13T09:00:00Z"));
    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.gameStatus.get()).toBe("dealt");
    expect(restored.isGameOver.get()).toBe(false);
    expect(restored.failureReason.get()).toBe("none");
    expect(restored.deadline.get()).toBe(0);
    expect(restored.lastStatus.get()).toBe("guestProgressRestored");
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

describe("sheep-solitaire guest engine — daily two-level challenge", () => {
  it("advances a solved daily L1 into the same-day L2 devil board under the hard rule", () => {
    layoutMock.daily = syntheticDaily(1);
    const h = setup();
    h.engine.startGame({ mode: "daily", level: 1 });
    expect(h.gameDifficulty.get()).toBe(0); // L1 teaching board runs the easy rule
    // The synthetic L1 board is grouped in adjacent triples: pick in id order.
    for (let id = 0; id < 18; id += 1) h.engine.pickCard(id);
    expect(h.gameStatus.get()).toBe("solved");

    layoutMock.daily = syntheticDaily(2);
    h.engine.advanceLevel();

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.mode.get()).toBe("daily");
    expect(h.level.get()).toBe(2);
    expect(h.gameDifficulty.get()).toBe(2);
    expect(h.pileCards.get()).toHaveLength(90);
    expect(h.deadline.get()).toBe(0); // still untimed
  });

  it("forces the hard rule on a daily L2 deal and round-trips its persistence", async () => {
    // The scene's "Retry Level 2" dispatches {mode:'daily', level:2} with NO
    // difficulty — the engine must pin ruleOf(2) or the 90-card 15-type board
    // is dealt (and persisted) under the easy rule and rejected on refresh.
    layoutMock.daily = syntheticDaily(2);
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame({ mode: "daily", level: 2 });

    expect(first.gameStatus.get()).toBe("dealt");
    expect(first.mode.get()).toBe("daily");
    expect(first.level.get()).toBe(2);
    expect(first.gameDifficulty.get()).toBe(2);
    expect(first.pileCards.get()).toHaveLength(90);
    first.pickAnyExposed();
    const savedPile = first.pileCards.get();
    const savedSlots = first.slotCards.get();
    first.engine.dispose();

    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.gameStatus.get()).toBe("dealt");
    expect(restored.mode.get()).toBe("daily");
    expect(restored.level.get()).toBe(2);
    expect(restored.gameDifficulty.get()).toBe(2);
    expect(restored.pileCards.get()).toEqual(savedPile);
    expect(restored.slotCards.get()).toEqual(savedSlots);
  });

  it("allows the daily 'Retry Level 2' redeal from a lost (game-over) board", () => {
    layoutMock.daily = syntheticDaily(2);
    const h = setup();
    h.engine.startGame({ mode: "daily", level: 2 });
    for (const id of L2_DISTINCT_PICKS) h.engine.pickCard(id);
    expect(h.isGameOver.get()).toBe(true);
    h.engine.revive(); // burn the day's revive so retry is the only path left
    for (const id of L2_DISTINCT_PICKS) h.engine.pickCard(id);
    expect(h.isGameOver.get()).toBe(true);
    expect(h.revivesLeft.get()).toBe(0);

    h.engine.startGame({ mode: "daily", level: 2 }); // retry over the lost board

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.isGameOver.get()).toBe(false);
    expect(h.failureReason.get()).toBe("none");
    expect(h.gameDifficulty.get()).toBe(2);
    expect(h.pileCards.get()).toHaveLength(90);
    expect(h.slotCards.get()).toHaveLength(0);
  });

  it("grants ONE revive per DAY — consuming it persists across same-day retries and refreshes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    layoutMock.daily = syntheticDaily(2);
    const storage = memoryStorage();
    const h = setup(storage);
    h.engine.startGame({ mode: "daily", level: 2 });
    expect(h.revivesLeft.get()).toBe(1);

    for (const id of L2_DISTINCT_PICKS) h.engine.pickCard(id);
    expect(h.isGameOver.get()).toBe(true);
    h.engine.revive();
    expect(h.isGameOver.get()).toBe(false);
    expect(h.revivesLeft.get()).toBe(0);
    expect(h.slotCards.get()).toHaveLength(0); // tray returned to the board

    // Lose again → a same-day retry must NOT refresh the revive.
    for (const id of L2_DISTINCT_PICKS) h.engine.pickCard(id);
    expect(h.isGameOver.get()).toBe(true);
    h.engine.revive(); // out of revives — no-op
    expect(h.isGameOver.get()).toBe(true);
    h.engine.startGame({ mode: "daily", level: 2 });
    expect(h.revivesLeft.get()).toBe(0);

    // …and it survives a refresh (restore) within the same day.
    h.pickAnyExposed();
    h.engine.dispose();
    const resumed = setup(storage);
    await resumed.engine.enter();
    expect(resumed.gameStatus.get()).toBe("dealt");
    expect(resumed.revivesLeft.get()).toBe(0);
  });

  it("resets the daily revive to 1 on a NEW day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    layoutMock.daily = syntheticDaily(2);
    const storage = memoryStorage();
    const day1 = setup(storage);
    day1.engine.startGame({ mode: "daily", level: 2 });
    for (const id of L2_DISTINCT_PICKS) day1.engine.pickCard(id);
    day1.engine.revive();
    expect(day1.revivesLeft.get()).toBe(0);
    day1.engine.expireGame(); // player reset
    day1.engine.dispose();

    // 48h later → a new local date in every timezone.
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
    const day2 = setup(storage);
    day2.engine.startGame({ mode: "daily", level: 2 });
    expect(day2.revivesLeft.get()).toBe(1);
  });

  it("invalidates yesterday's daily progression on restore (no cross-day L2 leak)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    layoutMock.daily = syntheticDaily(1);
    const solveL1 = (storage: GuestStorage) => {
      const h = setup(storage);
      h.engine.startGame({ mode: "daily", level: 1 });
      for (let id = 0; id < 18; id += 1) h.engine.pickCard(id);
      expect(h.gameStatus.get()).toBe("solved");
      h.engine.dispose();
    };

    // Same day: the solved L1 restores and can advance into TODAY's L2.
    const sameDayStorage = memoryStorage();
    solveL1(sameDayStorage);
    const sameDay = setup(sameDayStorage);
    await sameDay.engine.enter();
    expect(sameDay.gameStatus.get()).toBe("solved");
    expect(sameDay.mode.get()).toBe("daily");
    expect(sameDay.level.get()).toBe(1);
    layoutMock.daily = syntheticDaily(2);
    sameDay.engine.advanceLevel();
    expect(sameDay.gameStatus.get()).toBe("dealt");
    expect(sameDay.level.get()).toBe(2);

    // A NEW day: an identical solved-L1 save must NOT advance into yesterday's
    // L2 — the daily progression is invalidated back to a fresh lobby (fresh L1).
    layoutMock.daily = syntheticDaily(1);
    const crossDayStorage = memoryStorage();
    solveL1(crossDayStorage);
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
    const day2 = setup(crossDayStorage);
    await day2.engine.enter();
    expect(day2.gameStatus.get()).toBe("idle");
    expect(day2.pileCards.get()).toEqual([]);
    expect(crossDayStorage.has(GUEST_RUN_STORAGE_KEY)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layout Model v2 (redesign §9): unified fine-grid occlusion, side stacks and
// the two daily presets. These are ENGINE-contract tests — the same helpers
// the Phaser scene must reuse for pixel placement.
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic raw-variant seed mix (mirrors the engine's internal hash3). */
function mixSeed(a: number, b: number, c: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (c * 0x27d4eb2f), 0x165667b1) >>> 0;
  h ^= h >>> 15;
  return h | 0;
}

const gridCard = (id: number, layer: number, col: number, row: number): CardData => ({
  id,
  symbol: id,
  layer,
  col,
  row,
  zone: "grid",
  stackIndex: 0,
});

describe("sheep-solitaire v2 occlusion formula (§9.2 fine grid)", () => {
  it("cardUnitPos staggers odd layers by exactly half a cell (1 unit)", () => {
    expect(cardUnitPos({ layer: 0, col: 0, row: 0 })).toEqual({ unitX: 0, unitY: 0 });
    expect(cardUnitPos({ layer: 0, col: 3, row: 2 })).toEqual({ unitX: 6, unitY: 4 });
    expect(cardUnitPos({ layer: 1, col: 3, row: 2 })).toEqual({ unitX: 7, unitY: 5 });
    expect(cardUnitPos({ layer: 2, col: 3, row: 2 })).toEqual({ unitX: 6, unitY: 4 });
    expect(cardUnitPos({ layer: 3, col: 0, row: 0 })).toEqual({ unitX: 1, unitY: 1 });
    expect(cardUnitPos({ layer: 4, col: 1, row: 1 })).toEqual({ unitX: 2, unitY: 2 });
  });

  it("covers at unit distance 1 and stops covering at exactly 2 (per axis)", () => {
    const anchor = { layer: 0, col: 1, row: 1 }; // unit (2,2)
    // Same-parity layer 2 below: unit = (2c, 2r).
    expect(gridCovers(anchor, { layer: 2, col: 1, row: 1 })).toBe(true); // Δ(0,0)
    expect(gridCovers(anchor, { layer: 2, col: 2, row: 1 })).toBe(false); // Δ(2,0) — edge-to-edge, no overlap
    expect(gridCovers(anchor, { layer: 2, col: 1, row: 2 })).toBe(false); // Δ(0,2)
    // Staggered layer 1 below: unit = (2c+1, 2r+1) → odd deltas.
    expect(gridCovers(anchor, { layer: 1, col: 0, row: 0 })).toBe(true); // Δ(1,1)
    expect(gridCovers(anchor, { layer: 1, col: 1, row: 1 })).toBe(true); // Δ(1,1)
    expect(gridCovers(anchor, { layer: 1, col: 2, row: 1 })).toBe(false); // Δ(3,1)
    expect(gridCovers(anchor, { layer: 1, col: 1, row: 2 })).toBe(false); // Δ(1,3)
  });

  it("covers only downward (A.layer < B.layer), across ANY layer gap", () => {
    const top = { layer: 0, col: 1, row: 1 };
    const deep = { layer: 4, col: 1, row: 1 }; // same parity → unit-identical
    expect(gridCovers(top, deep)).toBe(true);
    expect(gridCovers(deep, top)).toBe(false);
    expect(gridCovers(top, { layer: 0, col: 1, row: 1 })).toBe(false); // same layer
    // Odd gap keeps the half-cell offset: layer 3 under layer 0.
    expect(gridCovers(top, { layer: 3, col: 0, row: 0 })).toBe(true); // unit (1,1), Δ(1,1)
    expect(gridCovers(top, { layer: 3, col: 2, row: 2 })).toBe(false); // unit (5,5), Δ(3,3)
  });

  it("computeExposed applies the same formula the placement helper exports", () => {
    const cards: CardData[] = [
      gridCard(0, 0, 1, 1),
      gridCard(1, 2, 1, 1), // buried by id 0 across the layer gap
      gridCard(2, 2, 2, 1), // unit Δ(2,0) from id 0 → exposed
      gridCard(3, 1, 0, 0), // unit Δ(1,1) from id 0 → buried
      gridCard(4, 3, 3, 3), // far → exposed
    ];
    const exposed = computeExposed(cards);
    expect(exposed[0]).toBe(true);
    expect(exposed[1]).toBe(false);
    expect(exposed[2]).toBe(true);
    expect(exposed[3]).toBe(false);
    expect(exposed[4]).toBe(true);
  });
});

describe("sheep-solitaire v2 side stacks (§9.2 stack exposure)", () => {
  it("lets only the outermost stack card be picked, revealing the next on clear", () => {
    layoutMock.daily = syntheticDaily(2);
    const h = setup();
    h.engine.startGame({ mode: "daily", level: 2 });

    const viewOf = (id: number) => h.pileCards.get().find((c) => c.id === id);
    // stackL: ids 72 (bottom) … 80 (top); stackR: 81 … 89.
    expect(viewOf(80)).toMatchObject({ zone: "stackL", stackIndex: 8, exposed: true });
    expect(viewOf(79)).toMatchObject({ zone: "stackL", stackIndex: 7, exposed: false });
    expect(viewOf(72)).toMatchObject({ zone: "stackL", stackIndex: 0, exposed: false });
    expect(viewOf(89)).toMatchObject({ zone: "stackR", stackIndex: 8, exposed: true });

    // A buried stack card is not pickable.
    h.engine.pickCard(79);
    expect(h.slotCards.get()).toHaveLength(0);

    // The top is; clearing it exposes the next card down, same zone only.
    h.engine.pickCard(80);
    expect(h.slotCards.get()[0]).toMatchObject({ id: 80, zone: "stackL", stackIndex: 8 });
    expect(viewOf(79)?.exposed).toBe(true);
    expect(viewOf(78)?.exposed).toBe(false);
    expect(viewOf(89)?.exposed).toBe(true);
  });

  it("undo returns a stack card to the top of its stack (zone + depth intact)", () => {
    layoutMock.daily = syntheticDaily(2);
    const h = setup();
    h.engine.startGame({ mode: "daily", level: 2 });

    h.engine.pickCard(89); // stackR top
    expect(h.pileCards.get().find((c) => c.id === 88)?.exposed).toBe(true);

    h.engine.useUndo();

    expect(h.slotCards.get()).toHaveLength(0);
    const restored = h.pileCards.get().find((c) => c.id === 89);
    expect(restored).toMatchObject({ zone: "stackR", stackIndex: 8, exposed: true });
    expect(h.pileCards.get().find((c) => c.id === 88)?.exposed).toBe(false);
    expect(h.undosUsed.get()).toBe(1);
  });

  it("round-trips a save with a stack card parked in the tray", async () => {
    layoutMock.daily = syntheticDaily(2);
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame({ mode: "daily", level: 2 });
    first.engine.pickCard(80); // stackL top into the tray
    const savedSlots = first.slotCards.get();
    const savedPile = first.pileCards.get();
    expect(savedSlots[0]).toMatchObject({ id: 80, zone: "stackL", stackIndex: 8 });
    first.engine.dispose();

    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.gameStatus.get()).toBe("dealt");
    expect(restored.slotCards.get()).toEqual(savedSlots);
    expect(restored.pileCards.get()).toEqual(savedPile);
    expect(restored.pileCards.get().find((c) => c.id === 79)?.exposed).toBe(true);

    // The restored undo stack still returns the tray card to its stack top.
    restored.engine.useUndo();
    expect(restored.slotCards.get()).toHaveLength(0);
    expect(restored.pileCards.get().find((c) => c.id === 80)).toMatchObject({
      zone: "stackL",
      stackIndex: 8,
      exposed: true,
    });
    expect(restored.pileCards.get().find((c) => c.id === 79)?.exposed).toBe(false);
  });

  it("shuffle permutes stack-card symbols in the global pool without moving any card", () => {
    layoutMock.daily = syntheticDaily(2);
    const h = setup();
    h.engine.startGame({ mode: "daily", level: 2 });
    const before = h.pileCards.get();

    // Deterministic Web-Crypto: cryptoIndex always returns 0, so the engine's
    // Fisher-Yates result is exactly reproducible below.
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: Uint32Array) => {
        buffer[0] = 0;
        return buffer;
      },
    });
    h.engine.useShuffle();

    const after = h.pileCards.get();
    const skeleton = (c: (typeof before)[number]) =>
      `${c.id}:${c.layer}:${c.col}:${c.row}:${c.zone}:${c.stackIndex}`;
    // No card moved — grid cells, zones, and stack depths are all untouched.
    expect(after.map(skeleton)).toEqual(before.map(skeleton));
    // Same symbol multiset (still a legal board)…
    expect(after.map((c) => c.symbol).sort((a, b) => a - b)).toEqual(
      before.map((c) => c.symbol).sort((a, b) => a - b),
    );
    // …arranged exactly as the engine's unbiased Fisher-Yates with j=0 says.
    const expected = before.map((c) => c.symbol);
    for (let i = expected.length - 1; i > 0; i -= 1) {
      const tmp = expected[i]!;
      expected[i] = expected[0]!;
      expected[0] = tmp;
    }
    expect(after.map((c) => c.symbol)).toEqual(expected);
    // The stack cards took part in the permutation — they are pile, not tray.
    const stacksChanged = after.some(
      (c, i) => c.zone !== "grid" && c.symbol !== before[i]!.symbol,
    );
    expect(stacksChanged).toBe(true);
    expect(h.shuffleLeft.get()).toBe(0);
  });
});

describe("sheep-solitaire v2 daily presets (§9.3)", () => {
  it("daily L1 is an 18-card 2-layer grid-only teaching board, zero-prop clearable across 200 date seeds", () => {
    for (let day = 0; day < 200; day += 1) {
      const dateSeed = 20260101 + day;
      const layout = generateDailyLevel(dateSeed, 1);

      expect(layout.totalCards).toBe(18);
      expect(layout.cardTypes).toBe(6);
      const counts = new Map<number, number>();
      for (const card of layout.cards) {
        counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
        expect(card.zone).toBe("grid");
        expect(card.stackIndex).toBe(0);
        expect(card.layer).toBeLessThanOrEqual(1);
      }
      expect(counts.size).toBe(6);
      for (const n of counts.values()) expect(n).toBe(3);

      const sim = simulateSolvability(layout.cards);
      expect(sim.passNoItems, `date seed ${dateSeed}`).toBe(true);
    }
  });

  it("daily L2 is a 90-card 5-layer + twin-stack devil board — ×3 symbols, non-dead, never a free win — across 50 date seeds", () => {
    for (let day = 0; day < 50; day += 1) {
      const dateSeed = 20260601 + day;
      const layout = generateDailyLevel(dateSeed, 2);

      expect(layout.totalCards).toBe(90);
      expect(layout.cardTypes).toBe(15);
      const counts = new Map<number, number>();
      const stackDepths = { stackL: new Set<number>(), stackR: new Set<number>() };
      let gridCount = 0;
      for (const card of layout.cards) {
        counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
        if (card.zone === "grid") {
          gridCount += 1;
          expect(card.layer).toBeLessThanOrEqual(4);
          expect(card.col).toBeLessThanOrEqual(5);
          expect(card.row).toBeLessThanOrEqual(4);
          expect(card.stackIndex).toBe(0);
        } else {
          expect(card.layer).toBe(0);
          expect(card.col).toBe(0);
          expect(card.row).toBe(0);
          stackDepths[card.zone].add(card.stackIndex);
        }
      }
      // Populated stacks: 9 cards each, depths exactly 0..8, grid holds 72.
      expect(gridCount).toBe(72);
      expect(stackDepths.stackL.size).toBe(9);
      expect(stackDepths.stackR.size).toBe(9);
      expect(Math.max(...stackDepths.stackL)).toBe(8);
      expect(Math.max(...stackDepths.stackR)).toBe(8);
      // Every symbol count ≡ 0 mod 3 (×6 here), total ≡ 0 mod 3.
      expect(counts.size).toBe(15);
      for (const n of counts.values()) expect(n).toBe(6);

      const sim = simulateSolvability(layout.cards);
      expect(sim.cleared, `date seed ${dateSeed} must not be dead`).toBe(true);
      expect(sim.passNoItems, `date seed ${dateSeed} must not be a free win`).toBe(false);
      expect(sim.minItems).toBeLessThanOrEqual(3);
    }
  }, 15_000);

  it("same date seed → identical daily boards (social-currency determinism)", () => {
    expect(generateDailyLevel(20260714, 1)).toEqual(generateDailyLevel(20260714, 1));
    expect(generateDailyLevel(20260714, 2)).toEqual(generateDailyLevel(20260714, 2));
    expect(generateDailyLevel(20260714, 2)).not.toEqual(generateDailyLevel(20260715, 2));
  });

  it("zero-prop greedy play fails on the large majority of RAW L2 boards (seeded, deterministic)", () => {
    // Raw variants (pre-sampling) at the shipped preset spread: the shipped
    // boards are then SELECTED to all be greedy-fail + non-dead, so this
    // asserts the raw board class itself carries the devil difficulty. All
    // seeds and rollouts are deterministic — this cannot flake.
    const preset = DAILY_LEVEL_PRESETS[2];
    const total = 60;
    let greedyFails = 0;
    for (let i = 0; i < total; i += 1) {
      const layout = generateTightLayout(mixSeed(99, 2, i), preset.types, {
        spread: preset.spread,
        structure: preset.structure,
        copiesPerSymbol: preset.copiesPerSymbol,
      });
      if (!simulateSolvability(layout.cards).passNoItems) greedyFails += 1;
    }
    // Measured 44/60 (≈73%) on this fixed seed set; assert a safety margin.
    expect(greedyFails / total).toBeGreaterThanOrEqual(0.6);
  });
});
