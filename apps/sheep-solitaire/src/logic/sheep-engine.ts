/**
 * Deterministic card layout engine for Sheep Solitaire (羊了个羊).
 *
 * Layout Model v2 (redesign §9): the board is a central GRID tower of up to 5
 * staggered layers plus two face-up side STACKS (stackL / stackR) where only
 * the outermost card is pickable. Grid occlusion is computed on a unified fine
 * grid (half a cell = 1 unit, odd layers shifted half a cell) — the SAME
 * formula the Phaser scene uses for pixel placement, so "visually uncovered"
 * and "logically pickable" can never diverge. The local practice engine is
 * deterministic from a seed — the same seed always produces the same layout.
 *
 * The legacy 3-layer `generateCardLayout` is the FROZEN GameFi/TEE reference
 * the Morpheus worker must match before paid play is published; the released
 * guest game does not call the TEE. Its layouts carry defaulted v2 fields
 * (zone "grid", stackIndex 0) so every consumer shares one CardData type.
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

/** Board zone (§9.1): central grid tower | left side stack | right side stack. */
export type BoardZone = "grid" | "stackL" | "stackR";

export interface CardData {
  /** Unique id within the layout. */
  id: number;
  /** Symbol index. */
  symbol: number;
  /** grid: 0 = top … N-1 = bottom (up to GRID_MAX_LAYERS). stack: always 0. */
  layer: number;
  /** grid: column within the layer. stack: 0 (position = zone + stackIndex). */
  col: number;
  /** grid: row within the layer. stack: 0 (position = zone + stackIndex). */
  row: number;
  /** Zone (§9.1). Legacy data that omits it is treated as "grid". */
  zone: BoardZone;
  /** stackL/stackR burial depth: 0 = bottom … n-1 = top (only the top of the
   *  REMAINING stack is pickable). grid: always 0. */
  stackIndex: number;
}

export interface LayoutResult {
  cards: CardData[];
  /** Total number of cards in the layout. */
  totalCards: number;
  /** Number of distinct symbol types used. */
  cardTypes: number;
}

/** Grid layers span up to 5 in v2; layer 0 is the TOP, N-1 the bottom. */
export const GRID_MAX_LAYERS = 5;

/**
 * Zone of a card, defaulting legacy/frozen-path data (which omits v2 fields at
 * runtime — e.g. persisted v2 saves or the GameFi TEE layout) to "grid".
 */
export function cardZone(card: CardData): BoardZone {
  const zone = (card as Partial<CardData>).zone;
  return zone === "stackL" || zone === "stackR" ? zone : "grid";
}

/** Stack burial depth of a card, defaulting legacy data to 0. */
export function cardStackIndex(card: CardData): number {
  const index = (card as Partial<CardData>).stackIndex;
  return typeof index === "number" && Number.isSafeInteger(index) && index >= 0 ? index : 0;
}

export interface UnitPos {
  unitX: number;
  unitY: number;
}

/**
 * §9.2 unified fine grid (half a cell = 1 unit; odd layers shift half a cell):
 *
 *   unitX = col * 2 + (layer % 2)
 *   unitY = row * 2 + (layer % 2)
 *
 * CONTRACT: the Phaser scene must place grid tiles with this exact helper
 * (px = boardOriginX + unitX * tileW / 2, py likewise) so the engine's
 * occlusion truth and the rendered overlap are the same formula — a tile that
 * LOOKS uncovered is always logically pickable (no phantom locks).
 */
export function cardUnitPos(card: Pick<CardData, "layer" | "col" | "row">): UnitPos {
  const off = card.layer % 2;
  return { unitX: card.col * 2 + off, unitY: card.row * 2 + off };
}

/**
 * §9.2 grid occlusion (the engine's single source of truth): `a` covers `b`
 * iff `a` sits on a HIGHER layer (smaller index — ANY higher layer, not just
 * the adjacent one) and the two tiles overlap on the fine grid, i.e. their
 * centers are less than one full tile (2 units) apart on BOTH axes.
 * Grid-zone geometry only — stack exposure is by stackIndex, not position.
 */
export function gridCovers(
  a: Pick<CardData, "layer" | "col" | "row">,
  b: Pick<CardData, "layer" | "col" | "row">,
): boolean {
  if (a.layer >= b.layer) return false;
  const ua = cardUnitPos(a);
  const ub = cardUnitPos(b);
  return Math.abs(ua.unitX - ub.unitX) < 2 && Math.abs(ua.unitY - ub.unitY) < 2;
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
      // FROZEN GameFi/TEE reference layout: id/symbol/layer/col/row determinism
      // is the oracle contract. The v2 fields are pure defaults (grid-only).
      cards.push({
        id: id++,
        symbol,
        layer: config.layer,
        col: index % config.cols,
        row: Math.floor(index / config.cols),
        zone: "grid",
        stackIndex: 0,
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
 * Determine which cards are exposed (pickable) — §9.2 unified rule:
 *
 * - grid cards: exposed iff NO grid card on any higher layer overlaps them on
 *   the fine grid (`gridCovers`). Higher = smaller layer index, ANY distance
 *   up the tower (a layer-0 tile buries a layer-4 tile straight underneath).
 * - stack cards: exposed iff their stackIndex is the maximum REMAINING in
 *   their zone (only the outermost card of each side stack is pickable).
 */
export function computeExposed(cards: CardData[]): boolean[] {
  // During play card ids become sparse as picked cards leave the pile. Size the
  // lookup by max id, not remaining-card count, so `exposed[card.id]` is always
  // an explicit boolean for every card still in play.
  const maxId = cards.reduce((max, card) => Math.max(max, card.id), -1);
  const exposed = new Array(maxId + 1).fill(true);

  const grid: CardData[] = [];
  let topL = -1;
  let topR = -1;
  for (const card of cards) {
    const zone = cardZone(card);
    if (zone === "grid") grid.push(card);
    else if (zone === "stackL") topL = Math.max(topL, cardStackIndex(card));
    else topR = Math.max(topR, cardStackIndex(card));
  }

  for (const below of grid) {
    for (const above of grid) {
      if (gridCovers(above, below)) {
        exposed[below.id] = false;
        break;
      }
    }
  }

  for (const card of cards) {
    const zone = cardZone(card);
    if (zone === "grid") continue;
    exposed[card.id] = cardStackIndex(card) === (zone === "stackL" ? topL : topR);
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
// P1/P2 — Tight ("devil") layout generator + solvability simulator
//
// The original `generateCardLayout` packs every copy of a symbol onto ONE layer,
// which makes a constructive always-solvable board (clear top triples → middle
// → bottom, never exceeding the 7-slot tray). That is exactly the "guaranteed
// win, therefore boring" flaw the real 羊了个羊 avoids: its level 2 is near-
// impossible without props + luck.
//
// Legacy practice boards: `generateTightLayout` reuses the proven-solvable
// baseline, then performs cross-layer symbol swaps scaled by `spread`.
//
// v2 daily boards (§9.3): an explicit `structure` (up to 5 grid layers + two
// side stacks) is filled constructively — a simulated forward playthrough
// assigns triples with `spread`-scaled INTERLEAVING. Random swaps are NOT used
// there: on the dense 90-card board even a handful of swaps was measured to
// kill ~100% of boards, whereas interleaving preserves a provable clearing
// witness while pushing tray tension to the devil target. `simulateSolvability`
// scores each board so `generateDailyLevel` can SAMPLE a layout matching the
// difficulty target (level 1: zero-prop solvable; level 2: every deterministic
// zero-prop line fails yet a clearing line provably exists — hard, not dead).
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
   * 0..1 — how aggressively symbol copies are scattered across the board.
   * 0 keeps the constructive (provably zero-prop clearable) assignment.
   */
  spread: number;
  /** Max symbol swaps performed (scaled by card count). [PLACEHOLDER] */
  swapCap?: number;
  /**
   * v2 — explicit board structure (grid layers + side stacks). When present
   * the layout is built constructively on that structure instead of the
   * legacy 3-layer practice grid.
   */
  structure?: BoardStructure;
  /** v2 — copies of each symbol (multiple of 3). Default 3. Needs `structure`. */
  copiesPerSymbol?: number;
}

// ── v2 board structures (§9.3) ────────────────────────────────────────────────

export interface GridLayerSpec {
  cols: number;
  rows: number;
  /** Column of the layer's first cell — centers small layers over the base. */
  colOff: number;
  /** Row of the layer's first cell. */
  rowOff: number;
  /** Cards actually placed on this layer (≤ cols × rows), packed center-out. */
  count: number;
}

export interface BoardStructure {
  /** Index = layer (0 = top … N-1 = bottom). At most GRID_MAX_LAYERS entries. */
  layers: readonly GridLayerSpec[];
  /** Cards in EACH of the two face-up side stacks (stackL / stackR). */
  stackSize: number;
}

/**
 * Place the structure's cards: per layer, cells are packed densest at the
 * layer's fine-grid center (seeded jitter breaks ties so variants differ),
 * then the two side stacks are filled bottom (stackIndex 0) to top.
 * Symbols are assigned later; ids are sequential 0..total-1.
 */
function buildStructuredPositions(structure: BoardStructure, rand: () => number): CardData[] {
  if (structure.layers.length > GRID_MAX_LAYERS) {
    throw new Error(`structure exceeds ${GRID_MAX_LAYERS} grid layers`);
  }
  const cards: CardData[] = [];
  let id = 0;
  structure.layers.forEach((spec, layer) => {
    if (spec.count > spec.cols * spec.rows) {
      throw new Error(`layer ${layer} exceeds grid capacity`);
    }
    const parity = layer % 2;
    const centerX = spec.colOff * 2 + parity + (spec.cols - 1);
    const centerY = spec.rowOff * 2 + parity + (spec.rows - 1);
    const cells: Array<{ col: number; row: number; key: number }> = [];
    for (let c = 0; c < spec.cols; c += 1) {
      for (let r = 0; r < spec.rows; r += 1) {
        const col = spec.colOff + c;
        const row = spec.rowOff + r;
        const unit = cardUnitPos({ layer, col, row });
        const distSq = (unit.unitX - centerX) ** 2 + (unit.unitY - centerY) ** 2;
        cells.push({ col, row, key: distSq + rand() });
      }
    }
    cells.sort((a, b) => a.key - b.key);
    for (const cell of cells.slice(0, spec.count)) {
      cards.push({ id: id++, symbol: 0, layer, col: cell.col, row: cell.row, zone: "grid", stackIndex: 0 });
    }
  });
  for (const zone of ["stackL", "stackR"] as const) {
    for (let depth = 0; depth < structure.stackSize; depth += 1) {
      cards.push({ id: id++, symbol: 0, layer: 0, col: 0, row: 0, zone, stackIndex: depth });
    }
  }
  return cards;
}

/**
 * Constructive symbol assignment with INTERLEAVING as the difficulty knob.
 *
 * A forward playthrough over the positions repeatedly removes a random
 * currently-EXPOSED card (the covers relation is a DAG, so one always exists)
 * and assigns it to one of up to `maxOpen` concurrently "open" triples.
 * Replaying that exact pick order clears the board: the tray only ever holds
 * the open triples' unfinished copies, and the assignment forces a completion
 * whenever those reach 6 — so the witness never exceeds the 7-slot tray and
 * EVERY generated board is provably zero-prop clearable.
 *
 * spread 0 → one open triple (each triple completes before the next starts,
 * tray ≤ 3 — the teaching board). spread 1 → three interleaved triples with
 * delayed completions (tray tension up to 6 — the devil board a greedy player
 * almost never survives without props, even though a witness line exists).
 */
function assignConstructiveSymbols(
  cards: CardData[],
  types: number,
  copiesPerSymbol: number,
  spread: number,
  rand: () => number,
): void {
  if (copiesPerSymbol <= 0 || copiesPerSymbol % MATCH_GROUP !== 0) {
    throw new Error("copiesPerSymbol must be a positive multiple of 3");
  }
  if (cards.length !== types * copiesPerSymbol) {
    throw new Error("structure size must equal types × copiesPerSymbol");
  }
  const symbolQueue = shuffle(
    Array.from({ length: cards.length / MATCH_GROUP }, (_, index) => index % types),
    rand,
  );
  // Tray-safety invariant: maxOpen ≤ 3 keeps the open sum ≤ 6, and at sum 6
  // (2+2+2) a completable triple always exists, so the witness stays ≤ 7 slots.
  const maxOpen = 1 + Math.round(spread * 2);
  const openNewProb = 0.2 + 0.7 * spread; // [PLACEHOLDER] tuned via simulator
  const delayProb = 0.85 * spread; // [PLACEHOLDER] tuned via simulator

  interface OpenTriple {
    symbol: number;
    count: number;
  }
  const open: OpenTriple[] = [];
  let queueAt = 0;
  const openNew = (): OpenTriple => {
    const triple = { symbol: symbolQueue[queueAt++]!, count: 0 };
    open.push(triple);
    return triple;
  };

  const remaining = [...cards];
  while (remaining.length > 0) {
    const exposedArr = computeExposed(remaining);
    const exposedCards = remaining.filter((card) => exposedArr[card.id] !== false);
    const pick = exposedCards[Math.floor(rand() * exposedCards.length)]!;

    const openSum = open.reduce((sum, triple) => sum + triple.count, 0);
    let target: OpenTriple;
    const canOpen = open.length < maxOpen && queueAt < symbolQueue.length;
    if (open.length === 0) {
      target = openNew();
    } else if (openSum >= 2 * MATCH_GROUP) {
      // Forced completion keeps the replay tray within its 7 slots.
      target = open.find((triple) => triple.count === MATCH_GROUP - 1) ?? open[0]!;
    } else if (canOpen && rand() < openNewProb) {
      target = openNew();
    } else {
      const pending = open.filter((triple) => triple.count === 1);
      const nearDone = open.filter((triple) => triple.count === MATCH_GROUP - 1);
      if (nearDone.length > 0 && (pending.length === 0 || rand() >= delayProb)) {
        target = nearDone[Math.floor(rand() * nearDone.length)]!;
      } else if (pending.length > 0) {
        target = pending[Math.floor(rand() * pending.length)]!;
      } else {
        target = open[Math.floor(rand() * open.length)]!;
      }
    }

    pick.symbol = target.symbol;
    target.count += 1;
    if (target.count >= MATCH_GROUP) open.splice(open.indexOf(target), 1);
    remaining.splice(remaining.indexOf(pick), 1);
  }
}

/**
 * Generate a "tight" card layout.
 *
 * Legacy path (no `structure`): start from the always-solvable 3-layer
 * baseline, then scatter symbol copies across layers by swapping card symbols
 * between different layers. Layer capacities are never exceeded because we
 * only swap symbol VALUES, never move cards (so the per-layer grid stays valid
 * and the scene's render grid keeps matching).
 *
 * v2 path (`structure` given): build the structure's positions (grid layers +
 * side stacks), then assign symbols constructively with `spread`-scaled triple
 * INTERLEAVING (see assignConstructiveSymbols). No post-hoc swaps: on a deep
 * 90-card board even a handful of random swaps was measured to turn ~100% of
 * boards into dead ends, so difficulty comes from tray tension instead and
 * every board keeps its provable clearing witness.
 */
export function generateTightLayout(
  seed: number,
  cardTypes: number,
  opts: TightLayoutOptions,
): LayoutResult {
  const spread = Math.max(0, Math.min(1, Number.isFinite(opts.spread) ? opts.spread : 0));

  if (opts.structure) {
    const rand = mulberry32(seed);
    const types = Math.max(1, Math.min(Math.floor(cardTypes), ALL_SYMBOLS.length));
    const cards = buildStructuredPositions(opts.structure, rand);
    assignConstructiveSymbols(cards, types, opts.copiesPerSymbol ?? MATCH_GROUP, spread, rand);
    return { cards, totalCards: cards.length, cardTypes: types };
  }

  const base = generateCardLayout(seed, cardTypes);
  if (base.cards.length === 0) return base;
  const cards: CardData[] = base.cards.map((card) => ({ ...card }));
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

// ── Daily level presets (§9.3 — the difficulty contrast IS the product) ──────

/**
 * Daily level 1 (teaching): grid-only, 2 layers, 6 types × 3 = 18 cards.
 * spread 0 keeps the constructive assignment, so every candidate board is
 * PROVABLY zero-prop clearable; the sampler additionally requires the greedy
 * simulator to witness it (<30s of play, zero props, 100% clearable).
 */
export const DAILY_L1_STRUCTURE: BoardStructure = {
  layers: [
    { cols: 3, rows: 2, colOff: 1, rowOff: 1, count: 6 },
    { cols: 4, rows: 3, colOff: 0, rowOff: 0, count: 12 },
  ],
  stackSize: 0,
};

/**
 * Daily level 2 (devil): a dense 5-layer center pyramid (72 cards, bottom
 * layers near-full so almost everything starts buried) plus two 9-card side
 * stacks — 90 cards total, 15 types × 6 copies (∑ ≡ 0 mod 3). Interleaved
 * construction keeps a provable clearing witness on EVERY board; the sampler
 * additionally requires the simulator to confirm non-deadness while every
 * deterministic zero-prop greedy line fails (hard, not dead).
 */
export const DAILY_L2_STRUCTURE: BoardStructure = {
  layers: [
    { cols: 2, rows: 3, colOff: 2, rowOff: 1, count: 6 },
    { cols: 5, rows: 2, colOff: 0, rowOff: 1, count: 10 },
    { cols: 4, rows: 4, colOff: 1, rowOff: 0, count: 14 },
    { cols: 5, rows: 4, colOff: 0, rowOff: 0, count: 18 },
    { cols: 6, rows: 5, colOff: 0, rowOff: 0, count: 24 },
  ],
  stackSize: 9,
};

export interface DailyLevelPreset {
  types: number;
  /** Copies of each symbol across grid + stacks (multiple of 3). */
  copiesPerSymbol: number;
  totalCards: number;
  spread: number;
  structure: BoardStructure;
  /** Highest grid layer index the preset produces (= layers - 1). */
  maxLayer: number;
}

export const DAILY_LEVEL_PRESETS: Record<1 | 2, DailyLevelPreset> = {
  1: {
    types: 6,
    copiesPerSymbol: 3,
    totalCards: 18,
    spread: 0,
    structure: DAILY_L1_STRUCTURE,
    maxLayer: DAILY_L1_STRUCTURE.layers.length - 1,
  },
  2: {
    types: 15,
    copiesPerSymbol: 6,
    totalCards: 90,
    spread: 0.85, // [PLACEHOLDER] tuned so ~all greedy lines fail yet rollouts clear
    structure: DAILY_L2_STRUCTURE,
    maxLayer: DAILY_L2_STRUCTURE.layers.length - 1,
  },
};

export interface SolvabilityReport {
  /** True if a greedy player can clear the board with ZERO props. */
  passNoItems: boolean;
  /** True if the best greedy run CLEARED the board at all (props allowed). */
  cleared: boolean;
  /** Props (undo/shuffle/remove3/revive proxies) spent in the best run. */
  minItems: number;
  /** Peak tray occupancy observed during the best run. */
  maxSlot: number;
}

type PickMode = "complete" | "tray" | "exposed" | "surface";

/** Deterministic seeded rollout count for the non-dead existence check. */
const SIM_ROLLOUTS = 24; // [PLACEHOLDER]

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
 * would overflow. `rand` (rollout mode) randomizes ties within the best
 * candidate tier — deterministic when seeded with mulberry32.
 */
function runGreedy(
  initial: CardData[],
  mode: PickMode,
  rand: (() => number) | null = null,
): SolvabilityReport {
  let pile: CardData[] = initial.map((card) => ({ ...card }));
  let slots: CardData[] = [];
  let props = 0;
  let maxSlot = 0;
  let dead = false;

  while (pile.length > 0 || slots.length > 0) {
    if (pile.length === 0) {
      // Leftover tray tiles with an empty board can never triple up.
      dead = true;
      break;
    }
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
    } else if (mode === "exposed") {
      const remaining = new Map<number, number>();
      for (const card of pile) {
        remaining.set(card.symbol, (remaining.get(card.symbol) ?? 0) + 1);
      }
      pick = exposedCards
        .slice()
        .sort((a, b) => (remaining.get(b.symbol) ?? 0) - (remaining.get(a.symbol) ?? 0))[0];
    } else {
      // "surface": strongest heuristic — finish triples, then harvest fully
      // exposed triples (free progress), then extend pairs, then chase the
      // symbol with the most exposed copies.
      const exposedCount = new Map<number, number>();
      for (const card of exposedCards) {
        exposedCount.set(card.symbol, (exposedCount.get(card.symbol) ?? 0) + 1);
      }
      let candidates = exposedCards.filter(
        (card) => (symbolInSlots.get(card.symbol) ?? 0) === MATCH_GROUP - 1,
      );
      if (candidates.length === 0) {
        candidates = exposedCards.filter(
          (card) =>
            (exposedCount.get(card.symbol) ?? 0) + (symbolInSlots.get(card.symbol) ?? 0) >=
            MATCH_GROUP,
        );
      }
      if (candidates.length === 0 && slots.length < TIGHT_MAX_SLOTS - 2) {
        candidates = exposedCards.filter((card) => (symbolInSlots.get(card.symbol) ?? 0) === 1);
      }
      if (candidates.length === 0) {
        let best = -1;
        for (const card of exposedCards) {
          best = Math.max(best, exposedCount.get(card.symbol) ?? 0);
        }
        candidates = exposedCards.filter((card) => (exposedCount.get(card.symbol) ?? 0) === best);
      }
      pick = rand ? candidates[Math.floor(rand() * candidates.length)] : candidates[0];
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

  const cleared = !dead && pile.length === 0 && slots.length === 0;
  const passNoItems = cleared && props === 0;
  return { passNoItems, cleared, minItems: props, maxSlot };
}

/**
 * Score a layout and return the BEST outcome (zero-prop clear first, then any
 * clear with the fewest props, then lowest peak tray; dead runs last — a dead
 * run's minItems only counts props burned before dying, so `cleared` is what
 * distinguishes "hard" from "dead").
 *
 * - `passNoItems` is judged by DETERMINISTIC heuristics only: it means a
 *   realistic single-line greedy player clears the board with zero props.
 * - `cleared` (the non-dead existence check) additionally consults seeded
 *   random rollouts of the surface heuristic with the prop budget: a lucky
 *   line no human could replay proves the board is not a dead end without
 *   making it count as "easy".
 *
 * Stack exposure is modeled exactly like play: `computeExposed` keeps only
 * each side stack's top card pickable. Fully deterministic (seeded rollouts),
 * so sampling and tests are reproducible.
 */
export function simulateSolvability(cards: CardData[]): SolvabilityReport {
  const results = (["complete", "tray", "exposed", "surface"] as PickMode[]).map((mode) =>
    runGreedy(cards, mode),
  );
  results.sort((a, b) => {
    if (a.passNoItems !== b.passNoItems) return a.passNoItems ? -1 : 1;
    if (a.cleared !== b.cleared) return a.cleared ? -1 : 1;
    if (a.minItems !== b.minItems) return a.minItems - b.minItems;
    return a.maxSlot - b.maxSlot;
  });
  const best = results[0]!;
  if (best.cleared) return best;

  for (let rollout = 0; rollout < SIM_ROLLOUTS; rollout += 1) {
    const rolled = runGreedy(cards, "surface", mulberry32(hash3(0x5eedc0de, rollout, cards.length)));
    if (rolled.cleared) {
      // Existence proof only: keep passNoItems from the deterministic runs.
      return { ...rolled, passNoItems: false };
    }
  }
  return best;
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
 * Sample a daily level layout from the §9.3 presets. Level 1 (18-card teaching
 * board) targets a zero-prop-solvable board — every candidate is already
 * constructively clearable (spread 0), the sampler just makes the greedy
 * simulator witness it. Level 2 (90-card devil board) targets a board where
 * every deterministic zero-prop greedy line FAILS but the simulator still
 * proves a clearing line exists within the prop budget (hard yet not dead).
 * Falls back to the first candidate if no variant hits the target within
 * `maxVariants` — constructive interleaving keeps even that fallback provably
 * clearable.
 *
 * `cardTypes` is accepted for call-site compatibility but the preset owns the
 * board shape (types/copies/structure) — the two must not diverge.
 */
export function generateDailyLevel(
  dateSeed: number,
  level: 1 | 2,
  cardTypes?: number,
): LayoutResult {
  void cardTypes;
  const preset = DAILY_LEVEL_PRESETS[level];
  const wantNoItem = level === 1;
  const maxVariants = 200; // [PLACEHOLDER]
  let fallback: LayoutResult | null = null;

  for (let variant = 0; variant < maxVariants; variant++) {
    const seed = hash3(dateSeed, level, variant);
    const layout = generateTightLayout(seed, preset.types, {
      spread: preset.spread,
      structure: preset.structure,
      copiesPerSymbol: preset.copiesPerSymbol,
    });
    if (layout.cards.length === 0) continue;
    if (!fallback) fallback = layout;
    const sim = simulateSolvability(layout.cards);
    if (wantNoItem) {
      if (sim.passNoItems) return layout;
    } else if (sim.cleared && !sim.passNoItems && sim.minItems <= SIM_PROP_CAP) {
      // Hard (no deterministic zero-prop line) but provably not dead. minItems
      // is often 0 here — a lucky rollout line no human could replay — so the
      // window is [0, SIM_PROP_CAP], not [1, SIM_PROP_CAP].
      return layout;
    }
  }

  return fallback ?? { cards: [], totalCards: 0, cardTypes: 0 };
}
