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

/** The 15 semantic tile symbols used in the game. */
export const ALL_SYMBOLS = [
  "wool-flower", "apple", "orange", "lemon", "grape",
  "strawberry", "peach", "cherry", "star", "bell",
  "target", "ribbon", "crystal", "tent", "carousel",
] as const;

export type TileSymbol = (typeof ALL_SYMBOLS)[number];

const SYMBOL_LABELS: Record<TileSymbol, string> = {
  "wool-flower": "wool flower",
  apple: "apple",
  orange: "orange",
  lemon: "lemon",
  grape: "grape",
  strawberry: "strawberry",
  peach: "peach",
  cherry: "cherry",
  star: "star charm",
  bell: "bell",
  target: "target",
  ribbon: "ribbon",
  crystal: "crystal",
  tent: "circus tent",
  carousel: "carousel horse",
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
