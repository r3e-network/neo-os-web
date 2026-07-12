import { describe, expect, it } from "vitest";

import {
  ALL_SYMBOLS,
  computeExposed,
  generateCardLayout,
  symbolAsset,
  symbolLabel,
} from "../../sheep-solitaire/src/logic/sheep-engine";
import type { CardData } from "../../sheep-solitaire/src/logic/sheep-engine";
import {
  DIFFICULTY_RULES,
  MATCH_COUNT,
  MAX_SLOTS,
} from "../../sheep-solitaire/src/logic/game-rules";

/**
 * Sheep Solitaire engine tests.
 *
 * The engine generates a deterministic 3-layer card layout from a seed integer
 * and the number of symbol types to use. Each symbol appears exactly 3 times
 * on one layer to provide a constructive top-to-bottom match-3 solution. A
 * simple exposure algorithm determines which cards are visible based on
 * overlapping positions.
 */

interface SolveResult {
  solved: boolean;
  pickedCards: number;
  peakTraySize: number;
  remainingCards: number;
  stalledTraySize: number;
}

/**
 * Play only complete, currently exposed triples. This is intentionally stricter
 * than a normal player: if it clears every board, it witnesses the generator's
 * documented top-to-bottom solution without relying on undo/shuffle/remove-3.
 */
function solveByExposedTriples(layout: readonly CardData[]): SolveResult {
  const pile = layout.map((card) => ({ ...card }));
  let tray: CardData[] = [];
  let pickedCards = 0;
  let peakTraySize = 0;

  while (pile.length > 0) {
    const exposed = computeExposed(pile);
    const groups = new Map<number, CardData[]>();
    for (const card of pile) {
      if (exposed[card.id] !== true) continue;
      const group = groups.get(card.symbol) ?? [];
      group.push(card);
      groups.set(card.symbol, group);
    }

    const triple = [...groups.values()].find((group) => group.length >= MATCH_COUNT);
    if (!triple) {
      return {
        solved: false,
        pickedCards,
        peakTraySize,
        remainingCards: pile.length,
        stalledTraySize: tray.length,
      };
    }

    for (const candidate of triple.slice(0, MATCH_COUNT)) {
      // Match the real engine's per-pick exposure gate rather than removing the
      // witnessed triple atomically.
      const currentExposed = computeExposed(pile);
      if (currentExposed[candidate.id] !== true) {
        return {
          solved: false,
          pickedCards,
          peakTraySize,
          remainingCards: pile.length,
          stalledTraySize: tray.length,
        };
      }

      const index = pile.findIndex((card) => card.id === candidate.id);
      if (index < 0) throw new Error(`solver lost card ${candidate.id}`);
      const [picked] = pile.splice(index, 1);
      tray.push(picked!);
      pickedCards += 1;
      peakTraySize = Math.max(peakTraySize, tray.length);

      const matching = tray.filter((card) => card.symbol === picked!.symbol);
      if (matching.length >= MATCH_COUNT) {
        let removed = 0;
        tray = tray.filter((card) => {
          if (card.symbol === picked!.symbol && removed < MATCH_COUNT) {
            removed += 1;
            return false;
          }
          return true;
        });
      }
    }
  }

  return {
    solved: tray.length === 0,
    pickedCards,
    peakTraySize,
    remainingCards: pile.length,
    stalledTraySize: tray.length,
  };
}

describe("sheep-solitaire card layout generation", () => {
  it("produces deterministic layouts for the same seed and cardTypes", () => {
    const a1 = generateCardLayout(42, 8);
    const a2 = generateCardLayout(42, 8);
    expect(a1).toEqual(a2);
  });

  it("generates different layouts for different seeds", () => {
    const a = generateCardLayout(42, 8);
    const b = generateCardLayout(99, 8);
    expect(a.cards).not.toEqual(b.cards);
  });

  it("each symbol appears exactly 3 times in the layout", () => {
    const result = generateCardLayout(42, 8);
    const counts = new Map<number, number>();
    for (const card of result.cards) {
      counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
    }
    for (let s = 0; s < result.cardTypes; s++) {
      expect(counts.get(s)).toBe(3);
    }
    // Verify no extra symbols appear
    expect(counts.size).toBe(result.cardTypes);
  });

  it("total cards equals 3 × cardTypes", () => {
    expect(generateCardLayout(42, 8).totalCards).toBe(24);
    expect(generateCardLayout(42, 12).totalCards).toBe(36);
    expect(generateCardLayout(42, 15).totalCards).toBe(45);
    expect(generateCardLayout(42, 4).totalCards).toBe(12);
    expect(generateCardLayout(42, 1).totalCards).toBe(3);
  });

  it("assigns grid positions within the correct layer dimensions", () => {
    const result = generateCardLayout(42, 12);

    // Layer 2 (bottom) uses a 6×5 grid (cols: 0-5, rows: 0-4)
    const layer2 = result.cards.filter((c) => c.layer === 2);
    for (const card of layer2) {
      expect(card.col).toBeGreaterThanOrEqual(0);
      expect(card.col).toBeLessThan(6);
      expect(card.row).toBeGreaterThanOrEqual(0);
      expect(card.row).toBeLessThan(5);
    }

    // Layer 1 (middle) uses a 5×4 grid (cols: 0-4, rows: 0-3)
    const layer1 = result.cards.filter((c) => c.layer === 1);
    for (const card of layer1) {
      expect(card.col).toBeGreaterThanOrEqual(0);
      expect(card.col).toBeLessThan(5);
      expect(card.row).toBeGreaterThanOrEqual(0);
      expect(card.row).toBeLessThan(4);
    }

    // Layer 0 (top) uses a 4×3 grid (cols: 0-3, rows: 0-2)
    const layer0 = result.cards.filter((c) => c.layer === 0);
    for (const card of layer0) {
      expect(card.col).toBeGreaterThanOrEqual(0);
      expect(card.col).toBeLessThan(4);
      expect(card.row).toBeGreaterThanOrEqual(0);
      expect(card.row).toBeLessThan(3);
    }
  });

  it("clamps excessive cardTypes to ALL_SYMBOLS.length (15)", () => {
    const result = generateCardLayout(42, 100);
    expect(result.cardTypes).toBe(15);
    expect(result.totalCards).toBe(45);
    // Verify only valid symbols (0-14) are used
    for (const card of result.cards) {
      expect(card.symbol).toBeGreaterThanOrEqual(0);
      expect(card.symbol).toBeLessThan(15);
    }
  });

  it("handles cardTypes = 0 by returning an empty layout", () => {
    const result = generateCardLayout(42, 0);
    expect(result.totalCards).toBe(0);
    expect(result.cards).toHaveLength(0);
  });

  it("normalizes negative, fractional, and non-finite cardTypes safely", () => {
    expect(generateCardLayout(42, -4)).toMatchObject({ totalCards: 0, cardTypes: 0 });
    expect(generateCardLayout(42, 2.9)).toMatchObject({ totalCards: 6, cardTypes: 2 });
    expect(generateCardLayout(42, Number.NaN)).toMatchObject({ totalCards: 0, cardTypes: 0 });
    expect(generateCardLayout(42, Number.POSITIVE_INFINITY)).toMatchObject({
      totalCards: 0,
      cardTypes: 0,
    });
  });

  it("assigns unique id to every card", () => {
    const result = generateCardLayout(42, 15);
    const ids = result.cards.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("keeps every symbol's complete match-3 group on exactly one layer", () => {
    for (const rule of DIFFICULTY_RULES) {
      for (let seed = 0; seed < 64; seed += 1) {
        const result = generateCardLayout(seed, rule.cardTypes);
        const groups = new Map<number, CardData[]>();
        for (const card of result.cards) {
          const group = groups.get(card.symbol) ?? [];
          group.push(card);
          groups.set(card.symbol, group);
        }

        expect(groups.size).toBe(rule.cardTypes);
        for (const group of groups.values()) {
          expect(group).toHaveLength(MATCH_COUNT);
          expect(new Set(group.map((card) => card.layer)).size).toBe(1);
        }

        const initiallyExposed = computeExposed(result.cards);
        const exposedCounts = new Map<number, number>();
        for (const card of result.cards) {
          if (initiallyExposed[card.id] === true) {
            exposedCounts.set(card.symbol, (exposedCounts.get(card.symbol) ?? 0) + 1);
          }
        }
        expect([...exposedCounts.values()].some((count) => count >= MATCH_COUNT)).toBe(true);
      }
    }
  });

  it("constructively solves easy, medium, and hard across many seeds below tray capacity", () => {
    for (const rule of DIFFICULTY_RULES) {
      for (let seed = 0; seed < 128; seed += 1) {
        const layout = generateCardLayout(seed, rule.cardTypes);
        const result = solveByExposedTriples(layout.cards);

        expect(result, `${rule.key} seed ${seed}`).toEqual({
          solved: true,
          pickedCards: layout.totalCards,
          peakTraySize: MATCH_COUNT,
          remainingCards: 0,
          stalledTraySize: 0,
        });
        expect(result.peakTraySize, `${rule.key} seed ${seed}`).toBeLessThan(MAX_SLOTS);
      }
    }
  });
});

describe("sheep-solitaire card exposure logic", () => {
  it("marks all cards on layer 0 (top) as exposed", () => {
    const cards: CardData[] = [
      { id: 0, symbol: 0, layer: 0, col: 0, row: 0 },
      { id: 1, symbol: 1, layer: 0, col: 3, row: 2 },
      { id: 2, symbol: 2, layer: 0, col: 1, row: 1 },
    ];
    const exposed = computeExposed(cards);
    expect(exposed[0]).toBe(true);
    expect(exposed[1]).toBe(true);
    expect(exposed[2]).toBe(true);
  });

  it("blocks layer-1 cards that are within 1 cell of a layer-0 card", () => {
    const cards: CardData[] = [
      { id: 0, symbol: 0, layer: 0, col: 1, row: 1 },
      // Layer-1 cards at various distances from card 0
      { id: 1, symbol: 1, layer: 1, col: 1, row: 1 }, // dx=0, dy=0 → blocked
      { id: 2, symbol: 2, layer: 1, col: 5, row: 3 }, // dx=4, dy=2 → far, exposed
      { id: 3, symbol: 3, layer: 1, col: 0, row: 1 }, // dx=1, dy=0 → blocked
      { id: 4, symbol: 4, layer: 1, col: 3, row: 3 }, // dx=2, dy=2 → exposed
    ];
    const exposed = computeExposed(cards);
    expect(exposed[0]).toBe(true); // layer 0
    expect(exposed[1]).toBe(false);
    expect(exposed[2]).toBe(true);
    expect(exposed[3]).toBe(false);
    expect(exposed[4]).toBe(true);
  });

  it("blocks layer-2 cards that are within 1 cell of a layer-1 card", () => {
    const cards: CardData[] = [
      { id: 0, symbol: 0, layer: 1, col: 2, row: 2 },
      // Layer-2 cards
      { id: 1, symbol: 1, layer: 2, col: 2, row: 2 }, // same → blocked
      { id: 2, symbol: 2, layer: 2, col: 10, row: 10 }, // far → exposed
      { id: 3, symbol: 3, layer: 2, col: 1, row: 2 }, // dx=1, dy=0 → blocked
    ];
    const exposed = computeExposed(cards);
    expect(exposed[0]).toBe(true); // layer 1 is exposed (blocking only goes downward)
    expect(exposed[1]).toBe(false);
    expect(exposed[2]).toBe(true);
    expect(exposed[3]).toBe(false);
  });

  it("respects the Manhattan-distance threshold of 1 (dx ≤ 1 and dy ≤ 1)", () => {
    const cards: CardData[] = [
      { id: 0, symbol: 0, layer: 0, col: 1, row: 1 },
      { id: 1, symbol: 1, layer: 1, col: 0, row: 0 }, // dx=1, dy=1 → blocked
      { id: 2, symbol: 2, layer: 1, col: 2, row: 1 }, // dx=1, dy=0 → blocked
      { id: 3, symbol: 3, layer: 1, col: 1, row: 2 }, // dx=0, dy=1 → blocked
      { id: 4, symbol: 4, layer: 1, col: 0, row: 2 }, // dx=1, dy=1 → blocked
      { id: 5, symbol: 5, layer: 1, col: 3, row: 3 }, // dx=2, dy=2 → exposed
      { id: 6, symbol: 6, layer: 1, col: 3, row: 0 }, // dx=2, dy=1 → exposed (dx > 1)
    ];
    const exposed = computeExposed(cards);
    expect(exposed[1]).toBe(false);
    expect(exposed[2]).toBe(false);
    expect(exposed[3]).toBe(false);
    expect(exposed[4]).toBe(false);
    expect(exposed[5]).toBe(true);
    expect(exposed[6]).toBe(true);
  });

  it("does not have cross-layer-blocking beyond the immediate higher layer", () => {
    // Layer-0 cards do NOT directly block layer-2 cards — only layer-1 can block layer-2
    const cards: CardData[] = [
      { id: 0, symbol: 0, layer: 0, col: 1, row: 1 },
      { id: 1, symbol: 1, layer: 2, col: 1, row: 1 }, // same position as card 0
      // but layer 0 does not block layer 2 — only layer 1 blocks layer 2
    ];
    const exposed = computeExposed(cards);
    expect(exposed[0]).toBe(true);
    expect(exposed[1]).toBe(true); // not blocked because only layer-1 blocks layer-2
  });
});

describe("sheep-solitaire utility functions", () => {
  it("ALL_SYMBOLS uses stable semantic tile keys", () => {
    expect(ALL_SYMBOLS).toEqual([
      "wool-flower",
      "apple",
      "orange",
      "lemon",
      "grape",
      "strawberry",
      "peach",
      "cherry",
      "star",
      "bell",
      "target",
      "ribbon",
      "crystal",
      "tent",
      "carousel",
    ]);
  });

  it("symbolLabel returns accessible labels for valid tile indices", () => {
    expect(symbolLabel(0)).toBe("wool flower");
    expect(symbolLabel(1)).toBe("apple");
    expect(symbolLabel(8)).toBe("star charm");
    expect(symbolLabel(14)).toBe("carousel horse");
  });

  it("symbolLabel returns a neutral fallback for out-of-range indices", () => {
    expect(symbolLabel(-1)).toBe("unknown tile");
    expect(symbolLabel(15)).toBe("unknown tile");
    expect(symbolLabel(999)).toBe("unknown tile");
  });

  it("symbolAsset returns the generated tile sprite path for valid tile indices", () => {
    expect(symbolAsset(0)).toBe("./art/tile-00-wool-flower.webp");
    expect(symbolAsset(1)).toBe("./art/tile-01-apple.webp");
    expect(symbolAsset(8)).toBe("./art/tile-08-star.webp");
    expect(symbolAsset(14)).toBe("./art/tile-14-carousel.webp");
  });

  it("symbolAsset returns an empty path for out-of-range indices", () => {
    expect(symbolAsset(-1)).toBe("");
    expect(symbolAsset(15)).toBe("");
    expect(symbolAsset(999)).toBe("");
  });

  it("ALL_SYMBOLS contains exactly 15 entries", () => {
    expect(ALL_SYMBOLS).toHaveLength(15);
  });

  it("ALL_SYMBOLS entries are unique", () => {
    const unique = new Set(ALL_SYMBOLS);
    expect(unique.size).toBe(ALL_SYMBOLS.length);
  });
});
