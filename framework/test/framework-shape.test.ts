/**
 * RFC P0-1 safety net:
 *
 * 1. Structural shape snapshot — an Object.keys walk of the framework object
 *    guarding the returned structure across the index.ts decomposition (the
 *    explicit MiniAppFramework interface guards the TYPES; this guards the
 *    RUNTIME shape, getters included).
 * 2. The previously-untested surfaces the internal audit flagged:
 *    state.persisted, platform.host. (The audit's other flagged surfaces —
 *    achievements, db.collection, stats.increment, storage.hybrid — were
 *    removed with their lanes: 0 fleet consumers.)
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
      "actions",
      "amount",
      "badge",
      "bus",
      "chain",
      "clipboard",
      "credits",
      "errors",
      "events",
      // No "fmt": the app.fmt accessor (RFC P0-3) was removed as unreachable.
      // react/MiniAppRoot's PlayAreaProps hands views {t, state, dispatch,
      // services, status, ...} and no app/framework identifier, so no view
      // could reach it; it had zero call sites in the fleet and zero in git
      // history. Its methods only delegated to utils/format, which apps import
      // as a plain module (the fleet's real canonical). The one implementation
      // that was not already in utils/format — formatClock — is kept and
      // exported from framework/fmt-surface.
      "funds",
      "game",
      "lifecycle",
      "mode",
      "notify",
      "operations",
      "oracle",
      "permissions",
      "platform",
      "platformAccount",
      "platformAnchor",
      "platformDeFi",
      "platformFactory",
      "platformGame",
      "platformSocial",
      "registry",
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
      "eventValue",
      "events",
      "invoke",
      "invokeMultiple",
      "invokeWithPayment",
      "pending",
      "query",
      "readArray",
      "readRaw",
      "readTxOutcome",
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
    expect(Object.keys(app.storage).sort()).toEqual(["local", "remote"]);
    // No app.fmt member set — the accessor was removed as unreachable; see the
    // justification on the top-level member set above.
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
