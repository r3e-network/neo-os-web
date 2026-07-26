import { describe, expect, it } from "vitest";

import { generateItems, makeRng, type LevelSpec } from "./engine-zhuada";
import { randomizedSpecOf } from "./game-rules";
import {
  STREAM_INITIAL_VISIBLE,
  STREAM_REFILL_BATCH,
  STREAM_REFILL_TRIGGER,
  STREAM_VISIBLE_CEILING,
  createItemStream,
  refillItemStream,
} from "./item-stream";
import { GAME_THEMES, themeItem, themeOf } from "./themes";

const LONG_LEVEL: LevelSpec = {
  level: 3,
  kinds: 10,
  perKind: 7,
  timeMs: 330_000,
  boxSize: 10,
  kindPool: Array.from({ length: 10 }, (_, index) => index),
};
const TEST_CATALOG = themeOf("fresh-market").items;

function openingColorBucket(color: number): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.16) return 8;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  return Math.floor(hue / 45) % 8;
}

describe("item reservoir stream", () => {
  it("keeps hundreds of logical items while exposing only the mobile physics budget", () => {
    const all = generateItems(LONG_LEVEL, makeRng(7));
    const stream = createItemStream(all, makeRng(8), TEST_CATALOG);
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
    const stream = createItemStream(all, makeRng(12), TEST_CATALOG);
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

  it("opens L2 with eighteen identities, six paired near-match families, and 30 later kinds", () => {
    const dealRng = makeRng(13);
    const all = generateItems(randomizedSpecOf(2, dealRng), dealRng);
    const stream = createItemStream(all, makeRng(14), TEST_CATALOG);
    const counts = new Map<number, number>();
    for (const item of stream.active) {
      counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }

    expect(stream.active).toHaveLength(STREAM_VISIBLE_CEILING);
    expect(all).toHaveLength(864);
    expect(counts.size).toBe(18);
    expect([...counts.values()].every((count) => count === 3)).toBe(true);
    expect(stream.reserve).toHaveLength(810);
    const activeKinds = new Set(stream.active.map((item) => item.kind));
    const reserveOnlyKinds = new Set(
      stream.reserve.filter((item) => !activeKinds.has(item.kind)).map((item) => item.kind),
    );
    expect(reserveOnlyKinds.size).toBe(30);
  });

  it.each(GAME_THEMES)(
    "opens $id with eighteen identities, fourteen small, two medium and two large bodies",
    (theme) => {
      const dealRng = makeRng(71);
      const spec = randomizedSpecOf(2, dealRng, theme.id);
      const all = generateItems(spec, dealRng);
      const stream = createItemStream(all, makeRng(72), theme.items);
      const counts = new Map<number, number>();
      for (const item of stream.active) {
        counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
      }
      const visible = [...counts].map(([kind, count]) => ({
        item: themeItem(theme.id, kind),
        count,
      }));
      expect(visible).toHaveLength(18);
      expect(visible.every(({ count }) => count === 3)).toBe(true);
      expect(visible.filter(({ item }) => item.sizeBand === "small")).toHaveLength(14);
      expect(visible.filter(({ item }) => item.sizeBand === "medium")).toHaveLength(2);
      expect(visible.filter(({ item }) => item.sizeBand === "large")).toHaveLength(2);
      const exactFamilies = new Map<number, number>();
      for (const [kind] of counts) {
        const item = themeItem(theme.id, kind);
        const family = item.modelKind ?? kind;
        exactFamilies.set(family, (exactFamilies.get(family) ?? 0) + 1);
      }
      expect(exactFamilies.size).toBe(12);
      expect([...exactFamilies.values()].filter((count) => count === 2)).toHaveLength(6);
      expect([...exactFamilies.values()].filter((count) => count === 1)).toHaveLength(6);
      expect(Math.max(...exactFamilies.values())).toBe(2);
      expect(new Set(visible.map(({ item }) => item.silhouette)).size).toBeGreaterThanOrEqual(6);
      expect(new Set(visible.map(({ item }) => item.lookalikeFamily)).size).toBeGreaterThanOrEqual(6);
    },
  );

  it("reshuffles the eighteen opening identities and their treatments across fresh runs", () => {
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const dealRng = makeRng(seed * 101);
      const all = generateItems(randomizedSpecOf(2, dealRng), dealRng);
      const stream = createItemStream(all, makeRng(seed * 103), TEST_CATALOG);
      const kinds = [...new Set(stream.active.map((item) => item.kind))]
        .sort((a, b) => a - b);
      const modelKinds = [...new Set(
        kinds.map((kind) => themeItem("fresh-market", kind).modelKind ?? kind),
      )].sort((a, b) => a - b);

      expect(kinds).toHaveLength(18);
      expect(modelKinds).toHaveLength(12);
      signatures.add(`${kinds.join(",")}|${modelKinds.join(",")}`);
    }
    expect(signatures.size).toBeGreaterThanOrEqual(8);
  });

  it.each(GAME_THEMES)(
    "keeps every randomized $id opening spread across broad colour families",
    (theme) => {
      for (let seed = 1; seed <= 48; seed += 1) {
        const dealRng = makeRng(seed * 211);
        const spec = randomizedSpecOf(2, dealRng, theme.id);
        const all = generateItems(spec, dealRng);
        const stream = createItemStream(all, makeRng(seed * 223), theme.items);
        const kinds = [...new Set(stream.active.map((item) => item.kind))];
        const counts = new Map<number, number>();
        for (const kind of kinds) {
          const bucket = openingColorBucket(themeItem(theme.id, kind).color);
          counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
        }
        expect(
          counts.size,
          `${theme.id} seed ${seed} should cover the colour wheel`,
        ).toBeGreaterThanOrEqual(7);
        expect(
          Math.max(...counts.values()),
          `${theme.id} seed ${seed} should not collapse into one colour family`,
        ).toBeLessThanOrEqual(4);
      }
    },
  );

  it("separates identical opening triples across the pile instead of spawning free clumps", () => {
    const dealRng = makeRng(701);
    const all = generateItems(randomizedSpecOf(2, dealRng), dealRng);
    const stream = createItemStream(all, makeRng(702), TEST_CATALOG);
    const byKind = new Map<number, typeof stream.active>();
    for (const item of stream.active) {
      const group = byKind.get(item.kind) ?? [];
      group.push(item);
      byKind.set(item.kind, group);
    }
    for (const [kind, packet] of byKind) {
      expect(packet, `kind ${kind} opening packet`).toHaveLength(3);
      const distances = packet.flatMap((left, index) => (
        packet.slice(index + 1).map((right) => Math.hypot(
          left.px - right.px,
          left.pz - right.pz,
        ))
      ));
      expect(
        Math.min(...distances),
        `kind ${kind} copies should begin in separate pile sectors`,
      ).toBeGreaterThan(1.5);
    }
  });

  it("waits for a visible deep excavation, then activates one substantial bottom-up layer", () => {
    const all = generateItems(LONG_LEVEL, makeRng(21));
    const stream = createItemStream(all, makeRng(22), TEST_CATALOG);
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
    expect(STREAM_INITIAL_VISIBLE - STREAM_REFILL_TRIGGER).toBe(36);
    expect(refilled.active).toHaveLength(45);
  });

  it("drains a short final reserve without exceeding the ceiling", () => {
    const all = generateItems(LONG_LEVEL, makeRng(31));
    const stream = createItemStream(all, makeRng(32), TEST_CATALOG);
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
