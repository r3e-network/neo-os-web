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

  /** Visual model used by the scene (see scenes/models.ts). */
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

/** 54 logical kind ids shared by every selectable theme. The first 18 own
 * authored recipes; ids +18 and +36 are separate near-match identities that
 * map back to the same silhouette with different material/icon treatments. */
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
  { id: 18, name: "Crimson round", nameZh: "绯红圆果", geometry: "sphere", model: "tomato", color: 0xd94c52 },
  { id: 19, name: "Blush round", nameZh: "粉彩圆果", geometry: "sphere", model: "apple", color: 0xe6675f },
  { id: 20, name: "Lime oval", nameZh: "青绿椭果", geometry: "sphere", model: "egg", color: 0x78b84c },
  { id: 21, name: "Blue stem", nameZh: "蓝顶柄物", geometry: "cylinder", model: "mushroom", color: 0x6f8fc2 },
  { id: 22, name: "Rye long", nameZh: "黑麦长物", geometry: "cylinder", model: "corn", color: 0x8b5a33 },
  { id: 23, name: "Berry vessel", nameZh: "莓色容器", geometry: "cylinder", model: "onion", color: 0xb66a8d },
  { id: 24, name: "Red box", nameZh: "红色盒物", geometry: "box", model: "eggplant", color: 0xb54b43 },
  { id: 25, name: "Yellow wide", nameZh: "黄色宽物", geometry: "box", model: "fish", color: 0xe0ad3a },
  { id: 26, name: "Mint wrap", nameZh: "薄荷包物", geometry: "sphere", model: "pepper", color: 0x54bca1 },
  { id: 27, name: "Golden oval", nameZh: "金黄椭果", geometry: "sphere", model: "melon", color: 0xc7b94a },
  { id: 28, name: "Cocoa ring", nameZh: "可可圆环", geometry: "cylinder", model: "egg", color: 0x9f6948 },
  { id: 29, name: "Speckled oval", nameZh: "斑点椭圆", geometry: "box", model: "fish", color: 0xe5d8ba },
  { id: 30, name: "Rose berry", nameZh: "玫红莓果", geometry: "sphere", model: "tomato", color: 0xc83f4b },
  { id: 31, name: "Dark slice", nameZh: "深绿切片", geometry: "cylinder", model: "melon", color: 0x467f52 },
  { id: 32, name: "Amber jar", nameZh: "琥珀罐", geometry: "cylinder", model: "mushroom", color: 0xc68d24 },
  { id: 33, name: "Pale wedge", nameZh: "浅黄楔物", geometry: "box", model: "corn", color: 0xe3b947 },
  { id: 34, name: "Terracotta keepsake", nameZh: "陶土摆件", geometry: "icosa", model: "broccoli", color: 0xa95d42 },
  { id: 35, name: "Apple carton", nameZh: "苹果纸盒", geometry: "box", model: "eggplant", color: 0xd6bc6d },
  { id: 36, name: "Olive round", nameZh: "橄榄圆果", geometry: "sphere", model: "tomato", color: 0x78963a },
  { id: 37, name: "Tangerine long", nameZh: "蜜橘长物", geometry: "cone", model: "carrot", color: 0xe77f26 },
  { id: 38, name: "Golden cylinder", nameZh: "金黄柱物", geometry: "cylinder", model: "corn", color: 0xe8cc3c },
  { id: 39, name: "Chestnut cap", nameZh: "栗色帽物", geometry: "icosa", model: "eggplant", color: 0xa87358 },
  { id: 40, name: "Honey round", nameZh: "蜜色圆果", geometry: "sphere", model: "apple", color: 0xc9823f },
  { id: 41, name: "Ivory cluster", nameZh: "象牙白簇物", geometry: "icosa", model: "broccoli", color: 0xe6dcc9 },
  { id: 42, name: "Olive stem", nameZh: "橄榄柄物", geometry: "cylinder", model: "mushroom", color: 0x5e7b4f },
  { id: 43, name: "Teal oval", nameZh: "青蓝椭果", geometry: "sphere", model: "onion", color: 0x2d718f },
  { id: 44, name: "Rose tapered", nameZh: "玫粉尖物", geometry: "cone", model: "pepper", color: 0xd98ca0 },
  { id: 45, name: "Yellow melon", nameZh: "黄绿圆瓜", geometry: "sphere", model: "melon", color: 0xb6c448 },
  { id: 46, name: "Caramel oval", nameZh: "焦糖椭圆", geometry: "cylinder", model: "egg", color: 0xbf845a },
  { id: 47, name: "Cream fish", nameZh: "奶油小鱼", geometry: "box", model: "fish", color: 0xece4d6 },
  { id: 48, name: "Ruby berry", nameZh: "宝石红莓果", geometry: "sphere", model: "tomato", color: 0xb93f48 },
  { id: 49, name: "Striped slice", nameZh: "条纹切片", geometry: "cylinder", model: "melon", color: 0x568d50 },
  { id: 50, name: "Golden jar", nameZh: "金色罐子", geometry: "cylinder", model: "mushroom", color: 0xd49a28 },
  { id: 51, name: "Butter wedge", nameZh: "黄油楔物", geometry: "box", model: "corn", color: 0xe8c043 },
  { id: 52, name: "Clay keepsake", nameZh: "赤陶摆件", geometry: "icosa", model: "broccoli", color: 0xb96546 },
  { id: 53, name: "Pear carton", nameZh: "青梨纸盒", geometry: "box", model: "eggplant", color: 0xe3ca79 },
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
   * Ordered ITEM_DEFS ids selected for this deal (scene theming, G4). All
   * entries are used; omitted → identity mapping 0..kinds-1.
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
