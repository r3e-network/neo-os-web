/**
 * Deterministic card layout engine for Sheep Solitaire (羊了个羊).
 *
 * The layout has 3 layers of cards stacked in a staggered grid. Cards on
 * higher layers block access to cards directly underneath. The engine is
 * purely deterministic from a seed — the same seed always produces the same
 * layout — so the TEE can generate it and the client never needs to see the
 * full state, only the CardView[].
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

  // Each type appears in multiples of 3 for match-3.
  // We create 3 groups of each type, distributed across layers.
  const types = Math.min(cardTypes, ALL_SYMBOLS.length);

  // Layer 0 (top): 1 card of each type = types cards
  // Layer 1 (middle): 1 card of each type = types cards
  // Layer 2 (bottom): 1 card of each type = types cards
  // Total = 3 * types cards (each type appears exactly 3 times)
  const cardsPerLayer = types;

  // Build symbol assignments per layer
  const layer0Symbols: number[] = [];
  const layer1Symbols: number[] = [];
  const layer2Symbols: number[] = [];

  for (let t = 0; t < types; t++) {
    layer0Symbols.push(t);
    layer1Symbols.push(t);
    layer2Symbols.push(t);
  }

  // Shuffle each layer independently for varied placement
  const shuffled0 = shuffle(layer0Symbols, rand);
  const shuffled1 = shuffle(layer1Symbols, rand);
  const shuffled2 = shuffle(layer2Symbols, rand);

  // Define grid dimensions for each layer.
  // Bottom layer is largest, top layer is smallest.
  // Cards are staggered so higher-layer cards overlap multiple lower-layer cards.
  const layerConfigs = [
    { cols: 4, rows: 3, offsetX: 2, offsetY: 2 }, // layer 0 (top) - 4x3 grid
    { cols: 5, rows: 4, offsetX: 1, offsetY: 1 }, // layer 1 (middle) - 5x4 grid
    { cols: 6, rows: 5, offsetX: 0, offsetY: 0 }, // layer 2 (bottom) - 6x5 grid
  ];

  const cards: CardData[] = [];
  let id = 0;

  // Layer 2 (bottom) first
  const lc2 = layerConfigs[2]!;
  for (let i = 0; i < cardsPerLayer && i < shuffled2.length; i++) {
    const col = i % lc2.cols;
    const row = Math.floor(i / lc2.cols);
    cards.push({
      id: id++,
      symbol: shuffled2[i]!,
      layer: 2,
      col,
      row,
    });
  }

  // Layer 1 (middle)
  const lc1 = layerConfigs[1]!;
  for (let i = 0; i < cardsPerLayer && i < shuffled1.length; i++) {
    const col = i % lc1.cols;
    const row = Math.floor(i / lc1.cols);
    cards.push({
      id: id++,
      symbol: shuffled1[i]!,
      layer: 1,
      col,
      row,
    });
  }

  // Layer 0 (top)
  const lc0 = layerConfigs[0]!;
  for (let i = 0; i < cardsPerLayer && i < shuffled0.length; i++) {
    const col = i % lc0.cols;
    const row = Math.floor(i / lc0.cols);
    cards.push({
      id: id++,
      symbol: shuffled0[i]!,
      layer: 0,
      col,
      row,
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
  const exposed = new Array(cards.length).fill(true);
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
