/**
 * S4 app.events + app.bus spec (framework-extraction plan §2/S4).
 *
 * Verifies that the events surface mirrors the apps/shared ChainService
 * semantics it retires — list pagination passthrough, listAll cap bounding
 * (delegated and fallback-paged), listEventsParsed null-filtering, and the
 * waitForEvent null-on-timeout contract (45s default ≈ 2 blocks + indexer
 * lag) — and that the canonical slot decode (value/record) is behaviorally
 * identical to the app-local eventValue copies it retires. The bus surface
 * is checked for on/once/emit/off semantics, platform-bus delegation, and
 * auto-unsubscribe on lifecycle unmount.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createBusSurface,
  createEventsSurface,
} from "../events";
import type { FrameworkBusChannel, FrameworkEventsChain } from "../events";

const APP_ID = "test-app";

function surfaceOf(chain: FrameworkEventsChain) {
  return createEventsSurface({ chain, appId: APP_ID });
}

/** Build `count` synthetic events, newest-first ids for paging assertions. */
function makeEvents(count: number): Array<{ id: number }> {
  return Array.from({ length: count }, (_, index) => ({ id: index }));
}

// ---------------------------------------------------------------------------
// app.events — list
// ---------------------------------------------------------------------------

describe("app.events list", () => {
  it("passes pagination options through to the chain service verbatim", async () => {
    const page = [{ id: 1 }, { id: 2 }];
    const listEvents = vi.fn(async () => page);
    const events = surfaceOf({ listEvents });

    const result = await events.list("Solved", { limit: 25, offset: 50 });

    expect(listEvents).toHaveBeenCalledExactlyOnceWith("Solved", { limit: 25, offset: 50 });
    expect(result).toBe(page);
  });

  it("forwards an undefined options bag so service defaults apply", async () => {
    const listEvents = vi.fn(async () => []);
    const events = surfaceOf({ listEvents });

    await events.list("Solved");

    expect(listEvents).toHaveBeenCalledExactlyOnceWith("Solved", undefined);
  });

  it("degrades to an empty page when the host injects no listEvents", async () => {
    const events = surfaceOf({});
    await expect(events.list("Solved", { limit: 5 })).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// app.events — listAll
// ---------------------------------------------------------------------------

describe("app.events listAll", () => {
  it("delegates to ChainService.listAllEvents and bounds the result to cap", async () => {
    const listAllEvents = vi.fn(async () => makeEvents(10));
    const events = surfaceOf({ listAllEvents });

    const bounded = await events.listAll("Recovered", { cap: 3 });

    expect(listAllEvents).toHaveBeenCalledExactlyOnceWith("Recovered");
    expect(bounded).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }]);
  });

  it("applies the default 500 cap to an unbounded delegated walk", async () => {
    const listAllEvents = vi.fn(async () => makeEvents(620));
    const events = surfaceOf({ listAllEvents });

    const bounded = await events.listAll("Recovered");

    expect(bounded).toHaveLength(500);
    expect(bounded[499]).toEqual({ id: 499 });
  });

  it("returns the delegated result untouched when under the cap", async () => {
    const all = makeEvents(7);
    const events = surfaceOf({ listAllEvents: async () => all });

    await expect(events.listAll("Recovered")).resolves.toBe(all);
  });

  it("falls back to paging listEvents and stops on a short page", async () => {
    const store = makeEvents(70);
    const listEvents = vi.fn(async (_name: string, options?: { limit?: number; offset?: number }) =>
      store.slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50)));
    const events = surfaceOf({ listEvents });

    const all = await events.listAll("Recovered");

    expect(all).toHaveLength(70);
    expect(listEvents.mock.calls).toEqual([
      ["Recovered", { limit: 50, offset: 0 }],
      ["Recovered", { limit: 50, offset: 50 }],
    ]);
  });

  it("never requests fallback pages past the cap and slices to it exactly", async () => {
    const store = makeEvents(500);
    const listEvents = vi.fn(async (_name: string, options?: { limit?: number; offset?: number }) =>
      store.slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50)));
    const events = surfaceOf({ listEvents });

    const bounded = await events.listAll("Recovered", { cap: 60 });

    expect(bounded).toHaveLength(60);
    expect(bounded[59]).toEqual({ id: 59 });
    expect(listEvents.mock.calls).toEqual([
      ["Recovered", { limit: 50, offset: 0 }],
      ["Recovered", { limit: 50, offset: 50 }],
    ]);
  });

  it("recovers the default cap from an invalid cap value", async () => {
    const events = surfaceOf({ listAllEvents: async () => makeEvents(510) });

    await expect(events.listAll("Recovered", { cap: Number.NaN })).resolves.toHaveLength(500);
    await expect(events.listAll("Recovered", { cap: 0 })).resolves.toHaveLength(500);
  });

  it("degrades to an empty walk when the host injects no event reader", async () => {
    const events = surfaceOf({});
    await expect(events.listAll("Recovered")).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// app.events — listParsed
// ---------------------------------------------------------------------------

describe("app.events listParsed", () => {
  const decode = (ev: unknown): { id: number } | null => {
    const id = (ev as { id?: number }).id ?? -1;
    return id % 2 === 0 ? { id } : null;
  };

  it("delegates to ChainService.listEventsParsed when unbounded", async () => {
    const parsed = [{ id: 0 }, { id: 2 }];
    const listEventsParsed = vi.fn(async () => parsed);
    const events = surfaceOf({
      listEventsParsed: listEventsParsed as FrameworkEventsChain["listEventsParsed"],
    });

    const result = await events.listParsed("Solved", decode);

    expect(listEventsParsed).toHaveBeenCalledExactlyOnceWith("Solved", decode);
    expect(result).toBe(parsed);
  });

  it("decodes over the full stream and drops null-decoded events without the service method", async () => {
    const events = surfaceOf({ listAllEvents: async () => makeEvents(5) });

    await expect(events.listParsed("Solved", decode)).resolves.toEqual([
      { id: 0 },
      { id: 2 },
      { id: 4 },
    ]);
  });

  it("scans a single page when limit is given, even when the service method exists", async () => {
    const listEventsParsed = vi.fn(async () => []);
    const listEvents = vi.fn(async () => makeEvents(4));
    const events = surfaceOf({ listEvents, listEventsParsed });

    const result = await events.listParsed("Solved", decode, { limit: 4 });

    expect(listEventsParsed).not.toHaveBeenCalled();
    expect(listEvents).toHaveBeenCalledExactlyOnceWith("Solved", { limit: 4 });
    expect(result).toEqual([{ id: 0 }, { id: 2 }]);
  });
});

// ---------------------------------------------------------------------------
// app.events — waitFor
// ---------------------------------------------------------------------------

describe("app.events waitFor", () => {
  it("delegates to ChainService.waitForEvent with the 45s default timeout", async () => {
    const confirming = { event_name: "Solved", tx_hash: "0xabc" };
    const waitForEvent = vi.fn(async () => confirming);
    const events = surfaceOf({ waitForEvent });

    await expect(events.waitFor("0xabc", "Solved")).resolves.toBe(confirming);
    expect(waitForEvent).toHaveBeenCalledExactlyOnceWith("0xabc", "Solved", 45_000);
  });

  it("forwards an explicit timeout and normalizes an undefined result to null", async () => {
    const waitForEvent = vi.fn(async () => undefined);
    const events = surfaceOf({ waitForEvent });

    await expect(events.waitFor("0xabc", "Solved", 1_234)).resolves.toBeNull();
    expect(waitForEvent).toHaveBeenCalledExactlyOnceWith("0xabc", "Solved", 1_234);
  });

  it("resolves null on fallback-poll timeout, polling on the wallet-sdk cadence", async () => {
    vi.useFakeTimers();
    try {
      const listEvents = vi.fn(async () => [{ tx_hash: "0xother" }]);
      const events = surfaceOf({ listEvents });

      const wait = events.waitFor("0xdead", "Solved", 10_000);
      await vi.advanceTimersByTimeAsync(12_500);

      await expect(wait).resolves.toBeNull();
      // Polls at t=0s, 2.5s, 5s, 7.5s; the 10s deadline stops the fifth.
      expect(listEvents).toHaveBeenCalledTimes(4);
      expect(listEvents).toHaveBeenCalledWith("Solved", { limit: 50 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fallback poll matches the txid across indexer shapes, 0x/case-insensitively", async () => {
    vi.useFakeTimers();
    try {
      const confirming = { txid: "ABCDEF12", event_name: "Solved" };
      const listEvents = vi
        .fn(async (): Promise<unknown[]> => [confirming])
        .mockResolvedValueOnce([{ tx_hash: "0xother" }]);
      const events = surfaceOf({ listEvents });

      const wait = events.waitFor("0xabcdef12", "Solved", 10_000);
      await vi.advanceTimersByTimeAsync(2_500);

      await expect(wait).resolves.toBe(confirming);
      expect(listEvents).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves null without polling for an empty txid or an event-less host", async () => {
    const listEvents = vi.fn(async () => []);
    await expect(surfaceOf({ listEvents }).waitFor("", "Solved", 10)).resolves.toBeNull();
    expect(listEvents).not.toHaveBeenCalled();
    await expect(surfaceOf({}).waitFor("0xabc", "Solved", 10)).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// app.events — value/record parity with the retired app-local copies
// ---------------------------------------------------------------------------

/**
 * Byte-identical snapshot of the app-local slot decode S4 retires — copied
 * verbatim from apps/daily-checkin/src/composables/useCheckin.ts (eventSlot);
 * apps/unbreakable-vault/src/composables/useVaultCreator.ts and
 * useVaultBreaker.ts carry the same implementation. app.events.value must
 * agree with it on every payload shape so migrating those call sites cannot
 * change behavior.
 */
const retiredEventSlot = (event: unknown, index: number): unknown => {
  if (!event || typeof event !== "object") return undefined;
  const state = (event as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
};

describe("app.events value/record", () => {
  const events = surfaceOf({});

  const typedEvent = {
    event_name: "EnvelopeOpened",
    state: [
      { type: "Integer", value: "42" },
      { type: "Hash160", value: "0xa1b2" },
      { type: "Boolean", value: true },
    ],
  };

  // Every shape class the retired copies see in the wild: typed slots, bare
  // primitives, null/undefined values, valueless objects, malformed states,
  // non-object entries, bare state arrays, and out-of-range indices.
  const parityCases: Array<[string, unknown, number]> = [
    ["typed integer slot", typedEvent, 0],
    ["typed hash slot", typedEvent, 1],
    ["typed boolean slot", typedEvent, 2],
    ["out-of-range index", typedEvent, 9],
    ["negative index", typedEvent, -1],
    ["bare primitive slot", { state: ["plain", 7] }, 0],
    ["bare numeric slot", { state: ["plain", 7] }, 1],
    ["null slot value", { state: [{ type: "Any", value: null }] }, 0],
    ["undefined slot value", { state: [{ value: undefined }] }, 0],
    ["valueless object slot", { state: [{ type: "Map" }] }, 0],
    ["empty state", { state: [] }, 0],
    ["non-array state", { state: "not-an-array" }, 0],
    ["missing state", { event_name: "X" }, 0],
    ["null entry", null, 0],
    ["primitive entry", 5, 0],
    ["string entry", "event", 0],
    ["bare state array (no envelope)", [{ value: "unwrapped" }], 0],
  ];

  it.each(parityCases)("decodes %s exactly like the retired copy", (_label, payload, index) => {
    expect(events.value(payload, index)).toStrictEqual(retiredEventSlot(payload, index));
  });

  it("decodes the documented slot values", () => {
    expect(events.value(typedEvent, 0)).toBe("42");
    expect(events.value(typedEvent, 1)).toBe("0xa1b2");
    expect(events.value(typedEvent, 2)).toBe(true);
    expect(events.value(typedEvent, 9)).toBeUndefined();
    expect(events.value({ state: [{ value: null }] }, 0)).toBeNull();
  });

  it("record names positional slots and mirrors value() per slot", () => {
    const decoded = events.record(typedEvent, ["envelopeId", "opener", "isLast", "missing"]);

    expect(decoded).toStrictEqual({
      envelopeId: "42",
      opener: "0xa1b2",
      isLast: true,
      missing: undefined,
    });
    for (const [index, slot] of ["envelopeId", "opener", "isLast", "missing"].entries()) {
      expect(decoded[slot]).toStrictEqual(retiredEventSlot(typedEvent, index));
    }
  });

  it("record of a malformed event decodes every slot to undefined", () => {
    expect(events.record(null, ["a", "b"])).toStrictEqual({ a: undefined, b: undefined });
    expect(events.record({ state: "bad" }, ["a"])).toStrictEqual({ a: undefined });
  });
});

// ---------------------------------------------------------------------------
// app.bus
// ---------------------------------------------------------------------------

describe("app.bus", () => {
  it("delivers emits to subscribers and stops after unsubscribe", () => {
    const bus = createBusSurface();
    const seen: unknown[] = [];
    const unsubscribe = bus.on("game:over", (payload) => seen.push(payload));

    bus.emit("game:over", { score: 7 });
    unsubscribe();
    bus.emit("game:over", { score: 8 });

    expect(seen).toEqual([{ score: 7 }]);
  });

  it("off removes one handler, or the whole channel when omitted", () => {
    const bus = createBusSurface();
    const first = vi.fn();
    const second = vi.fn();
    bus.on("tick", first);
    bus.on("tick", second);

    bus.off("tick", first);
    bus.emit("tick");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    bus.off("tick");
    bus.emit("tick");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("once fires exactly one time, even when the handler re-emits", () => {
    const bus = createBusSurface();
    const calls: unknown[] = [];
    bus.once("boom", (payload) => {
      calls.push(payload);
      bus.emit("boom", "re-entrant");
    });

    bus.emit("boom", "first");
    bus.emit("boom", "second");

    expect(calls).toEqual(["first"]);
  });

  it("once returns an unsubscribe that cancels before the first firing", () => {
    const bus = createBusSurface();
    const handler = vi.fn();
    const cancel = bus.once("boom", handler);

    cancel();
    bus.emit("boom");

    expect(handler).not.toHaveBeenCalled();
  });

  it("a throwing handler does not break its siblings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const bus = createBusSurface();
      const after = vi.fn();
      bus.on("tick", () => {
        throw new Error("subscriber bug");
      });
      bus.on("tick", after);

      bus.emit("tick");

      expect(after).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("auto-unsubscribes every live on/once subscription on lifecycle unmount", () => {
    const unmountFns: Array<() => void> = [];
    const bus = createBusSurface({ lifecycle: { onUnmount: (fn) => unmountFns.push(fn) } });
    const persistent = vi.fn();
    const oneShot = vi.fn();
    bus.on("tick", persistent);
    bus.once("tick", oneShot);

    bus.emit("tick");
    expect(persistent).toHaveBeenCalledTimes(1);
    expect(oneShot).toHaveBeenCalledTimes(1);

    for (const fn of unmountFns) fn();
    bus.emit("tick");

    expect(persistent).toHaveBeenCalledTimes(1);
    expect(oneShot).toHaveBeenCalledTimes(1);
  });

  it("registers no unmount hook until the first subscription exists", () => {
    const onUnmount = vi.fn();
    const bus = createBusSurface({ lifecycle: { onUnmount } });

    bus.emit("tick");
    expect(onUnmount).not.toHaveBeenCalled();

    bus.on("tick", () => {});
    bus.on("tock", () => {});
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("delegates to an injected platform bus and never double-offs on unmount", () => {
    const channelUnsub = vi.fn();
    const channel: FrameworkBusChannel = {
      on: vi.fn(() => channelUnsub),
      emit: vi.fn(),
      off: vi.fn(),
    };
    const unmountFns: Array<() => void> = [];
    const bus = createBusSurface({
      bus: channel,
      lifecycle: { onUnmount: (fn) => unmountFns.push(fn) },
    });

    const handler = vi.fn();
    const unsubscribe = bus.on("platform:tx:confirmed", handler);
    bus.emit("platform:balance:changed", { asset: "GAS" });
    bus.off("platform:tx:confirmed", handler);

    expect(channel.on).toHaveBeenCalledExactlyOnceWith("platform:tx:confirmed", handler);
    expect(channel.emit).toHaveBeenCalledExactlyOnceWith("platform:balance:changed", { asset: "GAS" });
    expect(channel.off).toHaveBeenCalledExactlyOnceWith("platform:tx:confirmed", handler);

    // Manual unsubscribe removes the subscription from the unmount flush.
    unsubscribe();
    expect(channelUnsub).toHaveBeenCalledTimes(1);
    for (const fn of unmountFns) fn();
    expect(channelUnsub).toHaveBeenCalledTimes(1);
  });

  it("platform emits flow through the injected bus to app subscribers", () => {
    // A real channel double proving end-to-end delegation semantics.
    const handlers = new Map<string, Set<(payload: unknown) => void>>();
    const channel: FrameworkBusChannel = {
      on(event, handler) {
        const set = handlers.get(event) ?? new Set();
        handlers.set(event, set);
        set.add(handler);
        return () => set.delete(handler);
      },
      emit(event, payload) {
        for (const handler of [...(handlers.get(event) ?? [])]) handler(payload);
      },
      off(event, handler) {
        if (handler) handlers.get(event)?.delete(handler);
        else handlers.delete(event);
      },
    };
    const bus = createBusSurface({ bus: channel });
    const seen: unknown[] = [];
    bus.on("platform:tx:confirmed", (payload) => seen.push(payload));

    // Emitted by the platform (ChainService), not through the surface.
    channel.emit("platform:tx:confirmed", { txid: "0xabc" });

    expect(seen).toEqual([{ txid: "0xabc" }]);
  });
});
