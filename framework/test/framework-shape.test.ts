/**
 * RFC P0-1 safety net:
 *
 * 1. Structural shape snapshot — an Object.keys walk of the framework object
 *    guarding the returned structure across the index.ts decomposition (the
 *    explicit MiniAppFramework interface guards the TYPES; this guards the
 *    RUNTIME shape, getters included).
 * 2. The previously-untested surfaces the internal audit flagged:
 *    achievements, db.collection, stats.increment, state.persisted,
 *    storage.hybrid, platform.host.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable, type Observable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function makeApp(appId = "shape-test", launch: Record<string, unknown> = {}) {
  const remoteStore = new Map<string, unknown>();
  const os = {
    storage: {
      get: vi.fn(async (key: string) => remoteStore.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        remoteStore.set(key, value);
        return value;
      }),
      delete: vi.fn(async (key: string) => remoteStore.delete(key)),
      list: vi.fn(async (prefix: string, limit = 100) =>
        Object.fromEntries(
          [...remoteStore.entries()].filter(([key]) => key.startsWith(prefix)).slice(0, limit),
        ),
      ),
    },
    badge: {
      define: vi.fn(async () => {}),
      award: vi.fn(async () => {}),
      list: vi.fn(async () => [{ id: "b1" }]),
    },
  };
  const state: Record<string, Observable> = {};
  const ctx = {
    services: {
      chain: {
        address: createObservable<string | null>(ADDRESS),
        ensureWallet: vi.fn(async () => ADDRESS),
        read: vi.fn(async () => "0"),
        invoke: vi.fn(async () => ({ txid: "0x1", success: true })),
        invokeWithPayment: vi.fn(async () => ({ txid: "0x2", success: true })),
      },
      os,
    },
    os,
    t: (key: string) => key,
    state,
    launchContext: { appId, ...launch },
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId }), os, remoteStore, ctx, state };
}

beforeEach(() => {
  localStorage.clear();
});

describe("framework runtime shape snapshot", () => {
  it("keeps the exact top-level member set (getters included)", () => {
    const { app } = makeApp("shape-top");
    const keys = [
      ...new Set([
        ...Object.keys(app),
        // Lazy surfaces are prototype-less getters ON the literal — Object.keys
        // sees them because object-literal getters are enumerable own props.
      ]),
    ].sort();
    expect(keys).toEqual([
      "aa",
      "achievements",
      "actions",
      "amount",
      "bus",
      "chain",
      "clipboard",
      "credits",
      "db",
      "errors",
      "events",
      "fmt",
      "funds",
      "game",
      "lifecycle",
      "mode",
      "notify",
      "operations",
      "oracle",
      "permissions",
      "platform",
      "resources",
      "share",
      "state",
      "stats",
      "storage",
      "wallet",
    ]);
  });

  it("keeps the per-surface member sets", () => {
    const { app } = makeApp("shape-nested");
    expect(Object.keys(app.chain).sort()).toEqual([
      "address",
      "arg",
      "contractAddress",
      "contractReady",
      "detectNetwork",
      "ensureWallet",
      "enumerate",
      "eventValue",
      "events",
      "invoke",
      "invokeMultiple",
      "invokeWithPayment",
      "query",
      "read",
      "readArray",
      "readRaw",
      "signMessage",
      "waitForState",
      "write",
    ]);
    expect(Object.keys(app.funds).sort()).toEqual([
      "creditOf",
      "payAndCall",
      "prepayAndCall",
      "receiptPay",
      "withdrawCredit",
    ]);
    expect(Object.keys(app.game).sort()).toEqual([
      "leaderboard",
      "player",
      "reward",
      "rules",
      "session",
      "stats",
    ]);
    expect(Object.keys(app.oracle).sort()).toEqual([
      "compute",
      "dataFeed",
      "dispatch",
      "http",
      "seal",
      "vrf",
    ]);
    expect(Object.keys(app.storage).sort()).toEqual(["hybrid", "local", "remote"]);
    expect(Object.keys(app.fmt).sort()).toEqual([
      "address",
      "clock",
      "compact",
      "countdown",
      "fixed8",
      "gas",
      "hash",
      "number",
    ]);
    expect(Object.keys(app.errors).sort()).toEqual(["is", "messageOf"]);
    expect(Object.keys(app.actions).sort()).toEqual([
      "register",
      "registerConnectWallet",
      "run",
    ]);
    expect(Object.keys(app.platform).sort()).toEqual([
      "appId",
      "explorer",
      "host",
      "isMiniAppPlatform",
      "isOneGate",
      "launch",
      "network",
      "param",
      "params",
    ]);
    expect(Object.keys(app.mode).sort()).toEqual([
      "current",
      "get",
      "guestLeaderboard",
      "isGameFi",
      "isGuest",
      "onChange",
      "set",
    ]);
  });
});

describe("achievements (audit gap)", () => {
  it("awardOnce defines + awards once per user/definition, then dedupes via the local marker", async () => {
    const { app, os } = makeApp("shape-achievements");
    const definition = { id: "first-win", name: "First win", criteria: "win once" };
    await expect(app.achievements.awardOnce(definition)).resolves.toEqual({ awarded: true });
    expect(os.badge.define).toHaveBeenCalledWith("first-win", "First win", "win once");
    expect(os.badge.award).toHaveBeenCalledWith("first-win", ADDRESS);
    await expect(app.achievements.awardOnce(definition)).resolves.toEqual({ awarded: false });
    expect(os.badge.award).toHaveBeenCalledTimes(1);
    await expect(app.achievements.list()).resolves.toEqual([{ id: "b1" }]);
  });
});

describe("db.collection (audit gap)", () => {
  it("namespaces documents under db/<name>/ and round-trips through hybrid storage", async () => {
    const { app, remoteStore } = makeApp("shape-db");
    const posts = app.db.collection<{ title: string }>("posts");
    await posts.set("p1", { title: "hello" });
    expect(remoteStore.get("db/posts/p1")).toEqual({ title: "hello" });
    await expect(posts.get("p1")).resolves.toEqual({ title: "hello" });
    await posts.set("p2", { title: "two" });
    await expect(posts.list()).resolves.toEqual(
      expect.arrayContaining([{ title: "hello" }, { title: "two" }]),
    );
    await posts.delete("p1");
    await expect(posts.get("p1")).resolves.toBeNull();
  });
});

describe("stats.increment (audit gap)", () => {
  it("increments global and per-user counters through the stats collection", async () => {
    const { app } = makeApp("shape-stats");
    await expect(app.stats.increment("plays")).resolves.toBe(1);
    await expect(app.stats.increment("plays", 4)).resolves.toBe(5);
    await expect(app.stats.increment("plays", 1, "user")).resolves.toBe(1); // separate key
    await expect(app.stats.increment("plays")).resolves.toBe(6);
  });
});

describe("state.persisted (audit gap)", () => {
  it("hydrates from app.storage.local and persists on every set", () => {
    const first = makeApp("shape-persist");
    const counter = first.app.state.persisted("counter", 1);
    expect(counter.get()).toBe(1);
    counter.set(7);
    expect(first.app.storage.local.get<number>("state/counter")).toBe(7);
    expect(first.state.counter).toBe(counter); // registered on ctx.state

    // A NEW framework instance (same appId prefix) rehydrates the value.
    const second = makeApp("shape-persist");
    expect(second.app.state.persisted("counter", 1).get()).toBe(7);
  });
});

describe("storage.hybrid (audit gap)", () => {
  it("prefers remote reads, falls back to local, and dual-writes", async () => {
    const { app, os, remoteStore } = makeApp("shape-hybrid");
    await app.storage.hybrid.set("k", { v: 1 });
    expect(remoteStore.get("k")).toEqual({ v: 1 });
    expect(app.storage.local.get("k")).toEqual({ v: 1 });

    // Remote failure → local copy survives.
    os.storage.get.mockRejectedValueOnce(new Error("os down"));
    await expect(app.storage.hybrid.get("k")).resolves.toEqual({ v: 1 });

    // Remote value wins over a stale local copy.
    remoteStore.set("k", { v: 2 });
    await expect(app.storage.hybrid.get("k")).resolves.toEqual({ v: 2 });

    await app.storage.hybrid.delete("k");
    expect(app.storage.local.get("k")).toBeNull();
    expect(remoteStore.has("k")).toBe(false);
  });
});

describe("platform.host (audit gap)", () => {
  it("detects onegate from the launch source and defaults to standalone", () => {
    const onegate = makeApp("shape-host-onegate", { source: "OneGate" });
    expect(onegate.app.platform.host).toBe("onegate");
    expect(onegate.app.platform.isOneGate).toBe(true);
    expect(onegate.app.platform.isMiniAppPlatform).toBe(false);

    // jsdom: window.parent === window → not an embed → standalone.
    const standalone = makeApp("shape-host-standalone");
    expect(standalone.app.platform.host).toBe("standalone");
    expect(standalone.app.platform.param("missing", "fallback")).toBe("fallback");
  });

  it("reads launch params through platform.param", () => {
    const { app } = makeApp("shape-host-params", { params: { tab: "history" } });
    expect(app.platform.param("tab")).toBe("history");
    expect(app.platform.appId).toBe("shape-host-params");
  });
});
