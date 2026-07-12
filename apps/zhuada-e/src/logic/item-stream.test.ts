import { describe, expect, it } from "vitest";

import { generateItems, makeRng, type LevelSpec } from "./engine-zhuada";
import {
  STREAM_INITIAL_VISIBLE,
  STREAM_REFILL_BATCH,
  STREAM_REFILL_TRIGGER,
  STREAM_VISIBLE_CEILING,
  createItemStream,
  refillItemStream,
} from "./item-stream";

const LONG_LEVEL: LevelSpec = {
  level: 3,
  kinds: 10,
  perKind: 7,
  timeMs: 330_000,
  boxSize: 10,
  kindPool: Array.from({ length: 10 }, (_, index) => index),
};

describe("item reservoir stream", () => {
  it("keeps hundreds of logical items while exposing only the mobile physics budget", () => {
    const all = generateItems(LONG_LEVEL, makeRng(7));
    const stream = createItemStream(all, makeRng(8));
    expect(all).toHaveLength(210);
    expect(stream.active).toHaveLength(STREAM_INITIAL_VISIBLE);
    expect(stream.reserve).toHaveLength(210 - STREAM_INITIAL_VISIBLE);
    expect(stream.active.every((item) => item.spawnMode === "drop")).toBe(true);
    expect(new Set(stream.active.map((item) => item.kind)).size).toBe(LONG_LEVEL.kinds);
    const openingCounts = new Map<number, number>();
    for (const item of stream.active) openingCounts.set(item.kind, (openingCounts.get(item.kind) ?? 0) + 1);
    expect(Math.max(...openingCounts.values())).toBeLessThanOrEqual(6);
  });

  it("keeps complete triple counts inside the initial pile and every refill wave", () => {
    const all = generateItems(LONG_LEVEL, makeRng(11));
    const stream = createItemStream(all, makeRng(12));
    const waves = [stream.active];
    for (let index = 0; index < stream.reserve.length; index += STREAM_REFILL_BATCH) {
      waves.push(stream.reserve.slice(index, index + STREAM_REFILL_BATCH));
    }
    for (const wave of waves) {
      const counts = new Map<number, number>();
      for (const item of wave) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
      for (const count of counts.values()) {
        expect(count % 3).toBe(0);
      }
    }
  });

  it("waits for excavation, then activates one capped bottom-up batch", () => {
    const all = generateItems(LONG_LEVEL, makeRng(21));
    const stream = createItemStream(all, makeRng(22));
    const aboveTrigger = stream.active.slice(0, STREAM_REFILL_TRIGGER + 1);
    const idle = refillItemStream(aboveTrigger, stream.reserve, makeRng(23), LONG_LEVEL.boxSize);
    expect(idle.activated).toHaveLength(0);

    const excavated = stream.active.slice(0, STREAM_REFILL_TRIGGER);
    const refilled = refillItemStream(excavated, stream.reserve, makeRng(24), LONG_LEVEL.boxSize);
    expect(refilled.activated).toHaveLength(STREAM_REFILL_BATCH);
    expect(refilled.active.length).toBeLessThanOrEqual(STREAM_VISIBLE_CEILING);
    expect(refilled.reserve).toHaveLength(stream.reserve.length - STREAM_REFILL_BATCH);
    expect(refilled.activated.every((item) => item.spawnMode === "reservoir")).toBe(true);
    expect(refilled.activated.every((item) => item.py >= 0.58 && item.py <= 0.8)).toBe(true);
  });

  it("drains a short final reserve without exceeding the ceiling", () => {
    const all = generateItems(LONG_LEVEL, makeRng(31));
    const stream = createItemStream(all, makeRng(32));
    const finalReserve = stream.reserve.slice(0, 3);
    const refilled = refillItemStream(
      stream.active.slice(0, STREAM_REFILL_TRIGGER),
      finalReserve,
      makeRng(33),
      LONG_LEVEL.boxSize,
    );
    expect(refilled.activated).toHaveLength(3);
    expect(refilled.reserve).toHaveLength(0);
  });
});
