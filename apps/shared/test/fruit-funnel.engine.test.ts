import { describe, expect, it } from "vitest";

import {
  MAX_DROPPABLE_LEVEL,
  MAX_LEVEL,
  SCORE_PER_MERGE,
  SNAPSHOT_VERSION,
  SUIKA_ENGINE_MESSAGE_KEYS,
  SuikaEngine,
  WATERMELON_BONUS,
  isValidSuikaSnapshot,
} from "../../fruit-funnel/src/logic/suika-engine";
import type { SuikaSnapshot } from "../../fruit-funnel/src/logic/suika-engine";
import { messages } from "../../fruit-funnel/src/locale/messages";
import { createSuikaSceneCopy } from "../../fruit-funnel/src/suika-copy";

// The retired match-2 build shipped a deterministic 48-fruit deal with a
// constructive win witness. The rebuilt game is an emergent real-physics
// merge game whose truth model is the SuikaEngine: a fruit board (id + level +
// position), a drop queue, score, best, and phase. These tests pin that model.

describe("fruit-funnel Suika engine — fresh state", () => {
  it("starts a valid, playing, empty board with a droppable queue", () => {
    const engine = SuikaEngine.fresh(42, 7, 1_000);
    const snapshot = engine.snapshot(1_000);

    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.phase).toBe("playing");
    expect(snapshot.board).toEqual([]);
    expect(snapshot.score).toBe(0);
    expect(snapshot.best).toBe(7);
    expect(snapshot.messageKey).toBe("statusReady");
    expect(snapshot.currentLevel).toBeGreaterThanOrEqual(0);
    expect(snapshot.currentLevel).toBeLessThanOrEqual(MAX_DROPPABLE_LEVEL);
    expect(snapshot.nextLevel).toBeGreaterThanOrEqual(0);
    expect(snapshot.nextLevel).toBeLessThanOrEqual(MAX_DROPPABLE_LEVEL);
    expect(isValidSuikaSnapshot(snapshot)).toBe(true);
  });

  it("returns defensive snapshot copies so callers cannot mutate engine state", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const level = engine.snapshot().currentLevel;
    engine.dropFruit(level, 100, 100, 1_000);
    const first = engine.snapshot(1_000);
    first.board[0]!.x = -999;
    expect(engine.snapshot(1_000).board[0]!.x).toBe(100);
  });
});

describe("fruit-funnel Suika engine — drop", () => {
  it("drops the current fruit, advances the queue, and records the action", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const before = engine.snapshot(1_000);
    const expectedNext = before.nextLevel;

    const { snapshot, fruitId } = engine.dropFruit(before.currentLevel, 120, 90, 1_001);
    expect(fruitId).not.toBe("");
    expect(snapshot.board).toHaveLength(1);
    expect(snapshot.board[0]).toMatchObject({ id: fruitId, level: before.currentLevel, x: 120, y: 90 });
    expect(snapshot.currentLevel).toBe(expectedNext);
    expect(snapshot.lastAction.kind).toBe("dropped");
    expect(snapshot.messageKey).toBe("statusDropped");
    expect(isValidSuikaSnapshot(snapshot)).toBe(true);
  });

  it("ignores a drop whose level is not the queued current fruit", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const current = engine.snapshot().currentLevel;
    const wrong = current === 0 ? 1 : 0;
    const { fruitId, snapshot } = engine.dropFruit(wrong, 100, 100, 1_001);
    expect(fruitId).toBe("");
    expect(snapshot.board).toHaveLength(0);
  });

  it("ignores drops above the droppable ceiling", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const { fruitId } = engine.dropFruit(MAX_DROPPABLE_LEVEL + 1, 100, 100, 1_001);
    expect(fruitId).toBe("");
    expect(engine.snapshot().board).toHaveLength(0);
  });
});

describe("fruit-funnel Suika engine — merge and scoring", () => {
  it("merges two fruit into the next tier and awards the triangular score", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const a = engine.dropFruit(engine.snapshot().currentLevel, 60, 80, 1_001).fruitId;
    const b = engine.dropFruit(engine.snapshot().currentLevel, 64, 80, 1_002).fruitId;

    const { snapshot, newFruitId } = engine.mergeFruits(a, b, 3, 62, 82, 1_003);
    expect(newFruitId).not.toBeNull();
    expect(snapshot.board).toHaveLength(1);
    expect(snapshot.board[0]).toMatchObject({ id: newFruitId!, level: 3, x: 62, y: 82 });
    expect(snapshot.score).toBe(SCORE_PER_MERGE[3]);
    expect(snapshot.best).toBe(SCORE_PER_MERGE[3]);
    expect(snapshot.lastAction.kind).toBe("merged");
    expect(snapshot.messageKey).toBe("statusMerged");
  });

  it("clears two watermelons for a bonus and creates no new fruit", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const a = engine.dropFruit(engine.snapshot().currentLevel, 60, 80, 1_001).fruitId;
    const b = engine.dropFruit(engine.snapshot().currentLevel, 64, 80, 1_002).fruitId;

    const { snapshot, newFruitId } = engine.mergeFruits(a, b, MAX_LEVEL + 1, 62, 82, 1_003);
    expect(newFruitId).toBeNull();
    expect(snapshot.board).toHaveLength(0);
    expect(snapshot.score).toBe(WATERMELON_BONUS);
  });

  it("ignores a merge referencing an unknown or duplicated id", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const a = engine.dropFruit(engine.snapshot().currentLevel, 60, 80, 1_001).fruitId;
    expect(engine.mergeFruits(a, "ghost", 2, 60, 80, 1_002).newFruitId).toBeNull();
    expect(engine.mergeFruits(a, a, 2, 60, 80, 1_003).newFruitId).toBeNull();
    expect(engine.snapshot().board).toHaveLength(1);
    expect(engine.snapshot().score).toBe(0);
  });
});

describe("fruit-funnel Suika engine — pause, game over, sync", () => {
  it("toggles pause and resume with matching status keys", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    expect(engine.togglePause(1_001).phase).toBe("paused");
    expect(engine.snapshot().messageKey).toBe("statusPaused");
    expect(engine.togglePause(1_002).phase).toBe("playing");
    expect(engine.snapshot().messageKey).toBe("statusResumed");
  });

  it("ends the run, freezes further transitions, and keeps the best score", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const a = engine.dropFruit(engine.snapshot().currentLevel, 60, 80, 1_001).fruitId;
    const b = engine.dropFruit(engine.snapshot().currentLevel, 64, 80, 1_002).fruitId;
    engine.mergeFruits(a, b, 4, 62, 82, 1_003);
    const scored = engine.snapshot().score;

    const over = engine.setGameOver(1_004);
    expect(over.phase).toBe("gameover");
    expect(over.messageKey).toBe("statusGameOver");
    expect(over.best).toBe(scored);

    // No transition is allowed after game over.
    expect(engine.dropFruit(engine.snapshot().currentLevel, 10, 10, 1_005).fruitId).toBe("");
    expect(engine.togglePause(1_006).phase).toBe("gameover");
  });

  it("syncs physics positions into the board only while playing", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const id = engine.dropFruit(engine.snapshot().currentLevel, 60, 80, 1_001).fruitId;
    engine.syncBoard([{ id, x: 200, y: 500 }], 1_002);
    expect(engine.snapshot().board[0]).toMatchObject({ x: 200, y: 500 });

    engine.togglePause(1_003);
    engine.syncBoard([{ id, x: 10, y: 10 }], 1_004);
    expect(engine.snapshot().board[0]).toMatchObject({ x: 200, y: 500 });
  });
});

describe("fruit-funnel Suika engine — restore and validation", () => {
  it("restores an active run paused and lifts the best from the stored run", () => {
    const engine = SuikaEngine.fresh(42, 3, 1_000);
    const a = engine.dropFruit(engine.snapshot().currentLevel, 60, 80, 1_001).fruitId;
    const b = engine.dropFruit(engine.snapshot().currentLevel, 64, 80, 1_002).fruitId;
    const saved = engine.mergeFruits(a, b, 5, 62, 82, 1_003).snapshot;

    const restored = SuikaEngine.restore(saved, 0, 5_000);
    expect(restored).not.toBeNull();
    const resumed = restored!.snapshot(5_000);
    expect(resumed.phase).toBe("paused");
    expect(resumed.best).toBeGreaterThanOrEqual(saved.score);
    expect(resumed.board).toHaveLength(1);
  });

  it("keeps a stored game over as game over on restore", () => {
    const engine = SuikaEngine.fresh(42, 0, 1_000);
    const saved = engine.setGameOver(1_001);
    const restored = SuikaEngine.restore(saved, 0, 5_000);
    expect(restored!.snapshot(5_000).phase).toBe("gameover");
    expect(restored!.snapshot(5_000).messageKey).toBe("statusGameOver");
  });

  it("rejects malformed snapshots", () => {
    const good = SuikaEngine.fresh(42, 0, 1_000).snapshot(1_000);
    expect(isValidSuikaSnapshot(good)).toBe(true);
    expect(SuikaEngine.restore({ version: 1 }, 0, 1_000)).toBeNull();

    const badVersion = structuredClone(good) as SuikaSnapshot;
    (badVersion as { version: number }).version = 99;
    expect(isValidSuikaSnapshot(badVersion)).toBe(false);

    const badSeed = structuredClone(good) as SuikaSnapshot;
    (badSeed as { seed: number }).seed = 0;
    expect(isValidSuikaSnapshot(badSeed)).toBe(false);

    const badLevel = structuredClone(good) as SuikaSnapshot;
    badLevel.board = [{ id: "x", level: MAX_LEVEL + 5, x: 1, y: 1 }];
    expect(isValidSuikaSnapshot(badLevel)).toBe(false);

    const badPosition = structuredClone(good) as SuikaSnapshot;
    badPosition.board = [{ id: "x", level: 0, x: Number.NaN, y: 1 }];
    expect(isValidSuikaSnapshot(badPosition)).toBe(false);

    const negativeScore = structuredClone(good) as SuikaSnapshot;
    negativeScore.score = -1;
    expect(isValidSuikaSnapshot(negativeScore)).toBe(false);

    const badPhase = structuredClone(good) as SuikaSnapshot;
    (badPhase as { phase: string }).phase = "won";
    expect(isValidSuikaSnapshot(badPhase)).toBe(false);

    const badDroppable = structuredClone(good) as SuikaSnapshot;
    badDroppable.currentLevel = MAX_DROPPABLE_LEVEL + 3;
    expect(isValidSuikaSnapshot(badDroppable)).toBe(false);
  });
});

describe("fruit-funnel Suika engine — localized status coverage", () => {
  it("keeps every engine status key present in messages and the scene copy bag", () => {
    const messageKeys = new Set(Object.keys(messages));
    const sceneKeys = new Set(Object.keys(createSuikaSceneCopy((key) => key)));
    for (const key of SUIKA_ENGINE_MESSAGE_KEYS) {
      expect(messageKeys.has(key), key).toBe(true);
      expect(sceneKeys.has(key), key).toBe(true);
      expect(messages[key as keyof typeof messages].en, key).toBeTruthy();
      expect(messages[key as keyof typeof messages].zh, key).toBeTruthy();
    }
  });
});
