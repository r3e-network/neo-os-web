/**
 * engine-zhuada.ts — pure rules for Catch the Goose (抓大鹅), B-class physics
 * extraction edition.
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
  /** emoji fallback used in the tray + HUD (original art is swappable later) */
  emoji: string;
}

/** 12 item kinds — visually distinct original low-poly produce, CC-art swappable. */
export const ITEM_DEFS: ItemDef[] = [
  { id: 0, name: "Tomato", nameZh: "番茄", geometry: "sphere", model: "tomato", color: 0xef4444, emoji: "🍅" },
  { id: 1, name: "Carrot", nameZh: "胡萝卜", geometry: "cone", model: "carrot", color: 0xf59e0b, emoji: "🥕" },
  { id: 2, name: "Corn", nameZh: "玉米", geometry: "cylinder", model: "corn", color: 0xfbbf24, emoji: "🌽" },
  { id: 3, name: "Eggplant", nameZh: "茄子", geometry: "icosa", model: "eggplant", color: 0x8b5cf6, emoji: "🍆" },
  { id: 4, name: "Apple", nameZh: "苹果", geometry: "sphere", model: "apple", color: 0x22c55e, emoji: "🍎" },
  { id: 5, name: "Broccoli", nameZh: "西兰花", geometry: "icosa", model: "broccoli", color: 0x16a34a, emoji: "🥦" },
  { id: 6, name: "Mushroom", nameZh: "蘑菇", geometry: "cylinder", model: "mushroom", color: 0xf87171, emoji: "🍄" },
  { id: 7, name: "Onion", nameZh: "洋葱", geometry: "sphere", model: "onion", color: 0xa78bfa, emoji: "🧅" },
  { id: 8, name: "Pepper", nameZh: "辣椒", geometry: "cone", model: "pepper", color: 0xdc2626, emoji: "🌶️" },
  { id: 9, name: "Melon", nameZh: "西瓜", geometry: "sphere", model: "melon", color: 0x0ea371, emoji: "🍉" },
  { id: 10, name: "Egg", nameZh: "鸡蛋", geometry: "cylinder", model: "egg", color: 0xfde68a, emoji: "🥚" },
  { id: 11, name: "Fish", nameZh: "小鱼干", geometry: "box", model: "fish", color: 0x38bdf8, emoji: "🐟" },
];

export const TRAY_SLOTS = 7;

/** A live item instance inside the box. */
export interface ItemInstance {
  id: number;
  kind: number;
  /** spawn position (box-local, above the rim) */
  px: number;
  py: number;
  pz: number;
}

export interface LevelSpec {
  level: number;
  kinds: number;
  perKind: number; // each kind appears perKind*3 times → always clearable
  timeMs: number;
  boxSize: number;
}

export interface TrayResult {
  slots: (number | null)[];
  /** indices cleared this extract (length 0 or 3) */
  cleared: number[];
  matched: boolean;
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

/** Generate the item instances for a level: kinds×perKind×3, shuffled. */
export function generateItems(spec: LevelSpec, rng: () => number): ItemInstance[] {
  const pool: ItemInstance[] = [];
  let id = 0;
  const half = spec.boxSize / 2 - 0.6;
  for (let k = 0; k < spec.kinds; k += 1) {
    const count = spec.perKind * 3;
    for (let i = 0; i < count; i += 1) {
      pool.push({
        id: id++,
        kind: k,
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

/**
 * Pull an item of `kind` into the tray.
 * - find first empty slot, place kind
 * - if three of `kind` now sit in the tray, clear exactly those three
 * - returns new slots + cleared indices
 */
export function applyExtract(slots: (number | null)[], kind: number): TrayResult {
  const next = slots.slice();
  const emptyIdx = next.indexOf(null);
  if (emptyIdx === -1) {
    return { slots: next, cleared: [], matched: false };
  }
  next[emptyIdx] = kind;

  const sameIdx = next
    .map((v, i) => (v === kind ? i : -1))
    .filter((i) => i !== -1);
  if (sameIdx.length >= 3) {
    const clearIdx = sameIdx.slice(0, 3);
    for (const i of clearIdx) next[i] = null;
    return { slots: next, cleared: clearIdx, matched: true };
  }
  return { slots: next, cleared: [], matched: false };
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
