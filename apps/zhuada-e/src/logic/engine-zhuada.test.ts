/**
 * engine-zhuada.test.ts — pure-rules regression tests for the cross-zone
 * tray+shelf matching (parity G2 移出/撤回 foundations).
 *
 * Key invariants under test:
 *  - applyExtractShelf fills the first empty TRAY slot and clears exactly 3
 *    copies across tray+shelf, SHELF copies first.
 *  - applyRemoveToShelf only fires with an empty shelf and ≥3 tray items, and
 *    can never create a triple (cross-zone counts are ≤2 by construction).
 *  - A full random playthrough (any level spec) always ends with an empty
 *    tray AND shelf when the box empties — the win check (`items.length===0`)
 *    is sufficient even with the shelf in play.
 */

import { describe, expect, it } from "vitest";
import {
  applyExtractShelf,
  applyRemoveToShelf,
  generateItems,
  isTrayStuck,
  makeRng,
  SHELF_SLOTS,
  TRAY_SLOTS,
} from "./engine-zhuada";
import { specOf } from "./game-rules";

const emptyTray = (): (number | null)[] => Array<number | null>(TRAY_SLOTS).fill(null);
const emptyShelf = (): (number | null)[] => Array<number | null>(SHELF_SLOTS).fill(null);

describe("applyExtractShelf", () => {
  it("places into the first empty tray slot without matching", () => {
    const res = applyExtractShelf(emptyTray(), emptyShelf(), 4);
    expect(res.placed).toBe(true);
    expect(res.placedIndex).toBe(0);
    expect(res.matched).toBe(false);
    expect(res.tray[0]).toBe(4);
    expect(res.shelf.every((s) => s === null)).toBe(true);
  });

  it("clears an in-tray triple exactly like the classic rule", () => {
    const tray = emptyTray();
    tray[0] = 2;
    tray[3] = 2;
    const res = applyExtractShelf(tray, emptyShelf(), 2);
    expect(res.matched).toBe(true);
    expect(res.clearedTray.sort()).toEqual([0, 1, 3]);
    expect(res.clearedShelf).toEqual([]);
    expect(res.tray.every((s) => s === null)).toBe(true);
  });

  it("clears cross-zone with SHELF copies first (2 shelf + 1 landing)", () => {
    const shelf = emptyShelf();
    shelf[0] = 7;
    shelf[2] = 7;
    const tray = emptyTray();
    tray[0] = 1; // unrelated occupant
    const res = applyExtractShelf(tray, shelf, 7);
    expect(res.matched).toBe(true);
    expect(res.clearedShelf.sort()).toEqual([0, 2]);
    expect(res.clearedTray).toHaveLength(1); // the landing copy
    expect(res.shelf.every((s) => s === null)).toBe(true);
    expect(res.tray.filter((s) => s !== null)).toEqual([1]); // bystander stays
  });

  it("clears cross-zone with 1 shelf + 1 tray + landing copy", () => {
    const shelf = emptyShelf();
    shelf[1] = 5;
    const tray = emptyTray();
    tray[2] = 5;
    const res = applyExtractShelf(tray, shelf, 5);
    expect(res.matched).toBe(true);
    expect(res.clearedShelf).toEqual([1]);
    expect(res.clearedTray.sort()).toEqual([0, 2]); // landing slot 0 + slot 2
    expect(res.shelf[1]).toBe(null);
    expect(res.tray.every((s) => s === null)).toBe(true);
  });

  it("refuses to place when the tray is full (placed=false, no mutation)", () => {
    const tray = [0, 1, 2, 3, 4, 5, 6];
    const res = applyExtractShelf(tray, emptyShelf(), 0);
    expect(res.placed).toBe(false);
    expect(res.placedIndex).toBe(-1);
    expect(res.matched).toBe(false);
    expect(res.tray).toEqual(tray);
  });
});

describe("applyRemoveToShelf", () => {
  it("parks the first 3 occupied tray slots in order", () => {
    const tray = emptyTray();
    tray[1] = 9;
    tray[3] = 4;
    tray[4] = 9;
    tray[6] = 2;
    const res = applyRemoveToShelf(tray, emptyShelf());
    expect(res).not.toBeNull();
    expect(res!.movedFrom).toEqual([1, 3, 4]);
    expect(res!.shelf).toEqual([9, 4, 9]);
    expect(res!.tray[1]).toBe(null);
    expect(res!.tray[3]).toBe(null);
    expect(res!.tray[4]).toBe(null);
    expect(res!.tray[6]).toBe(2); // 4th item stays
  });

  it("is unavailable while the shelf is occupied", () => {
    const tray = [1, 2, 3, null, null, null, null];
    const shelf = emptyShelf();
    shelf[0] = 8;
    expect(applyRemoveToShelf(tray, shelf)).toBeNull();
  });

  it("is unavailable with fewer than 3 tray items", () => {
    const tray = emptyTray();
    tray[0] = 1;
    tray[5] = 2;
    expect(applyRemoveToShelf(tray, emptyShelf())).toBeNull();
  });

  it("can never create a triple (cross-zone counts stay ≤2)", () => {
    // Worst case: two copies of a kind in the first three occupied slots —
    // legal tray state (3rd copy would have cleared) — parks as 2 copies.
    const tray = [6, 6, 3, null, null, null, null];
    const res = applyRemoveToShelf(tray, emptyShelf());
    const counts = new Map<number, number>();
    for (const v of [...res!.tray, ...res!.shelf]) {
      if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const c of counts.values()) expect(c).toBeLessThanOrEqual(2);
  });
});

describe("full-run invariant: empty box ⇒ empty tray AND shelf", () => {
  it("random playthroughs with mid-run removes end clean on every scene band", () => {
    for (const level of [1, 2, 5, 8, 12, 15]) {
      const rng = makeRng(level * 7919 + 13);
      const spec = specOf(level);
      let items = generateItems(spec, rng);
      let tray = emptyTray();
      let shelf = emptyShelf();
      let removes = 1;
      let guard = items.length * 4;
      while (items.length > 0 && guard-- > 0) {
        // Rescue exactly like the engine: park 3 when jammed.
        if (isTrayStuck(tray) && removes > 0 && shelf.every((s) => s === null)) {
          const parked = applyRemoveToShelf(tray, shelf)!;
          tray = parked.tray;
          shelf = parked.shelf;
          removes -= 1;
          continue;
        }
        if (isTrayStuck(tray)) break; // genuine jam — loss path, not this test
        // Greedy-ish pick: prefer a kind already in tray/shelf, else first.
        const zoneKinds = new Set([...tray, ...shelf].filter((v) => v !== null));
        const pick = items.find((it) => zoneKinds.has(it.kind)) ?? items[0]!;
        const res = applyExtractShelf(tray, shelf, pick.kind);
        expect(res.placed).toBe(true);
        tray = res.tray;
        shelf = res.shelf;
        items = items.filter((it) => it.id !== pick.id);
      }
      if (items.length === 0) {
        expect(tray.every((s) => s === null)).toBe(true);
        expect(shelf.every((s) => s === null)).toBe(true);
      }
    }
  });
});
