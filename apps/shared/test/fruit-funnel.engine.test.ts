import { describe, expect, it } from "vitest";

import {
  CHANNEL_CAPACITY,
  FRUIT_COLORS,
  FRUIT_ENGINE_MESSAGE_KEYS,
  FruitFunnelEngine,
  LANE_COUNT,
  PAIRS_PER_COLOR,
  TOKENS_PER_LANE,
  TOTAL_PAIRS,
  TOTAL_TOKENS,
  createFruitDeal,
  findSafeFruitHint,
  isValidFruitSnapshot,
  verifyFruitWitness,
} from "../../fruit-funnel/src/logic/fruit-engine";
import { messages } from "../../fruit-funnel/src/locale/messages";
import { FRUIT_SCENE_COPY_KEYS } from "../../fruit-funnel/src/scene-copy";

function solveSeed(seed: number) {
  const deal = createFruitDeal(seed);
  const engine = FruitFunnelEngine.fresh(seed, 1, 1_000);
  let now = 1_000;
  for (const pair of deal.witness) {
    for (const token of pair) {
      const snapshot = engine.snapshot(now);
      expect(snapshot.lanes[token.lane]?.[0]?.id).toBe(token.id);
      now += 1;
      expect(engine.tapLane(token.lane, now).ok).toBe(true);
    }
  }
  return engine.snapshot(now);
}

describe("fruit-funnel deterministic deal", () => {
  it("creates balanced 48-fruit boards with a constructive witness", () => {
    for (let seed = 1; seed <= 2_000; seed += 1) {
      const deal = createFruitDeal(seed);
      expect(deal.lanes).toHaveLength(LANE_COUNT);
      expect(deal.lanes.every((lane) => lane.length === TOKENS_PER_LANE)).toBe(true);
      expect(new Set(deal.lanes.flat().map((token) => token.id)).size).toBe(TOTAL_TOKENS);
      expect(deal.witness).toHaveLength(TOTAL_PAIRS);
      expect(verifyFruitWitness(deal)).toBe(true);

      const counts = new Map(FRUIT_COLORS.map((color) => [color, 0]));
      for (const token of deal.lanes.flat()) counts.set(token.color, (counts.get(token.color) ?? 0) + 1);
      expect([...counts.values()]).toEqual(FRUIT_COLORS.map(() => PAIRS_PER_COLOR * 2));
    }
  });

  it("replays the witness to an empty winning board", () => {
    for (const seed of [1, 2, 7, 42, 20260710, 0xffffffff]) {
      const result = solveSeed(seed);
      expect(result.phase).toBe("won");
      expect(result.matchedPairs).toBe(TOTAL_PAIRS);
      expect(result.channel).toEqual([]);
      expect(result.lanes.every((lane) => lane.length === 0)).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(isValidFruitSnapshot(result)).toBe(true);
    }
  });

  it("is stable for the same seed and distinct for other seeds", () => {
    expect(createFruitDeal(42)).toEqual(createFruitDeal(42));
    expect(createFruitDeal(42).lanes).not.toEqual(createFruitDeal(43).lanes);
  });
});

describe("fruit-funnel play and recovery", () => {
  it("clears only the last adjacent same-color pair", () => {
    const deal = createFruitDeal(91);
    const engine = FruitFunnelEngine.fresh(91, 1, 1_000);
    const [first, second] = deal.witness[0]!;

    expect(engine.tapLane(first.lane, 1_001).action).toBe("released");
    expect(engine.snapshot(1_001).channel).toHaveLength(1);
    const result = engine.tapLane(second.lane, 1_002);
    expect(result.action).toBe("matched");
    expect(result.cleared?.map((token) => token.color)).toEqual([first.color, first.color]);
    expect(engine.snapshot(1_002).channel).toEqual([]);
  });

  it("loses exactly when the deterministic chute reaches capacity", () => {
    let chosen: FruitFunnelEngine | undefined;
    let now = 10_000;
    for (let seed = 1; seed < 100 && !chosen; seed += 1) {
      const candidate = FruitFunnelEngine.fresh(seed, 1, now);
      for (let move = 0; move < CHANNEL_CAPACITY; move += 1) {
        const snapshot = candidate.snapshot(now);
        const previous = snapshot.channel.at(-1)?.color;
        const lane = snapshot.lanes.findIndex((items) => items[0] && items[0].color !== previous);
        if (lane < 0) break;
        candidate.tapLane(lane, now += 1);
      }
      if (candidate.snapshot(now).phase === "lost") chosen = candidate;
    }
    expect(chosen).toBeTruthy();
    const snapshot = chosen!.snapshot(now);
    expect(snapshot.channel).toHaveLength(CHANNEL_CAPACITY);
    expect(snapshot.phase).toBe("lost");
  });

  it("undo recovers the exact pre-move state, including a full chute loss", () => {
    const engine = FruitFunnelEngine.fresh(77, 1, 5_000);
    const before = engine.snapshot(5_000);
    const lane = before.lanes.findIndex((items) => items.length > 0);
    engine.tapLane(lane, 5_001);
    expect(engine.undo(5_002).ok).toBe(true);
    const restored = engine.snapshot(5_002);
    expect(restored.lanes).toEqual(before.lanes);
    expect(restored.channel).toEqual(before.channel);
    expect(restored.moves).toBe(before.moves);
  });

  it("restores active runs paused without charging background time", () => {
    const engine = FruitFunnelEngine.fresh(123, 1, 10_000);
    const snapshot = engine.snapshot(11_000);
    const restored = FruitFunnelEngine.restore(snapshot, 999_000);
    expect(restored).not.toBeNull();
    const paused = restored!.snapshot(1_999_000);
    expect(paused.phase).toBe("paused");
    expect(paused.remainingMs).toBe(snapshot.remainingMs);
    expect(restored!.togglePause(2_000_000).action).toBe("resume");
  });

  it("returns a playable, concise hint without mutating the run", () => {
    const engine = FruitFunnelEngine.fresh(404, 1, 1_000);
    const before = engine.snapshot(1_000);
    const hint = findSafeFruitHint(before);
    expect(hint.length).toBeGreaterThan(0);
    expect(hint.every((lane) => before.lanes[lane]?.[0])).toBe(true);
    expect(engine.snapshot(1_000)).toEqual(before);
  });

  it("replays certified hints to completion across varied seeds", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const engine = FruitFunnelEngine.fresh(seed, 1, 1_000);
      let now = 1_000;
      for (let move = 0; move < TOTAL_TOKENS; move += 1) {
        const snapshot = engine.snapshot(now);
        if (snapshot.phase === "won") break;
        const hint = findSafeFruitHint(snapshot);
        expect(hint, `seed ${seed} move ${move}`).toHaveLength(1);
        expect(engine.tapLane(hint[0]!, now += 1).ok).toBe(true);
      }
      expect(engine.snapshot(now).phase, `seed ${seed}`).toBe("won");
    }
  });

  it("never labels a guaranteed seven-slot overflow as safe", () => {
    let trapped: ReturnType<FruitFunnelEngine["snapshot"]> | null = null;
    for (let seed = 1; seed <= 500 && !trapped; seed += 1) {
      const engine = FruitFunnelEngine.fresh(seed, 1, 1_000);
      let now = 1_000;
      for (let move = 0; move < CHANNEL_CAPACITY - 1; move += 1) {
        const snapshot = engine.snapshot(now);
        const top = snapshot.channel.at(-1)?.color;
        const lane = snapshot.lanes.findIndex((items) => items[0] && items[0].color !== top);
        if (lane < 0) break;
        engine.tapLane(lane, now += 1);
      }
      const snapshot = engine.snapshot(now);
      const top = snapshot.channel.at(-1)?.color;
      if (snapshot.phase === "playing"
        && snapshot.channel.length === CHANNEL_CAPACITY - 1
        && snapshot.lanes.every((lane) => !lane[0] || lane[0].color !== top)) {
        trapped = snapshot;
      }
    }
    expect(trapped).not.toBeNull();
    expect(findSafeFruitHint(trapped!)).toEqual([]);
  });

  it("undo restores the board without reclaiming elapsed clock time", () => {
    const engine = FruitFunnelEngine.fresh(77, 1, 1_000);
    const initial = engine.snapshot(1_000);
    const lane = initial.lanes.findIndex((items) => items.length > 0);
    engine.tapLane(lane, 1_100);
    const afterMove = engine.snapshot(1_100);
    expect(engine.undo(6_100).ok).toBe(true);
    const restored = engine.snapshot(6_100);
    expect(restored.lanes).toEqual(initial.lanes);
    expect(restored.remainingMs).toBe(afterMove.remainingMs - 5_000);
    expect(restored.remainingMs).toBeLessThan(initial.remainingMs);
  });

  it("rejects duplicate, forged, imbalanced, over-capacity, and inconsistent snapshots", () => {
    const good = FruitFunnelEngine.fresh(55, 1, 1_000).snapshot(1_000);
    expect(isValidFruitSnapshot(good)).toBe(true);

    const duplicate = structuredClone(good);
    duplicate.lanes[1]![0] = { ...duplicate.lanes[0]![0]! };
    expect(isValidFruitSnapshot(duplicate)).toBe(false);

    const forged = structuredClone(good);
    forged.lanes[0]![0]!.color = forged.lanes[0]![0]!.color === "apple" ? "lemon" : "apple";
    expect(isValidFruitSnapshot(forged)).toBe(false);

    const missing = structuredClone(good);
    missing.lanes[0]!.shift();
    expect(isValidFruitSnapshot(missing)).toBe(false);

    const overflow = structuredClone(good);
    overflow.channel = good.lanes.flat().slice(0, CHANNEL_CAPACITY + 1);
    expect(isValidFruitSnapshot(overflow)).toBe(false);

    const fakeWin = structuredClone(good);
    fakeWin.phase = "won";
    expect(isValidFruitSnapshot(fakeWin)).toBe(false);

    const reorderedSuffix = structuredClone(good);
    [reorderedSuffix.lanes[0]![0], reorderedSuffix.lanes[0]![1]] = [
      reorderedSuffix.lanes[0]![1]!,
      reorderedSuffix.lanes[0]![0]!,
    ];
    expect(isValidFruitSnapshot(reorderedSuffix)).toBe(false);

    const wrongMoves = structuredClone(good);
    wrongMoves.moves = 1;
    expect(isValidFruitSnapshot(wrongMoves)).toBe(false);

    const zeroClockPlaying = structuredClone(good);
    zeroClockPlaying.remainingMs = 0;
    expect(isValidFruitSnapshot(zeroClockPlaying)).toBe(false);

    const moved = FruitFunnelEngine.fresh(55, 1, 1_000);
    const firstPair = createFruitDeal(55).witness[0]!;
    moved.tapLane(firstPair[0].lane, 1_001);
    moved.tapLane(firstPair[1].lane, 1_002);
    const autoCleared = moved.snapshot(1_002);
    const impossibleAdjacentPair = structuredClone(autoCleared);
    impossibleAdjacentPair.channel = [firstPair[0], firstPair[1]];
    impossibleAdjacentPair.matchedPairs = 0;
    impossibleAdjacentPair.score = 0;
    impossibleAdjacentPair.streak = 0;
    expect(isValidFruitSnapshot(impossibleAdjacentPair)).toBe(false);

    const impossibleAction = structuredClone(autoCleared);
    impossibleAction.lastAction = {
      nonce: autoCleared.lastAction.nonce,
      kind: "released",
      tokenId: firstPair[1].id,
      lane: firstPair[1].lane,
      color: firstPair[1].color,
    };
    impossibleAction.messageKey = "statusFruitReleased";
    expect(isValidFruitSnapshot(impossibleAction)).toBe(false);

    const pausedHistory = FruitFunnelEngine.fresh(56, 1, 1_000);
    pausedHistory.tapLane(0, 1_001);
    const badHistory = pausedHistory.snapshot(1_001);
    badHistory.history[0]!.phase = "paused";
    expect(isValidFruitSnapshot(badHistory)).toBe(false);
  });

  it("keeps every engine status key present in the typed localized scene copy", () => {
    const messageKeys = new Set(Object.keys(messages));
    const sceneKeys = new Set<string>(FRUIT_SCENE_COPY_KEYS);
    for (const key of FRUIT_ENGINE_MESSAGE_KEYS) {
      expect(messageKeys.has(key), key).toBe(true);
      expect(sceneKeys.has(key), key).toBe(true);
      expect(messages[key].en, key).toBeTruthy();
      expect(messages[key].zh, key).toBeTruthy();
    }
  });

  it("times out through the engine clock without native interval semantics", () => {
    const engine = FruitFunnelEngine.fresh(8, 1, 1_000);
    const before = engine.snapshot(1_000);
    expect(engine.tick(1_000 + before.remainingMs)).toBe(true);
    expect(engine.snapshot(1_000 + before.remainingMs).phase).toBe("timeout");
  });
});
