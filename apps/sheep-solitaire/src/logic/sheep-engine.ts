/**
 * Deterministic card layout engine for Sheep Solitaire (羊了个羊).
 *
 * The layout has 3 layers of cards stacked in a staggered grid. Cards on
 * higher layers block access to cards directly underneath. The local practice
 * engine is deterministic from a seed — the same seed always produces the same
 * layout. This always-solvable generator is the frontend reference the
 * Morpheus worker must match before paid play is published; the released guest
 * game does not call the TEE.
 *
 * Each symbol type appears in multiples of 3 to allow match-3 elimination.
 */

/** The 15 semantic tile symbols used in the game (sheep-themed "meadow farm" set). */
export const ALL_SYMBOLS = [
  "sheep-face", "lamb", "wool-ball", "bell-collar", "hoof-print",
  "carrot", "clover", "flower", "milk-bottle", "fence",
  "sun", "cloud", "star", "heart", "butterfly",
] as const;

export type TileSymbol = (typeof ALL_SYMBOLS)[number];

const SYMBOL_LABELS: Record<TileSymbol, string> = {
  "sheep-face": "sheep face",
  lamb: "lamb",
  "wool-ball": "wool ball",
  "bell-collar": "bell collar",
  "hoof-print": "hoof print",
  carrot: "carrot",
  clover: "clover",
  flower: "wild flower",
  "milk-bottle": "milk bottle",
  fence: "fence",
  sun: "sun",
  cloud: "cloud",
  star: "star charm",
  heart: "heart",
  butterfly: "butterfly",
};

export interface CardData {
  /** Unique id within the layout. */
  id: number;
  /** Symbol index. */
  symbol: number;
  /** Layer: 0 (top), 1 (middle), 2 (bottom). */
  layer: number;
  /** Grid column. */
  col: number;
  /** Grid row. */
  row: number;
}

export interface LayoutResult {
  cards: CardData[];
  /** Total number of cards in the layout. */
  totalCards: number;
  /** Number of distinct symbol types used. */
  cardTypes: number;
}

type Layer = 0 | 1 | 2;

interface LayerConfig {
  layer: Layer;
  cols: number;
  rows: number;
  /** Maximum complete match-3 symbol groups that fit on this layer. */
  symbolCapacity: number;
}

/**
 * Layer capacities deliberately count COMPLETE triples. Keeping every copy of a
 * symbol on one layer gives the generator a constructive solution proof:
 *
 *   1. every top-layer symbol is an immediately exposed triple;
 *   2. clearing all top triples exposes every middle-layer triple;
 *   3. clearing all middle triples exposes every bottom-layer triple.
 *
 * A player following that order never holds more than MATCH_COUNT (3) cards in
 * the seven-slot tray. This replaces the old one-copy-per-layer layout, whose
 * easy board opened with eight different exposed symbols and therefore forced a
 * loss before any triple could be completed.
 */
const LAYER_CONFIGS: readonly LayerConfig[] = [
  { layer: 0, cols: 4, rows: 3, symbolCapacity: 4 },
  { layer: 1, cols: 5, rows: 4, symbolCapacity: 6 },
  { layer: 2, cols: 6, rows: 5, symbolCapacity: 10 },
];

/**
 * Simple seeded PRNG (mulberry32).
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using the provided random function.
 */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const current = a[i]!;
    a[i] = a[j]!;
    a[j] = current;
  }
  return a;
}

/**
 * Generate a deterministic card layout.
 *
 * @param seed - Integer seed (derived from block beacon + game id).
 * @param cardTypes - Number of symbol types to use (8, 12, or 15).
 * @returns LayoutResult with all card data.
 */
export function generateCardLayout(seed: number, cardTypes: number): LayoutResult {
  const rand = mulberry32(seed);

  const requestedTypes = Number.isFinite(cardTypes) ? Math.floor(cardTypes) : 0;
  const types = Math.max(0, Math.min(requestedTypes, ALL_SYMBOLS.length));
  if (types === 0) return { cards: [], totalCards: 0, cardTypes: 0 };

  // Start from the intended clear order, then shuffle identities/positions with
  // the deterministic seed. Easy/medium/hard use all three layers while each
  // symbol's three copies remain together on exactly one layer.
  const symbols = shuffle(Array.from({ length: types }, (_, symbol) => symbol), rand);
  const topCount = Math.min(LAYER_CONFIGS[0]!.symbolCapacity, types);
  const remaining = types - topCount;
  const middleCount = Math.min(
    LAYER_CONFIGS[1]!.symbolCapacity,
    Math.ceil(remaining / 2),
  );
  const layerSymbols: number[][] = [
    symbols.slice(0, topCount),
    symbols.slice(topCount, topCount + middleCount),
    symbols.slice(topCount + middleCount),
  ];

  const cards: CardData[] = [];
  let id = 0;

  for (const config of LAYER_CONFIGS) {
    const assignedSymbols = layerSymbols[config.layer] ?? [];
    if (assignedSymbols.length > config.symbolCapacity) {
      throw new Error(`layer ${config.layer} exceeds match-group capacity`);
    }

    const assignments = shuffle(
      assignedSymbols.flatMap((symbol) => [symbol, symbol, symbol]),
      rand,
    );
    if (assignments.length > config.cols * config.rows) {
      throw new Error(`layer ${config.layer} exceeds grid capacity`);
    }

    assignments.forEach((symbol, index) => {
      cards.push({
        id: id++,
        symbol,
        layer: config.layer,
        col: index % config.cols,
        row: Math.floor(index / config.cols),
      });
    });
  }

  return {
    cards,
    totalCards: cards.length,
    cardTypes: types,
  };
}

/**
 * Determine which cards are exposed (not blocked by a card on a higher layer).
 *
 * A card on layer L at position (col, row) is blocked if there exists a card
 * on layer L-1 (higher) at a nearby position that overlaps it. We use a simple
 * overlap check: a higher-layer card at (c, r) blocks a lower-layer card at
 * (c', r') if the Manhattan distance is small enough given the staggered grid.
 *
 * For simplicity: a card on layer N blocks cards on layer N+1 within a 2x2
 * region centered on its position.
 */
export function computeExposed(cards: CardData[]): boolean[] {
  // During play card ids become sparse as picked cards leave the pile. Size the
  // lookup by max id, not remaining-card count, so `exposed[card.id]` is always
  // an explicit boolean for every card still in play.
  const maxId = cards.reduce((max, card) => Math.max(max, card.id), -1);
  const exposed = new Array(maxId + 1).fill(true);
  const byLayer: CardData[][] = [[], [], []];
  for (const c of cards) {
    byLayer[c.layer]?.push(c);
  }

  // For each card on a lower layer, check if any higher-layer card blocks it
  for (const card of cards) {
    if (card.layer === 0) continue; // top layer is always exposed
    for (const higher of byLayer[card.layer - 1] ?? []) {
      // Check if higher card overlaps this card
      const dx = Math.abs(higher.col - card.col);
      const dy = Math.abs(higher.row - card.row);
      // A higher card at offsetX/offsetY blocks roughly a 2x2 area
      if (dx <= 1 && dy <= 1) {
        exposed[card.id] = false;
        break;
      }
    }
  }

  return exposed;
}

/**
 * Get the human-readable label for a symbol index.
 */
export function symbolLabel(symbolIndex: number): string {
  const symbol = ALL_SYMBOLS[symbolIndex];
  return symbol ? SYMBOL_LABELS[symbol] : "unknown tile";
}

/**
 * Get the sprite asset URL for a symbol index.
 */
export function symbolAsset(symbolIndex: number): string {
  const symbol = ALL_SYMBOLS[symbolIndex];
  return symbol ? `./art/tile-${String(symbolIndex).padStart(2, "0")}-${symbol}.webp` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// P1 — Tight ("devil") layout generator + solvability simulator
//
// The original `generateCardLayout` packs every copy of a symbol onto ONE layer,
// which makes a constructive always-solvable board (clear top triples → middle
// → bottom, never exceeding the 7-slot tray). That is exactly the "guaranteed
// win, therefore boring" flaw the real 羊了个羊 avoids: its level 2 is near-
// impossible without props + luck.
//
// `generateTightLayout` reuses the proven-solvable baseline, then performs
// cross-layer symbol swaps scaled by `spread`. Low spread ≈ the original easy
// board; high spread scatters copies across 2–3 layers, creating the slot
// pressure that makes level 2 a scream. `simulateSolvability` scores each board
// so `generateDailyLevel` can SAMPLE a layout matching the difficulty target
// (level 1: zero-prop solvable; level 2: needs props but not a dead end).
// ─────────────────────────────────────────────────────────────────────────────

const MATCH_GROUP = 3;
const TIGHT_MAX_SLOTS = 7;
const SIM_PROP_CAP = 3;

/** Mix three integers into a deterministic 32-bit seed. */
function hash3(a: number, b: number, c: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (c * 0x27d4eb2f), 0x165667b1) >>> 0;
  h ^= h >>> 15;
  return h | 0;
}

export interface TightLayoutOptions {
  /**
   * 0..1 — how aggressively symbol copies are scattered across layers.
   * [PLACEHOLDER] baseline: L1 ≈ 0.12 (teaching, safe), L2 ≈ 0.82 (devil).
   */
  spread: number;
  /** Max cross-layer swaps performed (scaled by card count). [PLACEHOLDER] */
  swapCap?: number;
}

/**
 * Generate a "tight" card layout: start from the always-solvable baseline, then
 * scatter symbol copies across layers by swapping card symbols between
 * different layers. Layer capacities are never exceeded because we only swap
 * symbol VALUES, never move cards (so the per-layer grid stays valid and the
 * scene's hardcoded render grid keeps matching).
 */
export function generateTightLayout(
  seed: number,
  cardTypes: number,
  opts: TightLayoutOptions,
): LayoutResult {
  const base = generateCardLayout(seed, cardTypes);
  if (base.cards.length === 0) return base;

  const cards: CardData[] = base.cards.map((card) => ({ ...card }));
  const spread = Math.max(0, Math.min(1, Number.isFinite(opts.spread) ? opts.spread : 0));
  if (spread <= 0) return { cards, totalCards: cards.length, cardTypes: base.cardTypes };

  const rand = mulberry32((seed ^ 0x5bf03635) | 0);
  const swapCap = opts.swapCap ?? Math.round(cards.length * 1.6); // [PLACEHOLDER]
  const swaps = Math.max(0, Math.floor(swapCap * spread));
  for (let s = 0; s < swaps; s++) {
    const a = Math.floor(rand() * cards.length);
    const b = Math.floor(rand() * cards.length);
    if (a === b) continue;
    const ca = cards[a]!;
    const cb = cards[b]!;
    if (ca.layer === cb.layer) continue; // cross-layer only
    if (ca.symbol === cb.symbol) continue; // no trivial swap
    const tmp = ca.symbol;
    ca.symbol = cb.symbol;
    cb.symbol = tmp;
  }

  return { cards, totalCards: cards.length, cardTypes: base.cardTypes };
}

export interface SolvabilityReport {
  /** True if a greedy player can clear the board with ZERO props. */
  passNoItems: boolean;
  /** Minimum props (undo/shuffle/remove3/revive proxies) the simulator needed. */
  minItems: number;
  /** Peak tray occupancy observed during the best run. */
  maxSlot: number;
}

type PickMode = "complete" | "tray" | "exposed";

/** Choose a tray card to discard when the tray would overflow (prop proxy). */
function choosePropRemoval(slots: CardData[], pile: CardData[]): number {
  const remaining = new Map<number, number>();
  for (const card of pile) {
    remaining.set(card.symbol, (remaining.get(card.symbol) ?? 0) + 1);
  }
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < slots.length; i++) {
    const sym = slots[i]!.symbol;
    const inSlots = slots.filter((card) => card.symbol === sym).length;
    if (inSlots >= 2) continue; // keep near-complete triples intact
    const score = remaining.get(sym) ?? 0; // discard the most plentiful symbol
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Greedy simulator for one pick heuristic. Returns the outcome of clearing the
 * board (or dying) using that heuristic, spending props only when the tray
 * would overflow.
 */
function runGreedy(initial: CardData[], mode: PickMode): SolvabilityReport {
  let pile: CardData[] = initial.map((card) => ({ ...card }));
  let slots: CardData[] = [];
  let props = 0;
  let maxSlot = 0;
  let dead = false;

  while (pile.length > 0 || slots.length > 0) {
    const exposedArr = computeExposed(pile);
    const exposedCards = pile.filter((card) => exposedArr[card.id] !== false);
    if (exposedCards.length === 0) {
      dead = true;
      break;
    }

    const symbolInSlots = new Map<number, number>();
    for (const card of slots) {
      symbolInSlots.set(card.symbol, (symbolInSlots.get(card.symbol) ?? 0) + 1);
    }

    let pick: CardData | undefined;
    if (mode === "complete") {
      pick =
        exposedCards.find((card) => (symbolInSlots.get(card.symbol) ?? 0) === MATCH_GROUP - 1) ??
        exposedCards.find((card) => (symbolInSlots.get(card.symbol) ?? 0) === 1) ??
        exposedCards[0];
    } else if (mode === "tray") {
      pick =
        exposedCards.find((card) => (symbolInSlots.get(card.symbol) ?? 0) >= 1) ??
        exposedCards[0];
    } else {
      const remaining = new Map<number, number>();
      for (const card of pile) {
        remaining.set(card.symbol, (remaining.get(card.symbol) ?? 0) + 1);
      }
      pick = exposedCards
        .slice()
        .sort((a, b) => (remaining.get(b.symbol) ?? 0) - (remaining.get(a.symbol) ?? 0))[0];
    }
    if (!pick) {
      dead = true;
      break;
    }

    pile = pile.filter((card) => card.id !== pick!.id);
    slots.push(pick);
    maxSlot = Math.max(maxSlot, slots.length);

    const count = slots.filter((card) => card.symbol === pick!.symbol).length;
    if (count >= MATCH_GROUP) {
      let removed = 0;
      slots = slots.filter((card) => {
        if (card.symbol === pick!.symbol && removed < MATCH_GROUP) {
          removed += 1;
          return false;
        }
        return true;
      });
    }

    if (slots.length >= TIGHT_MAX_SLOTS) {
      if (props < SIM_PROP_CAP) {
        const idx = choosePropRemoval(slots, pile);
        if (idx >= 0) {
          slots.splice(idx, 1);
          props += 1;
          maxSlot = Math.max(maxSlot, slots.length);
        } else {
          dead = true;
          break;
        }
      } else {
        dead = true;
        break;
      }
    }
  }

  const passNoItems = !dead && props === 0 && pile.length === 0 && slots.length === 0;
  return { passNoItems, minItems: props, maxSlot };
}

/**
 * Score a layout across several pick heuristics and return the BEST outcome
 * (zero-prop solvable first, then fewest props, then lowest peak tray). Used as
 * the target function for daily-level sampling.
 */
export function simulateSolvability(cards: CardData[]): SolvabilityReport {
  const results = (["complete", "tray", "exposed"] as PickMode[]).map((mode) =>
    runGreedy(cards, mode),
  );
  results.sort((a, b) => {
    if (a.passNoItems !== b.passNoItems) return a.passNoItems ? -1 : 1;
    if (a.minItems !== b.minItems) return a.minItems - b.minItems;
    return a.maxSlot - b.maxSlot;
  });
  return results[0]!;
}

/**
 * Deterministic seed for "today's" board, derived from the local date
 * (YYYYMMDD). Same day → same seed → same level-2 board for everyone (the
 * social currency of 羊了个羊's daily challenge).
 */
export function dailyDateSeed(date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (y * 10000 + m * 100 + d) | 0;
}

/**
 * Sample a daily level layout. Level 1 targets a zero-prop-solvable board
 * (teaching, always clearable); level 2 targets a board that needs 1–3 props
 * but is not a pure dead end (the "devil" difficulty). Falls back to the last
 * candidate if no variant hits the target within `maxVariants`.
 */
export function generateDailyLevel(
  dateSeed: number,
  level: 1 | 2,
  cardTypes: number,
): LayoutResult {
  const spread = level === 1 ? 0.12 : 0.82; // [PLACEHOLDER]
  const wantNoItem = level === 1;
  const maxVariants = 200; // [PLACEHOLDER]
  let fallback: LayoutResult | null = null;

  for (let variant = 0; variant < maxVariants; variant++) {
    const seed = hash3(dateSeed, level, variant);
    const layout = generateTightLayout(seed, cardTypes, { spread });
    if (layout.cards.length === 0) continue;
    if (!fallback) fallback = layout;
    const sim = simulateSolvability(layout.cards);
    if (wantNoItem) {
      if (sim.passNoItems) return layout;
    } else if (!sim.passNoItems && sim.minItems >= 1 && sim.minItems <= SIM_PROP_CAP) {
      return layout;
    }
  }

  return fallback ?? { cards: [], totalCards: 0, cardTypes: 0 };
}
