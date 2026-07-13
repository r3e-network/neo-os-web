/**
 * engine-zhuada.ts — pure extraction-and-match rules for Goose Basket Shuffle.
 *
 * Mechanic (per the community Three.js + cannon-es reimplementation):
 *   - N low-poly items drop into an open-top box and pile up under physics.
 *   - The player taps an item to pull it OUT of the box into a "tray" of slots.
 *   - Three of the same kind in the tray clear away.
 *   - Game over when every tray slot is full with no triple to clear.
 *   - Level cleared when the box is empty.
 *
 * All functions are pure + deterministic (seeded rng) so the same rules run in
 * guest (local) and (future) gamefi modes. No physics here — cannon-es handles
 * the simulation; this module owns kinds, generation counts, tray matching, and
 * win/lose predicates.
 */

export type GeometryKind = "sphere" | "box" | "cylinder" | "cone" | "torus" | "icosa";

/** Visual model used by the low-poly scene (see scenes/models.ts). */
export type ModelKind =
  | "tomato" | "carrot" | "corn" | "eggplant" | "apple"
  | "broccoli" | "mushroom" | "onion" | "pepper" | "melon"
  | "egg" | "fish";

export interface ItemDef {
  id: number;
  name: string;
  nameZh: string;
  geometry: GeometryKind;
  /** low-poly visual model */
  model: ModelKind;
  /** hex color for the low-poly material */
  color: number;
}

/** 18 logical kind ids shared by every selectable theme. Runtime 2D art comes
 * from optimized ImageGen atlases and 3D art from the matching model catalog. */
export const ITEM_DEFS: ItemDef[] = [
  { id: 0, name: "Tomato", nameZh: "番茄", geometry: "sphere", model: "tomato", color: 0xef4444 },
  { id: 1, name: "Carrot", nameZh: "胡萝卜", geometry: "cone", model: "carrot", color: 0xf59e0b },
  { id: 2, name: "Corn", nameZh: "玉米", geometry: "cylinder", model: "corn", color: 0xfbbf24 },
  { id: 3, name: "Eggplant", nameZh: "茄子", geometry: "icosa", model: "eggplant", color: 0x8b5cf6 },
  { id: 4, name: "Apple", nameZh: "苹果", geometry: "sphere", model: "apple", color: 0x22c55e },
  { id: 5, name: "Broccoli", nameZh: "西兰花", geometry: "icosa", model: "broccoli", color: 0x16a34a },
  { id: 6, name: "Mushroom", nameZh: "蘑菇", geometry: "cylinder", model: "mushroom", color: 0xf87171 },
  { id: 7, name: "Onion", nameZh: "洋葱", geometry: "sphere", model: "onion", color: 0xa78bfa },
  { id: 8, name: "Pepper", nameZh: "辣椒", geometry: "cone", model: "pepper", color: 0xdc2626 },
  { id: 9, name: "Melon", nameZh: "西瓜", geometry: "sphere", model: "melon", color: 0x0ea371 },
  { id: 10, name: "Egg", nameZh: "鸡蛋", geometry: "cylinder", model: "egg", color: 0xfde68a },
  { id: 11, name: "Fish", nameZh: "小鱼干", geometry: "box", model: "fish", color: 0x38bdf8 },
  { id: 12, name: "Berry", nameZh: "莓果", geometry: "sphere", model: "tomato", color: 0xd94c52 },
  { id: 13, name: "Slice", nameZh: "切片", geometry: "cylinder", model: "melon", color: 0x63a55b },
  { id: 14, name: "Jar", nameZh: "罐子", geometry: "cylinder", model: "mushroom", color: 0xe5a72f },
  { id: 15, name: "Wedge", nameZh: "楔形物", geometry: "box", model: "corn", color: 0xf2c84b },
  { id: 16, name: "Keepsake", nameZh: "摆件", geometry: "icosa", model: "broccoli", color: 0xc86f4a },
  { id: 17, name: "Carton", nameZh: "纸盒", geometry: "box", model: "eggplant", color: 0xf0d78a },
];

export const TRAY_SLOTS = 7;

/** Side-shelf capacity for the "remove" rescue (移出): first 3 tray items park
 * here and still participate in 3-matching (parity spec G2). */
export const SHELF_SLOTS = 3;

/** A live item instance inside the box. */
export interface ItemInstance {
  id: number;
  kind: number;
  /** spawn position in box-local coordinates */
  px: number;
  py: number;
  pz: number;
  /** Initial cascade drops from above; streamed refills emerge under the pile. */
  spawnMode?: "drop" | "reservoir";
}

/**
 * Authoritative acknowledgement for a scene pick. The scene marks a body as
 * in-flight synchronously, then uses this receipt to either animate it into the
 * exact slot chosen by the rules engine or roll it back when the tray was full.
 */
export interface ExtractReceipt {
  nonce: number;
  itemId: number;
  kind: number;
  accepted: boolean;
  /** Slot occupied by the incoming item after like-kind grouping. */
  placedIndex: number;
  matched: boolean;
  /** Presentation snapshot before a possible triple is removed. */
  landingTray: (number | null)[];
  /** Authoritative compact tray after a possible triple is removed. */
  settledTray: (number | null)[];
  /** Indices highlighted/cleared from `landingTray`. */
  clearedTray: number[];
}

export const EMPTY_EXTRACT_RECEIPT: ExtractReceipt = {
  nonce: 0,
  itemId: -1,
  kind: -1,
  accepted: false,
  placedIndex: -1,
  matched: false,
  landingTray: Array<number | null>(TRAY_SLOTS).fill(null),
  settledTray: Array<number | null>(TRAY_SLOTS).fill(null),
  clearedTray: [],
};

export interface LevelSpec {
  level: number;
  kinds: number;
  perKind: number; // each kind appears perKind*3 times → always clearable
  timeMs: number;
  boxSize: number;
  /**
   * Ordered ITEM_DEFS ids this level draws from (scene theming, G4). The first
   * `kinds` entries are used; omitted → identity mapping 0..kinds-1.
   */
  kindPool?: number[];
}

/** Seeded RNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate the item instances for a level: kinds×perKind×3, shuffled.
 * Kind ids come from the scene's `kindPool` when present (theme mix), else
 * the identity 0..kinds-1; either way each kind count stays a multiple of 3. */
export function generateItems(spec: LevelSpec, rng: () => number): ItemInstance[] {
  const pool: ItemInstance[] = [];
  let id = 0;
  const half = spec.boxSize / 2 - 0.6;
  for (let k = 0; k < spec.kinds; k += 1) {
    const kindId = spec.kindPool?.[k] ?? k;
    const count = spec.perKind * 3;
    for (let i = 0; i < count; i += 1) {
      pool.push({
        id: id++,
        kind: kindId,
        px: (rng() * 2 - 1) * half,
        py: spec.boxSize / 2 + rng() * spec.boxSize, // drop from above the rim
        pz: (rng() * 2 - 1) * half,
      });
    }
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool;
}

// ── Cross-zone matching (tray + side shelf, parity spec G2) ────────────────
// The classic tray-only extract was superseded by applyExtractShelf below —
// with an empty shelf it degenerates to exactly the old rule.

export interface ShelfExtractResult {
  tray: (number | null)[];
  /** Compact/grouped tray including the incoming item, before clear. */
  landingTray: (number | null)[];
  shelf: (number | null)[];
  /** tray indices cleared this extract (subset of the cleared triple) */
  clearedTray: number[];
  /** shelf indices cleared this extract (subset of the cleared triple) */
  clearedShelf: number[];
  matched: boolean;
  /** false when the tray was already full — nothing was placed. */
  placed: boolean;
  /** Tray index the item landed in (-1 when not placed). */
  placedIndex: number;
}

/** Remove internal holes while preserving the visible left-to-right order. */
export function compactTray(slots: (number | null)[]): (number | null)[] {
  const occupied = slots.filter((slot): slot is number => slot !== null);
  return [
    ...occupied.slice(0, TRAY_SLOTS),
    ...Array<number | null>(Math.max(0, TRAY_SLOTS - occupied.length)).fill(null),
  ];
}

/**
 * Canonicalize a restored/legacy tray into stable like-kind groups. The first
 * occurrence of each kind owns the group's position, so unrelated groups do
 * not jump around between picks.
 */
export function organizeTray(slots: (number | null)[]): (number | null)[] {
  const occupied = slots.filter((slot): slot is number => slot !== null);
  const orderedKinds: number[] = [];
  const counts = new Map<number, number>();
  for (const kind of occupied) {
    if (!counts.has(kind)) orderedKinds.push(kind);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const grouped = orderedKinds.flatMap((kind) => Array<number>(counts.get(kind) ?? 0).fill(kind));
  return compactTray(grouped);
}

/**
 * Pull an item of `kind` into the tray with the side shelf participating in
 * matching:
 *  - occupied slots are compacted left and like kinds stay together;
 *  - the item inserts immediately after its existing kind group, smoothly
 *    making room on the right (the shelf is never a landing zone);
 *  - if `kind` now appears 3+ times across tray+shelf, exactly 3 copies clear —
 *    SHELF copies first (the rescue zone should drain itself), then tray ones.
 *
 * Invariant preserved: outside of this call every kind holds ≤2 copies across
 * both zones (a 3rd always clears), so `applyRemoveToShelf` can never create a
 * triple by moving items.
 */
export function applyExtractShelf(
  tray: (number | null)[],
  shelf: (number | null)[],
  kind: number,
): ShelfExtractResult {
  const occupiedCount = tray.filter((slot) => slot !== null).length;
  const nextShelf = shelf.slice();
  if (occupiedCount >= TRAY_SLOTS) {
    const unchanged = tray.slice();
    return { tray: unchanged, landingTray: unchanged, shelf: nextShelf, clearedTray: [], clearedShelf: [], matched: false, placed: false, placedIndex: -1 };
  }

  const grouped = organizeTray(tray).filter((slot): slot is number => slot !== null);
  const previousKindIndex = grouped.lastIndexOf(kind);
  const placedIndex = previousKindIndex >= 0 ? previousKindIndex + 1 : grouped.length;
  grouped.splice(placedIndex, 0, kind);
  const landingTray = compactTray(grouped);

  const shelfIdx = nextShelf.map((v, i) => (v === kind ? i : -1)).filter((i) => i !== -1);
  const trayIdx = landingTray.map((v, i) => (v === kind ? i : -1)).filter((i) => i !== -1);
  if (shelfIdx.length + trayIdx.length >= 3) {
    const clearedShelf = shelfIdx.slice(0, 3);
    const clearedTray = trayIdx.slice(0, 3 - clearedShelf.length);
    for (const i of clearedShelf) nextShelf[i] = null;
    const settledTray = landingTray.slice();
    for (const i of clearedTray) settledTray[i] = null;
    return {
      tray: compactTray(settledTray),
      landingTray,
      shelf: nextShelf,
      clearedTray,
      clearedShelf,
      matched: true,
      placed: true,
      placedIndex,
    };
  }
  return { tray: landingTray, landingTray, shelf: nextShelf, clearedTray: [], clearedShelf: [], matched: false, placed: true, placedIndex };
}

/**
 * The "remove" rescue (移出): park the first 3 occupied tray slots on the side
 * shelf. Only legal while the shelf is completely empty (capacity 3) and the
 * tray holds at least 3 items. Returns null when unavailable.
 */
export function applyRemoveToShelf(
  tray: (number | null)[],
  shelf: (number | null)[],
): { tray: (number | null)[]; shelf: (number | null)[]; movedFrom: number[] } | null {
  if (shelf.some((s) => s !== null)) return null;
  const occupied = tray.map((v, i) => (v !== null ? i : -1)).filter((i) => i !== -1);
  if (occupied.length < 3) return null;
  const nextTray = tray.slice();
  const nextShelf = shelf.slice();
  const movedFrom = occupied.slice(0, SHELF_SLOTS);
  movedFrom.forEach((trayIdx, shelfIdx) => {
    nextShelf[shelfIdx] = nextTray[trayIdx]!;
    nextTray[trayIdx] = null;
  });
  return { tray: compactTray(nextTray), shelf: nextShelf, movedFrom };
}

export function isTrayFull(slots: (number | null)[]): boolean {
  return slots.every((s) => s !== null);
}

/** True when no tray triple can ever clear (every kind appears < 3 times). */
export function isTrayStuck(slots: (number | null)[]): boolean {
  if (!isTrayFull(slots)) return false;
  const counts = new Map<number, number>();
  for (const s of slots) if (s !== null) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const c of counts.values()) if (c >= 3) return false;
  return true;
}

export function remainingInBox(items: ItemInstance[]): number {
  return items.length;
}
