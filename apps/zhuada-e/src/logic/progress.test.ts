/** Meta-progression, migration, and scene-catalog regression tests. */

import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  PROGRESS_SCHEMA_VERSION,
  bestOverall,
  clearedLevels,
  createEmptyProgress,
  parseProgress,
  parseProgressResult,
  progressAfterAttempt,
  progressAfterFailure,
  progressAfterWin,
  progressWithLastPlayedLevel,
  progressWithLastTheme,
  serializeProgress,
} from "./progress";
import {
  LEVEL_CURVE,
  TOTAL_LEVELS,
  isBalancedDealComposition,
  randomizedSpecOf,
  specOf,
  summarizeDealComposition,
} from "./game-rules";
import {
  SCENES,
  SCENE_KIND_POOL_SIZE,
  isSceneFinalLevel,
  sceneIndexOfLevel,
  sceneOfLevel,
} from "./scenes";
import { ITEM_DEFS, TRAY_SLOTS, generateItems, makeRng } from "./engine-zhuada";
import { DEFAULT_THEME_ID, GAME_THEMES } from "./themes";

describe("progress schema + migration", () => {
  it("defaults on null / garbage payloads", () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("not json")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('"a string"')).toEqual(EMPTY_PROGRESS);
    expect(parseProgressResult("{}").status).toBe("invalid");
  });

  it("explicitly migrates legacy v1 while keeping its unlocked/continue level", () => {
    const result = parseProgressResult(JSON.stringify({ level: 7 }));
    expect(result.status).toBe("migrated");
    expect(result.sourceVersion).toBe(1);
    expect(result.progress).toMatchObject({
      v: PROGRESS_SCHEMA_VERSION,
      level: 7,
      highestUnlockedLevel: 7,
      lastPlayedLevel: 7,
      lastTheme: DEFAULT_THEME_ID,
      wins: 0,
      levels: {},
      best: {},
      geese: [],
    });
  });

  it("migrates v2 without guessing whether its mixed best was relaxed or timed", () => {
    const result = parseProgressResult(
      JSON.stringify({
        v: 2,
        level: 5,
        wins: 9,
        best: { 1: 40, 4: 210 },
        geese: [0, 1],
      }),
    );
    const p = result.progress;
    expect(result.status).toBe("migrated");
    expect(result.sourceVersion).toBe(2);
    expect(p.levels[1]).toEqual({
      attempts: 1,
      failures: 0,
      clears: 1,
      best: {},
      legacyBest: 40,
    });
    expect(p.levels[4]?.legacyBest).toBe(210);
    expect(p.wins).toBe(9);
    expect(p.best).toEqual({ 1: 40, 4: 210 });
    expect(p.geese).toEqual([0, 1]);
  });

  it("clamps v2 values and drops invalid best/geese entries", () => {
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
    // The valid legacy best proves at least one clear, repairing bad v2 wins.
    expect(p.wins).toBe(1);
    expect(p.best).toEqual({ 2: 120 });
    expect(p.geese).toEqual([0, 5]);
  });

  it("round-trips canonical v3 progress and compatibility aliases", () => {
    let p = progressAfterAttempt(createEmptyProgress(), 1, "farm-kitchen");
    p = progressAfterWin(p, 1, 120, "relaxed").next;
    p = progressAfterAttempt(p, 1, "night-market");
    p = progressAfterWin(p, 1, 180, "timed").next;
    expect(parseProgress(serializeProgress(p))).toEqual(p);
    expect(JSON.parse(serializeProgress(p))).toMatchObject({
      v: 3,
      level: 2,
      highestUnlockedLevel: 2,
      lastPlayedLevel: 1,
      lastTheme: "night-market",
      wins: 2,
      best: { 1: 180 },
    });
  });

  it("normalizes unknown future data for display but makes it unserializable", () => {
    const result = parseProgressResult(
      JSON.stringify({
        v: 8,
        highestUnlockedLevel: 6,
        lastPlayedLevel: 4,
        lastTheme: "night-market",
        wins: 12,
        levels: {
          4: { attempts: 3, failures: 1, clears: 2, best: { timed: 500 } },
        },
        geese: [0],
      }),
    );
    expect(result.status).toBe("future-version");
    expect(result.readOnly).toBe(true);
    expect(result.progress).toMatchObject({
      level: 6,
      lastPlayedLevel: 4,
      lastTheme: "night-market",
      readOnly: true,
      sourceVersion: 8,
    });
    expect(() => serializeProgress(result.progress)).toThrow();
    expect(progressAfterWin(result.progress, 4, 700, "timed").next.readOnly).toBe(
      true,
    );
  });
});

describe("pure progress transitions", () => {
  it("records attempts, failures, continue level, and selected theme", () => {
    const attempted = progressAfterAttempt(
      createEmptyProgress(),
      1,
      "farm-kitchen",
    );
    expect(attempted.levels[1]).toMatchObject({ attempts: 1, failures: 0, clears: 0 });
    expect(attempted.lastPlayedLevel).toBe(1);
    expect(attempted.lastTheme).toBe("farm-kitchen");

    const failed = progressAfterFailure(attempted, 1, "night-market");
    expect(failed.levels[1]).toMatchObject({ attempts: 1, failures: 1, clears: 0 });
    expect(failed.lastTheme).toBe("night-market");

    // A missing start hook is repaired rather than producing failures > attempts.
    const repaired = progressAfterFailure(createEmptyProgress(), 1);
    expect(repaired.levels[1]).toMatchObject({ attempts: 1, failures: 1 });
  });

  it("unlocks the next level, counts the win, and records the best score", () => {
    const { next, unlockedGoose, allClear } = progressAfterWin(EMPTY_PROGRESS, 1, 84);
    expect(next.level).toBe(2);
    expect(next.wins).toBe(1);
    expect(next.best[1]).toBe(84);
    expect(next.levels[1]).toMatchObject({
      attempts: 1,
      failures: 0,
      clears: 1,
      best: { relaxed: 84 },
    });
    expect(unlockedGoose).toBe(-1); // L1 is not the garden's final level
    expect(allClear).toBe(false);
  });

  it("separates mode bests, keeps higher scores, and never regresses unlocks", () => {
    const first = progressAfterWin(EMPTY_PROGRESS, 1, 120).next;
    const withUnlocks = { ...first, level: 9, highestUnlockedLevel: 9 };
    const relaxedReplay = progressAfterWin(withUnlocks, 1, 60, "relaxed").next;
    const timedReplay = progressAfterWin(relaxedReplay, 1, 95, "timed").next;
    expect(timedReplay.levels[1]?.best).toEqual({ relaxed: 120, timed: 95 });
    expect(timedReplay.best[1]).toBe(120);
    expect(timedReplay.level).toBe(9);
    expect(timedReplay.wins).toBe(3);
  });

  it("clamps continue targets to unlocked levels and stores theme independently", () => {
    let p = progressWithLastPlayedLevel(createEmptyProgress(), TOTAL_LEVELS);
    expect(p.lastPlayedLevel).toBe(1);
    p = progressAfterWin(p, 1, 50).next;
    p = progressWithLastPlayedLevel(p, 2);
    p = progressWithLastTheme(p, "night-market");
    expect(p.lastPlayedLevel).toBe(2);
    expect(p.lastTheme).toBe("night-market");
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
  it("covers all levels 1..TOTAL_LEVELS in 9 contiguous scenes of 2-3 levels", () => {
    expect(SCENES).toHaveLength(9);
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

  it("gives all nine scenes distinct 48-kind series spanning the 54-item catalog", () => {
    const validIds = new Set(ITEM_DEFS.map((def) => def.id));
    const signatures = new Set<string>();
    const catalog = new Set<number>();
    for (const s of SCENES) {
      expect(s.kindPool).toHaveLength(SCENE_KIND_POOL_SIZE);
      expect(new Set(s.kindPool).size).toBe(SCENE_KIND_POOL_SIZE);
      s.kindPool.forEach((kind) => {
        expect(validIds.has(kind), `${s.nameKey}/${kind}`).toBe(true);
        catalog.add(kind);
      });
      signatures.add([...s.kindPool].sort((a, b) => a - b).join(","));
    }
    expect(signatures.size).toBe(SCENES.length);
    expect([...catalog].sort((a, b) => a - b)).toEqual(ITEM_DEFS.map((def) => def.id));
  });

  it("keeps L1 unjammable, then makes L2 an intentional difficulty cliff", () => {
    const l1 = LEVEL_CURVE[0]!;
    const l2 = LEVEL_CURVE[1]!;
    const l1Items = l1.kinds * l1.perKind * 3;
    const l2Items = l2.kinds * l2.perKind * 3;

    expect(l1.kinds).toBe(3);
    expect(l1Items).toBe(18);
    // With at most two unmatched copies of each L1 kind, the seven-slot tray
    // cannot jam: 3 kinds × 2 buffered copies = 6 occupied slots.
    expect(l1.kinds * 2).toBeLessThan(TRAY_SLOTS);

    expect(l2.kinds).toBeGreaterThanOrEqual(l1.kinds * 3);
    expect(l2.kinds).toBe(48);
    expect(l2Items).toBe(864);
    expect(l2Items).toBeGreaterThanOrEqual(l1Items * 40);
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

  it("randomizes the runtime kind subset per seed while staying reproducible and valid", () => {
    const first = randomizedSpecOf(3, makeRng(101));
    const replay = randomizedSpecOf(3, makeRng(101));
    const another = randomizedSpecOf(3, makeRng(202));
    const sceneKinds = new Set(sceneOfLevel(3).kindPool);

    expect(first.kindPool).toEqual(replay.kindPool);
    expect(first.kindPool).not.toEqual(another.kindPool);
    expect(first.kindPool).toHaveLength(first.kinds);
    expect(new Set(first.kindPool).size).toBe(first.kinds);
    expect(first.kindPool!.every((kind) => sceneKinds.has(kind))).toBe(true);
  });

  it("guarantees rich big/small, silhouette and near-colour composition for every theme", () => {
    for (const theme of GAME_THEMES) {
      for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
        const sceneKinds = new Set(sceneOfLevel(level).kindPool);
        for (let seed = 1; seed <= 6; seed += 1) {
          const spec = randomizedSpecOf(level, makeRng(level * 1000 + seed), theme.id);
          expect(
            isBalancedDealComposition(theme.id, spec.kindPool ?? []),
            `${theme.id}/L${level}/seed${seed} ${JSON.stringify(summarizeDealComposition(theme.id, spec.kindPool ?? []))}`,
          ).toBe(true);
          expect(spec.kindPool?.every((kind) => sceneKinds.has(kind))).toBe(true);
        }
      }
    }
  });

  it("keeps the tutorial subset and every full challenge order varied across replays", () => {
    for (const theme of GAME_THEMES) {
      for (const level of [1, 2, 5, 12, 24]) {
        const orders = new Set<string>();
        const subsets = new Set<string>();
        for (let seed = 1; seed <= 24; seed += 1) {
          const spec = randomizedSpecOf(level, makeRng(level * 10000 + seed), theme.id);
          orders.add((spec.kindPool ?? []).join(","));
          subsets.add([...(spec.kindPool ?? [])].sort((a, b) => a - b).join(","));
        }
        expect(orders.size, `${theme.id}/L${level} unique orders`).toBeGreaterThanOrEqual(3);
        if (level === 1) {
          expect(subsets.size, `${theme.id}/L${level} unique subsets`).toBeGreaterThanOrEqual(3);
        } else {
          expect(subsets.size, `${theme.id}/L${level} authored full subset`).toBe(1);
        }
      }
    }
  });
});
