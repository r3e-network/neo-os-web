/**
 * progress.test.ts — meta-progression regression tests (G4/G5 groundwork).
 *
 * Covers the v1→v2 localStorage migration, per-level best-score accounting,
 * scene-final goose unlocks, all-clear detection, and scene/curve invariants
 * the level-select UI and the 3D theme switcher both rely on.
 */

import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  bestOverall,
  clearedLevels,
  parseProgress,
  progressAfterWin,
  serializeProgress,
} from "./progress";
import { LEVEL_CURVE, TOTAL_LEVELS, specOf } from "./game-rules";
import { SCENES, isSceneFinalLevel, sceneIndexOfLevel, sceneOfLevel } from "./scenes";
import { ITEM_DEFS, generateItems, makeRng } from "./engine-zhuada";

describe("progress schema + migration", () => {
  it("defaults on null / garbage payloads", () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("not json")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('"a string"')).toEqual(EMPTY_PROGRESS);
  });

  it("migrates the legacy v1 {level} shape, keeping the unlocked level", () => {
    const p = parseProgress(JSON.stringify({ level: 7 }));
    expect(p).toEqual({ level: 7, wins: 0, best: {}, geese: [] });
  });

  it("clamps out-of-range levels and drops invalid best/geese entries", () => {
    const p = parseProgress(
      JSON.stringify({
        v: 2,
        level: 99,
        wins: -3,
        best: { 2: 120, 99: 10, x: 5, 3: -1 },
        geese: [0, 0, 5, 9, "junk"],
      }),
    );
    expect(p.level).toBe(TOTAL_LEVELS);
    expect(p.wins).toBe(0);
    expect(p.best).toEqual({ 2: 120 });
    expect(p.geese).toEqual([0, 5]);
  });

  it("round-trips through serializeProgress", () => {
    const p = { level: 5, wins: 9, best: { 1: 40, 4: 210 }, geese: [0, 1] };
    expect(parseProgress(serializeProgress(p))).toEqual(p);
  });
});

describe("progressAfterWin", () => {
  it("unlocks the next level, counts the win, and records the best score", () => {
    const { next, unlockedGoose, allClear } = progressAfterWin(EMPTY_PROGRESS, 1, 84);
    expect(next.level).toBe(2);
    expect(next.wins).toBe(1);
    expect(next.best[1]).toBe(84);
    expect(unlockedGoose).toBe(-1); // L1 is not the garden's final level
    expect(allClear).toBe(false);
  });

  it("keeps the higher best score on replays and never regresses unlocks", () => {
    const first = progressAfterWin(EMPTY_PROGRESS, 1, 120).next;
    const withUnlocks = { ...first, level: 9 };
    const replay = progressAfterWin(withUnlocks, 1, 60);
    expect(replay.next.best[1]).toBe(120);
    expect(replay.next.level).toBe(9);
    expect(replay.next.wins).toBe(2);
  });

  it("unlocks the scene goose exactly once, on the scene's final level", () => {
    const gardenFinal = SCENES[0]!.levels[1];
    const win1 = progressAfterWin(EMPTY_PROGRESS, gardenFinal, 200);
    expect(win1.unlockedGoose).toBe(0);
    expect(win1.next.geese).toEqual([0]);
    const win2 = progressAfterWin(win1.next, gardenFinal, 300);
    expect(win2.unlockedGoose).toBe(-1);
    expect(win2.next.geese).toEqual([0]);
  });

  it("flags all-clear on the last level and completes the collection", () => {
    let p = EMPTY_PROGRESS;
    for (const scene of SCENES) {
      p = progressAfterWin(p, scene.levels[1], 100).next;
    }
    expect(p.geese).toEqual(SCENES.map((s) => s.id));
    const finale = progressAfterWin(p, TOTAL_LEVELS, 500);
    expect(finale.allClear).toBe(true);
  });

  it("derives sidebar stats: cleared levels + best overall", () => {
    let p = progressAfterWin(EMPTY_PROGRESS, 1, 80).next;
    p = progressAfterWin(p, 2, 250).next;
    p = progressAfterWin(p, 1, 90).next;
    expect(clearedLevels(p)).toBe(2);
    expect(bestOverall(p)).toBe(250);
    expect(p.wins).toBe(3);
  });
});

describe("scene catalog invariants (G4/G5)", () => {
  it("covers all levels 1..TOTAL_LEVELS in 6 contiguous scenes of 2-3 levels", () => {
    expect(SCENES).toHaveLength(6);
    let cursor = 1;
    for (const s of SCENES) {
      expect(s.levels[0]).toBe(cursor);
      const size = s.levels[1] - s.levels[0] + 1;
      expect(size).toBeGreaterThanOrEqual(2);
      expect(size).toBeLessThanOrEqual(3);
      cursor = s.levels[1] + 1;
    }
    expect(cursor - 1).toBe(TOTAL_LEVELS);
  });

  it("maps every level to its scene and marks scene finals", () => {
    expect(sceneIndexOfLevel(1)).toBe(0);
    expect(sceneIndexOfLevel(TOTAL_LEVELS)).toBe(SCENES.length - 1);
    for (const s of SCENES) {
      expect(isSceneFinalLevel(s.levels[1])).toBe(true);
      expect(isSceneFinalLevel(s.levels[0])).toBe(s.levels[0] === s.levels[1]);
    }
  });

  it("every scene kind pool is a permutation of the 12 item ids", () => {
    for (const s of SCENES) {
      expect([...s.kindPool].sort((a, b) => a - b)).toEqual(ITEM_DEFS.map((d) => d.id));
    }
  });

  it("L1 keeps the tutorial win floor (3 kinds cannot jam a 7-slot tray)", () => {
    expect(LEVEL_CURVE[0]!.kinds).toBe(3);
    // pigeonhole: 3 kinds × ≤2 copies buffered = 6 < 7 slots → a triple always
    // completes before the tray fills. L2 must then spike noticeably.
    expect(LEVEL_CURVE[1]!.kinds).toBeGreaterThanOrEqual(5);
    expect(LEVEL_CURVE[1]!.kinds * LEVEL_CURVE[1]!.perKind * 3).toBeGreaterThanOrEqual(
      2 * LEVEL_CURVE[0]!.kinds * LEVEL_CURVE[0]!.perKind * 3,
    );
  });

  it("specOf slices the scene pool and generateItems draws from it (multiple of 3 each)", () => {
    for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl += 1) {
      const spec = specOf(lvl);
      const scene = sceneOfLevel(lvl);
      expect(spec.kindPool).toEqual(scene.kindPool.slice(0, spec.kinds));
      const items = generateItems(spec, makeRng(42 + lvl));
      expect(items).toHaveLength(spec.kinds * spec.perKind * 3);
      const counts = new Map<number, number>();
      for (const it of items) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
      expect([...counts.keys()].sort((a, b) => a - b)).toEqual(
        [...spec.kindPool!].sort((a, b) => a - b),
      );
      for (const c of counts.values()) expect(c % 3).toBe(0);
    }
  });
});
