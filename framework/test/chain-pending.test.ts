/**
 * RFC P1-4 chain.pending + chain.readTxOutcome spec.
 *
 * Covers: the readTxOutcome halt/fault/pending decode (aa-relay-console
 * log + raw-tx pair semantics, daily-checkin notification decode,
 * blockIndex/validUntilBlock extraction, the never-throws "pending"
 * collapse), the account helpers (normalizeAccount / accountMatches
 * daily-checkin semantics), notification matching via chain-events
 * helpers, and the pending lane (track/restore/list/clear persistence
 * round-trip, bounded poll budget with settle-wins ordering, visibility
 * pausing, duplicate replacement, malformed-storage cleanup, and host
 * registerCleanup teardown).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountMatches,
  createChainPendingSurface,
  findNotification,
  normalizeAccount,
  PENDING_STORAGE_PREFIX,
  type FrameworkChainPendingDeps,
  type FrameworkChainPendingSurface,
  type FrameworkPendingHandlers,
  type FrameworkTxOutcome,
} from "../chain-pending";
import { eventValue } from "../utils/chain-events";
import type { FrameworkLocalStorageSurface } from "../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TXID = `0x${"ab".repeat(32)}`;
const TXID_2 = `0x${"cd".repeat(32)}`;

// Verified N3 address ↔ display-hash pair (utils/neo parseHash160 doc).
const ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const DISPLAY_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const OTHER_HASH = `0x${"11".repeat(20)}`;

const reverseHex = (hash: string): string =>
  `0x${(hash.replace(/^0x/i, "").match(/../g) ?? []).reverse().join("")}`;

// A 20-byte non-printable ByteString round-trips to its 0x-hex form.
const HASH_BYTES = Array.from({ length: 20 }, (_, index) => index + 1);
const HASH_BYTES_BASE64 = btoa(String.fromCharCode(...HASH_BYTES));
const HASH_BYTES_HEX = `0x${HASH_BYTES.map((b) => b.toString(16).padStart(2, "0")).join("")}`;

const HALT_LOG = {
  executions: [
    {
      vmstate: "HALT",
      notifications: [
        {
          contract: DISPLAY_HASH,
          eventname: "CheckedIn",
          state: [
            { type: "ByteString", value: HASH_BYTES_BASE64 },
            { type: "Integer", value: "42" },
            { type: "Boolean", value: "true" },
          ],
        },
      ],
    },
  ],
};

const RAW_TX = { blockindex: 1_234, validuntilblock: 5_678 };

// ---------------------------------------------------------------------------
// Mock harness (neighboring style: in-memory storage + vi.fn fetcher)
// ---------------------------------------------------------------------------

type RpcRoute = (params: unknown[]) => unknown;
const RPC_ERROR = Symbol("rpc-error");

function rpcFetcher(routes: Record<string, RpcRoute>) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      method?: string;
      params?: unknown[];
    };
    const route = routes[String(body.method)];
    const out = route ? route(body.params ?? []) : RPC_ERROR;
    const payload =
      out === RPC_ERROR
        ? { jsonrpc: "2.0", id: 1, error: { code: -100, message: "Unknown transaction" } }
        : { jsonrpc: "2.0", id: 1, result: out };
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response;
  });
}

/** In-memory local lane with the real surface's JSON round-trip semantics. */
function makeStorage() {
  const map = new Map<string, string>();
  const storage: FrameworkLocalStorageSurface = {
    get<T>(key: string, fallback: T | null = null): T | null {
      const raw = map.get(key);
      if (raw === undefined) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown): void {
      map.set(key, JSON.stringify(value));
    },
    delete(key: string): void {
      map.delete(key);
    },
    list(prefix: string): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [key, raw] of map) {
        if (!key.startsWith(prefix)) continue;
        try {
          out[key] = JSON.parse(raw);
        } catch {
          /* skip unparseable values, mirroring the real lane */
        }
      }
      return out;
    },
  };
  return { storage, map };
}

function makeHandlers<TMeta = unknown>(
  overrides: Partial<FrameworkPendingHandlers<TMeta>> = {},
): FrameworkPendingHandlers<TMeta> & {
  isSettled: ReturnType<typeof vi.fn>;
  onSettled: ReturnType<typeof vi.fn>;
  onExpired: ReturnType<typeof vi.fn>;
} {
  return {
    isSettled: vi.fn(async () => false),
    onSettled: vi.fn(),
    onExpired: vi.fn(),
    ...overrides,
  } as FrameworkPendingHandlers<TMeta> & {
    isSettled: ReturnType<typeof vi.fn>;
    onSettled: ReturnType<typeof vi.fn>;
    onExpired: ReturnType<typeof vi.fn>;
  };
}

function makeHarness(
  routes: Record<string, RpcRoute> = {},
  depsOverride: Partial<FrameworkChainPendingDeps> = {},
) {
  const { storage, map } = makeStorage();
  const fetcher = rpcFetcher(routes);
  const build = (): FrameworkChainPendingSurface =>
    createChainPendingSurface({
      storage,
      rpcUrl: (network) => (network ? `https://rpc.test.local/${network}` : ""),
      network: () => "testnet",
      fetcher: fetcher as unknown as typeof fetch,
      ...depsOverride,
    });
  return { surface: build(), respawn: build, storage, map, fetcher };
}

function rpcMethodsOf(fetcher: ReturnType<typeof vi.fn>): string[] {
  return fetcher.mock.calls.map(
    (call) =>
      (JSON.parse(String(call[1]?.body ?? "{}")) as { method?: string }).method ?? "",
  );
}

function rpcParamsOf(fetcher: ReturnType<typeof vi.fn>, callIndex: number): unknown[] {
  return (
    (JSON.parse(String(fetcher.mock.calls[callIndex]?.[1]?.body ?? "{}")) as {
      params?: unknown[];
    }).params ?? []
  );
}

// ---------------------------------------------------------------------------
// document.hidden mocking (lifecycle-surface.test.ts pattern)
// ---------------------------------------------------------------------------

let documentHidden = false;

function setDocumentHidden(value: boolean): void {
  documentHidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  documentHidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => documentHidden,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// readTxOutcome
// ---------------------------------------------------------------------------

describe("chain.readTxOutcome", () => {
  it("decodes a HALT verdict with notifications and block data", async () => {
    const { surface, fetcher } = makeHarness({
      getapplicationlog: () => HALT_LOG,
      getrawtransaction: () => RAW_TX,
    });

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome.state).toBe("halt");
    expect(outcome.blockIndex).toBe(1_234);
    expect(outcome.validUntilBlock).toBe(5_678);
    expect(outcome.notifications).toHaveLength(1);
    const notification = outcome.notifications[0]!;
    expect(notification.contract).toBe(DISPLAY_HASH);
    expect(notification.eventName).toBe("CheckedIn");
    // Slots are readable through the existing chain-events helpers.
    expect(eventValue(notification, 0)).toBe(HASH_BYTES_HEX);
    expect(eventValue(notification, 1)).toBe(42);
    expect(eventValue(notification, 2)).toBe(true);
    // The log + raw-tx pair fires together, both addressed by txid.
    expect(rpcMethodsOf(fetcher).sort()).toEqual(["getapplicationlog", "getrawtransaction"]);
    expect(rpcParamsOf(fetcher, 0)).toEqual([TXID]);
  });

  it("normalizes a bare uppercase txid before the RPC call", async () => {
    const { surface, fetcher } = makeHarness({
      getapplicationlog: () => HALT_LOG,
      getrawtransaction: () => RAW_TX,
    });

    const outcome = await surface.readTxOutcome(TXID.slice(2).toUpperCase());

    expect(outcome.state).toBe("halt");
    expect(rpcParamsOf(fetcher, 0)).toEqual([TXID]);
  });

  it("decodes a FAULT verdict with empty notifications but block data", async () => {
    const { surface } = makeHarness({
      getapplicationlog: () => ({
        executions: [
          {
            vmstate: "FAULT",
            exception: "insufficient balance",
            notifications: [{ contract: DISPLAY_HASH, eventname: "Ignored", state: [] }],
          },
        ],
      }),
      getrawtransaction: () => RAW_TX,
    });

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome.state).toBe("fault");
    expect(outcome.notifications).toEqual([]);
    expect(outcome.blockIndex).toBe(1_234);
    expect(outcome.validUntilBlock).toBe(5_678);
  });

  it("reports pending when the node has no record of the tx yet", async () => {
    const { surface } = makeHarness({}); // every method RPC-errors

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome).toEqual({
      state: "pending",
      notifications: [],
      blockIndex: null,
      validUntilBlock: null,
    });
  });

  it("reports pending when only the raw transaction is visible (pair semantics)", async () => {
    const { surface } = makeHarness({
      getrawtransaction: () => RAW_TX, // getapplicationlog RPC-errors
    });

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome.state).toBe("pending");
    expect(outcome.blockIndex).toBeNull();
  });

  it("reports pending with block data when executions are empty", async () => {
    const { surface } = makeHarness({
      getapplicationlog: () => ({ executions: [] }),
      getrawtransaction: () => RAW_TX,
    });

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome.state).toBe("pending");
    expect(outcome.blockIndex).toBe(1_234);
    expect(outcome.validUntilBlock).toBe(5_678);
  });

  it("reports pending when the transport throws (never rejects)", async () => {
    const { surface } = makeHarness(
      {},
      { fetcher: vi.fn(async () => Promise.reject(new Error("network down"))) as unknown as typeof fetch },
    );

    await expect(surface.readTxOutcome(TXID)).resolves.toEqual({
      state: "pending",
      notifications: [],
      blockIndex: null,
      validUntilBlock: null,
    });
  });

  it("reports pending for a malformed txid without touching the network", async () => {
    const { surface, fetcher } = makeHarness({
      getapplicationlog: () => HALT_LOG,
      getrawtransaction: () => RAW_TX,
    });

    const outcome = await surface.readTxOutcome("not-a-txid");

    expect(outcome.state).toBe("pending");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports pending when the network has no RPC endpoint", async () => {
    const { surface, fetcher } = makeHarness(
      { getapplicationlog: () => HALT_LOG, getrawtransaction: () => RAW_TX },
      { rpcUrl: () => "" },
    );

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome.state).toBe("pending");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("pins the network via options and tolerates snake_case tx fields", async () => {
    const { surface, fetcher } = makeHarness({
      getapplicationlog: () => HALT_LOG,
      getrawtransaction: () => ({ block_index: 9, valid_until_block: 10 }),
    });

    const outcome = await surface.readTxOutcome(TXID, { network: "mainnet" });

    expect(outcome.state).toBe("halt");
    expect(outcome.blockIndex).toBe(9);
    expect(outcome.validUntilBlock).toBe(10);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://rpc.test.local/mainnet");
  });

  it("drops malformed notifications and tolerates wire-shape variants", async () => {
    const { surface } = makeHarness({
      getapplicationlog: () => ({
        executions: [
          {
            vmstate: "HALT",
            notifications: [
              { contract: "", eventname: "NoContract", state: [] },
              {
                contract: DISPLAY_HASH,
                event_name: "SnakeCase",
                state: [{ type: "Integer", value: "1" }],
              },
              {
                contract: DISPLAY_HASH,
                eventname: "Enveloped",
                state: { value: [{ type: "Integer", value: "2" }] },
              },
            ],
          },
        ],
      }),
      getrawtransaction: () => RAW_TX,
    });

    const outcome = await surface.readTxOutcome(TXID);

    expect(outcome.notifications.map((entry) => entry.eventName)).toEqual([
      "SnakeCase",
      "Enveloped",
    ]);
    expect(eventValue(outcome.notifications[0]!, 0)).toBe(1);
    expect(eventValue(outcome.notifications[1]!, 0)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Account helpers (daily-checkin semantics)
// ---------------------------------------------------------------------------

describe("normalizeAccount / accountMatches", () => {
  it("normalizes display hashes, N3 addresses and chain-order hex", () => {
    expect(normalizeAccount(`0x${DISPLAY_HASH.slice(2).toUpperCase()}`)).toBe(DISPLAY_HASH);
    expect(normalizeAccount(ADDRESS)).toBe(DISPLAY_HASH);
    expect(normalizeAccount(reverseHex(DISPLAY_HASH).slice(2))).toBe(DISPLAY_HASH);
  });

  it("rejects the zero hash and unparseable input", () => {
    expect(normalizeAccount(`0x${"0".repeat(40)}`)).toBe("");
    expect(normalizeAccount("garbage")).toBe("");
    expect(normalizeAccount("")).toBe("");
    expect(normalizeAccount(null)).toBe("");
    expect(normalizeAccount(undefined)).toBe("");
  });

  it("matches across display hex, chain-order hex and address variants", () => {
    expect(accountMatches(DISPLAY_HASH, DISPLAY_HASH)).toBe(true);
    expect(accountMatches(DISPLAY_HASH, reverseHex(DISPLAY_HASH))).toBe(true);
    expect(accountMatches(ADDRESS, DISPLAY_HASH)).toBe(true);
    expect(accountMatches(DISPLAY_HASH, OTHER_HASH)).toBe(false);
  });

  it("never matches empty or zero inputs", () => {
    expect(accountMatches("", "")).toBe(false);
    expect(accountMatches(`0x${"0".repeat(40)}`, `0x${"0".repeat(40)}`)).toBe(false);
    expect(accountMatches("", DISPLAY_HASH)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findNotification
// ---------------------------------------------------------------------------

describe("findNotification", () => {
  const outcome: FrameworkTxOutcome = {
    state: "halt",
    blockIndex: 1,
    validUntilBlock: 2,
    notifications: [
      { contract: DISPLAY_HASH, eventName: "CheckedIn", state: [{ value: 1 }] },
      { contract: OTHER_HASH, eventName: "CheckedIn", state: [{ value: 2 }] },
    ],
  };

  it("matches the emitting contract given as an N3 address", () => {
    const found = findNotification(outcome, ADDRESS, "CheckedIn");
    expect(found).not.toBeNull();
    expect(eventValue(found, 0)).toBe(1);
  });

  it("matches the emitting contract given in chain-order hex", () => {
    const found = findNotification(outcome, reverseHex(DISPLAY_HASH), "CheckedIn");
    expect(found).not.toBeNull();
    expect(eventValue(found, 0)).toBe(1);
  });

  it("applies the predicate to narrow same-name notifications", () => {
    const found = findNotification(
      outcome,
      OTHER_HASH,
      "CheckedIn",
      (notification) => eventValue(notification, 0) === 2,
    );
    expect(found).not.toBeNull();
    expect(found!.contract).toBe(OTHER_HASH);
  });

  it("returns null when nothing matches", () => {
    expect(findNotification(outcome, DISPLAY_HASH, "NoSuchEvent")).toBeNull();
    expect(findNotification(outcome, `0x${"22".repeat(20)}`, "CheckedIn")).toBeNull();
  });

  it("is also exposed on the surface", () => {
    const { surface } = makeHarness();
    expect(surface.findNotification(outcome, ADDRESS, "CheckedIn")).not.toBeNull();
    expect(surface.normalizeAccount(ADDRESS)).toBe(DISPLAY_HASH);
    expect(surface.accountMatches(ADDRESS, DISPLAY_HASH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// chain.pending — track / restore / list / clear
// ---------------------------------------------------------------------------

describe("chain.pending track + persistence", () => {
  it("persists a normalized record under the framework-owned key", async () => {
    const { surface, map } = makeHarness();
    const handlers = makeHandlers<{ betId: string }>();

    const record = surface.track(
      "bets",
      { txid: TXID.toUpperCase(), meta: { betId: "b1" } },
      handlers,
      { pollMs: 1_000 },
    );

    expect(record).not.toBeNull();
    expect(record!.txid).toBe(TXID);
    expect(record!.meta).toEqual({ betId: "b1" });
    expect(record!.createdAt).toBe(Date.now());
    const stored = JSON.parse(map.get(`${PENDING_STORAGE_PREFIX}bets`) ?? "null");
    expect(stored).toEqual({
      version: 1,
      entries: [{ txid: TXID, meta: { betId: "b1" }, createdAt: Date.now() }],
    });
    expect(surface.list("bets")).toEqual([record]);

    // The immediate tick already polled once; nothing settled.
    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.isSettled).toHaveBeenCalledTimes(1);
    expect(handlers.onSettled).not.toHaveBeenCalled();
  });

  it("returns null and persists nothing for a malformed txid or empty lane", async () => {
    const { surface, map } = makeHarness();
    const handlers = makeHandlers();

    expect(surface.track("bets", { txid: "nope", meta: {} }, handlers)).toBeNull();
    expect(surface.track("", { txid: TXID, meta: {} }, handlers)).toBeNull();
    expect(map.size).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(handlers.isSettled).not.toHaveBeenCalled();
  });

  it("settles on the immediate tick and stops polling", async () => {
    const { surface } = makeHarness();
    const handlers = makeHandlers({ isSettled: vi.fn(async () => true) });

    surface.track("bets", { txid: TXID, meta: { betId: "b1" } }, handlers, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(handlers.onSettled).toHaveBeenCalledTimes(1);
    expect(handlers.onSettled.mock.calls[0]?.[0]).toMatchObject({ txid: TXID });
    expect(handlers.onExpired).not.toHaveBeenCalled();
    expect(surface.list("bets")).toEqual([]);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(handlers.isSettled).toHaveBeenCalledTimes(1);
  });

  it("keeps polling until a later tick settles", async () => {
    const { surface } = makeHarness();
    let calls = 0;
    const handlers = makeHandlers({
      isSettled: vi.fn(async () => {
        calls += 1;
        return calls >= 3;
      }),
    });

    surface.track("bets", { txid: TXID, meta: {} }, handlers, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);
    expect(handlers.onSettled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(3);
    expect(handlers.onSettled).toHaveBeenCalledTimes(1);
    expect(surface.list("bets")).toEqual([]);
  });

  it("expires the entry once the poll budget is exhausted", async () => {
    const { surface } = makeHarness();
    const handlers = makeHandlers({ isSettled: vi.fn(async () => false) });

    surface.track("bets", { txid: TXID, meta: {} }, handlers, { pollMs: 500, ttlMs: 2_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.onExpired).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(handlers.onExpired).toHaveBeenCalledTimes(1);
    expect(handlers.onSettled).not.toHaveBeenCalled();
    expect(surface.list("bets")).toEqual([]);

    const callsAtExpiry = handlers.isSettled.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(handlers.isSettled).toHaveBeenCalledTimes(callsAtExpiry);
    expect(handlers.onExpired).toHaveBeenCalledTimes(1);
  });

  it("swallows isSettled throws and keeps polling within the budget", async () => {
    const { surface } = makeHarness();
    let calls = 0;
    const handlers = makeHandlers({
      isSettled: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error("rpc down");
        return true;
      }),
    });

    surface.track("bets", { txid: TXID, meta: {} }, handlers, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    expect(handlers.onSettled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);
    expect(handlers.onSettled).toHaveBeenCalledTimes(1);
  });

  it("cleans the lane even when onSettled throws", async () => {
    const { surface } = makeHarness();
    const handlers = makeHandlers({
      isSettled: vi.fn(async () => true),
      onSettled: vi.fn(() => {
        throw new Error("ui down");
      }),
    });

    surface.track("bets", { txid: TXID, meta: {} }, handlers, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(handlers.onSettled).toHaveBeenCalledTimes(1);
    expect(surface.list("bets")).toEqual([]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(handlers.isSettled).toHaveBeenCalledTimes(1);
  });

  it("pauses while the document is hidden and resumes with a catch-up tick", async () => {
    const { surface } = makeHarness();
    const handlers = makeHandlers({ isSettled: vi.fn(async () => false) });

    documentHidden = true;
    surface.track("bets", { txid: TXID, meta: {} }, handlers, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(handlers.isSettled).not.toHaveBeenCalled();

    setDocumentHidden(false); // resume → immediate catch-up tick
    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.isSettled).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(handlers.isSettled).toHaveBeenCalledTimes(2);

    setDocumentHidden(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(handlers.isSettled).toHaveBeenCalledTimes(2);

    setDocumentHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.isSettled).toHaveBeenCalledTimes(3);
  });

  it("replaces the record and poller when the same txid is re-tracked", async () => {
    const { surface } = makeHarness();
    const first = makeHandlers({ isSettled: vi.fn(async () => false) });
    const second = makeHandlers({ isSettled: vi.fn(async () => false) });

    surface.track("bets", { txid: TXID, meta: { v: 1 } }, first, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(first.isSettled).toHaveBeenCalledTimes(1);

    surface.track("bets", { txid: TXID, meta: { v: 2 } }, second, { pollMs: 1_000 });

    expect(surface.list("bets")).toHaveLength(1);
    expect(surface.list("bets")[0]?.meta).toEqual({ v: 2 });

    await vi.advanceTimersByTimeAsync(3_000);
    expect(first.isSettled).toHaveBeenCalledTimes(1); // old poller stopped
    expect(second.isSettled.mock.calls.length).toBeGreaterThan(1);
  });

  it("stops every live poller when the host runs the registered cleanup", async () => {
    const cleanups: Array<() => void> = [];
    const { surface } = makeHarness(
      {},
      {
        registerCleanup: (fn) => {
          cleanups.push(fn);
        },
      },
    );
    const bets = makeHandlers();
    const claims = makeHandlers();

    surface.track("bets", { txid: TXID, meta: {} }, bets, { pollMs: 1_000 });
    surface.track("claims", { txid: TXID_2, meta: {} }, claims, { pollMs: 1_000 });
    expect(cleanups).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);
    const betsCalls = bets.isSettled.mock.calls.length;
    const claimsCalls = claims.isSettled.mock.calls.length;

    cleanups[0]?.();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bets.isSettled).toHaveBeenCalledTimes(betsCalls);
    expect(claims.isSettled).toHaveBeenCalledTimes(claimsCalls);
  });
});

describe("chain.pending restore / list / clear", () => {
  const seedEntry = (overrides: Record<string, unknown> = {}) => ({
    txid: TXID,
    meta: { betId: "b1" },
    createdAt: Date.now(),
    ...overrides,
  });

  it("round-trips persisted entries across a reload (new surface instance)", async () => {
    const first = makeHarness();
    first.surface.track("bets", { txid: TXID, meta: { betId: "b1" } }, makeHandlers(), {
      pollMs: 1_000,
    });

    // Simulate a reload: a fresh surface over the SAME storage sees the lane.
    const second = first.respawn();
    expect(second.list("bets")).toHaveLength(1);
    expect(second.list("bets")[0]).toMatchObject({ txid: TXID, meta: { betId: "b1" } });

    const handlers = makeHandlers({ isSettled: vi.fn(async () => true) });
    await expect(second.restore("bets", handlers, { pollMs: 1_000 })).resolves.toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.onSettled).toHaveBeenCalledTimes(1);
    expect(second.list("bets")).toEqual([]);
  });

  it("restores every persisted entry and skips already-active ones", async () => {
    const { surface, map } = makeHarness();
    map.set(
      `${PENDING_STORAGE_PREFIX}bets`,
      JSON.stringify({ version: 1, entries: [seedEntry(), seedEntry({ txid: TXID_2 })] }),
    );

    const handlers = makeHandlers();
    await expect(surface.restore("bets", handlers, { pollMs: 1_000 })).resolves.toBe(2);
    // A second restore does not double-arm the live pollers.
    await expect(surface.restore("bets", handlers, { pollMs: 1_000 })).resolves.toBe(0);
    await expect(surface.restore("unknown-lane", handlers)).resolves.toBe(0);
  });

  it("settles a restored entry even past its TTL (settle wins over expiry)", async () => {
    const { surface, map } = makeHarness();
    map.set(
      `${PENDING_STORAGE_PREFIX}bets`,
      JSON.stringify({
        version: 1,
        entries: [seedEntry({ createdAt: Date.now() - 10_000 })],
      }),
    );
    const handlers = makeHandlers({ isSettled: vi.fn(async () => true) });

    await expect(surface.restore("bets", handlers, { pollMs: 1_000, ttlMs: 1_000 })).resolves.toBe(1);
    await vi.advanceTimersByTimeAsync(0);

    expect(handlers.onSettled).toHaveBeenCalledTimes(1);
    expect(handlers.onExpired).not.toHaveBeenCalled();
    expect(surface.list("bets")).toEqual([]);
  });

  it("expires a restored entry whose TTL elapsed unsettled", async () => {
    const { surface, map } = makeHarness();
    map.set(
      `${PENDING_STORAGE_PREFIX}bets`,
      JSON.stringify({
        version: 1,
        entries: [seedEntry({ createdAt: Date.now() - 10_000 })],
      }),
    );
    const handlers = makeHandlers({ isSettled: vi.fn(async () => false) });

    await surface.restore("bets", handlers, { pollMs: 1_000, ttlMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(handlers.onExpired).toHaveBeenCalledTimes(1);
    expect(surface.list("bets")).toEqual([]);
  });

  it("deletes a malformed envelope and converges rotten entries", () => {
    const { surface, map } = makeHarness();
    const key = `${PENDING_STORAGE_PREFIX}bets`;

    map.set(key, JSON.stringify({ version: 99, entries: [] }));
    expect(surface.list("bets")).toEqual([]);
    expect(map.has(key)).toBe(false);

    map.set(key, "not json");
    expect(surface.list("bets")).toEqual([]);

    const valid = seedEntry({ createdAt: 123 });
    map.set(
      key,
      JSON.stringify({
        version: 1,
        entries: [valid, { txid: "bad", meta: {}, createdAt: 1 }, { txid: TXID_2, createdAt: -5 }],
      }),
    );
    expect(surface.list("bets")).toEqual([valid]);
    expect(
      (JSON.parse(map.get(key) ?? "{}") as { entries: unknown[] }).entries,
    ).toEqual([valid]);
  });

  it("clears one txid or the whole lane, stopping their pollers", async () => {
    const { surface, map } = makeHarness();
    const first = makeHandlers();
    const second = makeHandlers();

    surface.track("bets", { txid: TXID, meta: {} }, first, { pollMs: 1_000 });
    surface.track("bets", { txid: TXID_2, meta: {} }, second, { pollMs: 1_000 });
    await vi.advanceTimersByTimeAsync(0);

    surface.clear("bets", TXID.toUpperCase()); // normalization applies here too
    expect(surface.list("bets").map((entry) => entry.txid)).toEqual([TXID_2]);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(first.isSettled).toHaveBeenCalledTimes(1); // stopped
    expect(second.isSettled.mock.calls.length).toBeGreaterThan(1);

    // An invalid txid is a no-op; clearing the lane drops the rest.
    surface.clear("bets", "nope");
    expect(surface.list("bets")).toHaveLength(1);
    surface.clear("bets");
    expect(surface.list("bets")).toEqual([]);
    expect(map.has(`${PENDING_STORAGE_PREFIX}bets`)).toBe(false);

    const secondCalls = second.isSettled.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3_000);
    expect(second.isSettled).toHaveBeenCalledTimes(secondCalls);
  });
});
