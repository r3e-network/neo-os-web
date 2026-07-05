import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../../../framework";
import type { MiniAppFrameworkContext } from "../../../framework";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ADDRESS_HASH = addressToScriptHash(ADDRESS);

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return Object.entries(params).reduce(
    (out, [name, value]) => out.replace(`{${name}}`, String(value)),
    key,
  );
}

function makeContext(overrides: Partial<MiniAppFrameworkContext> = {}) {
  const remote = new Map<string, unknown>();
  const notifications: Array<{ type: string; key: string }> = [];
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (operation: string) => {
      if (operation === "creditOf") return "3000000";
      return "42";
    }),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true, verified: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true, verified: true })),
    listEvents: vi.fn(async () => []),
  };
  const notify = {
    success: vi.fn((key: string) => notifications.push({ type: "success", key })),
    error: vi.fn((error: unknown, key = "error") => {
      notifications.push({ type: "error", key: error instanceof Error ? error.message : key });
    }),
    info: vi.fn((key: string) => notifications.push({ type: "info", key })),
    warn: vi.fn((key: string) => notifications.push({ type: "warning", key })),
    guardResult: vi.fn(async (fn: () => Promise<unknown>, successKey?: string) => {
      try {
        const value = await fn();
        if (successKey) notify.success(successKey);
        return { ok: true as const, value };
      } catch (error) {
        notify.error(error);
        return { ok: false as const, error };
      }
    }),
  };
  const os = {
    storage: {
      get: vi.fn(async (key: string) => remote.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        remote.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        remote.delete(key);
      }),
      list: vi.fn(async (prefix: string) =>
        Object.fromEntries([...remote.entries()].filter(([key]) => key.startsWith(prefix))),
      ),
    },
    badge: {
      define: vi.fn(async () => undefined),
      award: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      updateStat: vi.fn(async () => undefined),
      getStat: vi.fn(async () => "0"),
    },
    leaderboard: {
      submitScore: vi.fn(async () => undefined),
      get: vi.fn(async () => [{ user: "alice", score: "100" }]),
    },
  };

  return {
    ctx: {
      services: { chain, notify, os },
      os,
      t,
      setStatus: vi.fn(),
      clearStatus: vi.fn(),
      launchContext: {
        appId: "miniapp-demo",
        source: "onegate",
        operation: null,
        tab: null,
        network: "testnet",
        params: { round: "7" },
        keys: ["round"],
        hasParams: true,
        signature: "round=7",
      },
      registerAction: vi.fn(),
      ...overrides,
    } as unknown as MiniAppFrameworkContext,
    chain,
    os,
    notify,
    remote,
    notifications,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("MiniApp Framework", () => {
  it("lives as a platform-level framework module outside apps/shared", () => {
    const repoRoot = resolve(__dirname, "../../..");

    expect(existsSync(resolve(repoRoot, "framework/index.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "apps/shared/framework/index.ts"))).toBe(false);
  });

  it("detects OneGate launches and persists namespaced state locally", () => {
    const { ctx } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });

    expect(app.platform.isOneGate).toBe(true);
    expect(app.platform.host).toBe("onegate");
    expect(app.platform.param("round")).toBe("7");

    const visits = app.state.persisted("visits", 0);
    visits.set(3);

    const restored = createMiniAppFramework(ctx, { appId: "miniapp-demo" })
      .state.persisted("visits", 0);
    expect(restored.get()).toBe(3);
    expect(localStorage.getItem("neo:miniapp-demo:state/visits")).toBe("3");
  });

  it("stores app data through a collection facade with local fallback when OS storage is offline", async () => {
    const { ctx, os } = makeContext();
    os.storage.set.mockRejectedValueOnce(new Error("edge offline"));
    os.storage.get.mockRejectedValueOnce(new Error("edge offline"));
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });
    const runs = app.db.collection<{ score: number }>("runs");

    await runs.set("run-1", { score: 88 });

    await expect(runs.get("run-1")).resolves.toEqual({ score: 88 });
    expect(localStorage.getItem("neo:miniapp-demo:db/runs/run-1")).toBe('{"score":88}');
  });

  it("wraps chain writes, payable calls, reloads, and success notifications", async () => {
    const { ctx, chain, notify } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });
    const reload = vi.fn(async () => undefined);

    await app.chain.write({
      operation: "claim",
      args: [{ type: "Integer", value: "1" }],
      waitForEvent: "Claimed",
      successKey: "claimSuccess",
      reload,
    });
    await app.funds.payAndCall({
      amountFixed8: 2_000_000n,
      memo: "entry",
      operation: "startGame",
      args: [],
      waitForEvent: "GameStarted",
    });
    await expect(app.funds.creditOf()).resolves.toBe(3_000_000n);

    expect(chain.invoke).toHaveBeenCalledWith(
      "claim",
      [{ type: "Integer", value: "1" }],
      { waitForEvent: "Claimed" },
    );
    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "2000000",
      "entry",
      "startGame",
      [],
      { waitForEvent: "GameStarted" },
    );
    expect(chain.read).toHaveBeenCalledWith(
      "creditOf",
      [{ type: "Hash160", value: ADDRESS_HASH }],
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith("claimSuccess");
  });

  it("normalizes wallet addresses, GAS fixed8, and whole-number NEO amounts", () => {
    const { ctx } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });

    expect(app.chain.arg.hash160(ADDRESS)).toEqual({ type: "Hash160", value: ADDRESS_HASH });
    expect(app.chain.arg.integer(7n)).toEqual({ type: "Integer", value: "7" });
    expect(app.chain.arg.array([
      app.chain.arg.string("mode"),
      app.chain.arg.integer("3"),
    ])).toEqual({
      type: "Array",
      value: [
        { type: "String", value: "mode" },
        { type: "Integer", value: "3" },
      ],
    });

    expect(app.amount.gasToFixed8("0.00000001")).toBe(1n);
    expect(app.amount.fixed8ToGas(2_000_000n)).toBe("0.02");
    expect(app.amount.neoToUnits("3")).toBe(3n);
    expect(app.amount.gasToFixed8(0n, { allowZero: true })).toBe(0n);
    expect(app.amount.neoToUnits(0n, { allowZero: true })).toBe(0n);
    expect(() => app.amount.gasToFixed8(-1n, { allowZero: true })).toThrow(/negative/);
    expect(() => app.amount.neoToUnits(-1n, { allowZero: true })).toThrow(/negative/);
    expect(() => app.amount.neoToUnits("1.5")).toThrow(/whole number/);
  });

  it("tracks operation state for user-visible pending, success, and failure recovery", async () => {
    const { ctx, notify } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });
    const claim = app.operations.create("claim");

    await expect(claim.run(() => app.chain.write({
      operation: "claim",
      args: [],
      waitForEvent: "Claimed",
    }), { successKey: "claimSuccess" })).resolves.toMatchObject({ txid: "0xinvoke" });

    expect(claim.state.get()).toMatchObject({
      key: "claim",
      status: "succeeded",
      txid: "0xinvoke",
      error: "",
    });

    await expect(claim.run(async () => {
      throw new Error("network busy");
    })).resolves.toBeUndefined();

    expect(claim.state.get()).toMatchObject({
      key: "claim",
      status: "failed",
      error: "network busy",
    });
    expect(notify.error).toHaveBeenCalledWith(expect.any(Error), undefined);
  });

  it("keeps the latest operation state when runs resolve out of order", async () => {
    const { ctx } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });
    const sync = app.operations.create<string>("sync");
    let finishSlow: (value: string) => void = () => undefined;

    const slow = sync.run(() => new Promise<string>((resolve) => {
      finishSlow = resolve;
    }));
    await sync.run(async () => "fresh");
    finishSlow("stale");
    await slow;

    expect(sync.state.get()).toMatchObject({
      status: "succeeded",
      value: "fresh",
      runId: 2,
    });
  });

  it("builds deterministic oracle envelopes and rejects unsafe HTTP URLs", async () => {
    const { ctx } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });

    const a = await app.oracle.http({
      url: "https://api.example.com/price",
      method: "POST",
      path: "$.price",
      body: { b: 2, a: 1 },
    });
    const b = await app.oracle.http({
      url: "https://api.example.com/price",
      method: "POST",
      path: "$.price",
      body: { a: 1, b: 2 },
    });

    expect(a.digest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(b.digest).toBe(a.digest);
    expect(a.payload).toMatchObject({
      kind: "oracle.http.request",
      appId: "miniapp-demo",
      method: "POST",
      path: "$.price",
    });
    await expect(app.oracle.http({ url: "file:///etc/passwd" })).rejects.toThrow(/http\(s\)/);
  });

  it("standardizes stats, achievements, leaderboards, and single-flight actions", async () => {
    const { ctx, os } = makeContext();
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });
    const work = vi.fn(async () => "done");

    app.actions.register("sync", work, { successKey: "synced" });
    expect(ctx.registerAction).toHaveBeenCalledWith("sync", expect.any(Function));
    const first = app.actions.run("sync");
    const duplicate = app.actions.run("sync");

    await expect(first).resolves.toBe("done");
    await expect(duplicate).resolves.toBeUndefined();
    expect(work).toHaveBeenCalledTimes(1);

    await expect(app.stats.increment("gamesPlayed", 2)).resolves.toBe(2);
    await app.stats.leaderboard.submit(100);
    await expect(app.stats.leaderboard.top()).resolves.toEqual([{ user: "alice", score: "100" }]);

    await expect(app.achievements.awardOnce({
      id: "first-win",
      name: "First win",
      criteria: "Finish one game",
    })).resolves.toEqual({ awarded: true });
    await expect(app.achievements.awardOnce({
      id: "first-win",
      name: "First win",
      criteria: "Finish one game",
    })).resolves.toEqual({ awarded: false });

    expect(os.badge.define).toHaveBeenCalledWith("first-win", "First win", "Finish one game");
    expect(os.badge.award).toHaveBeenCalledTimes(1);
  });

  it("creates a framework-native reward game client with namespaced op-log storage", async () => {
    const { ctx, chain } = makeContext();
    chain.read.mockImplementation(async (operation: string) => {
      if (operation === "freePool") return "100000000";
      if (operation === "creditOf") return "0";
      if (operation === "activeGameOf") return "9";
      return "0";
    });
    const app = createMiniAppFramework(ctx, { appId: "miniapp-demo" });
    const game = app.game.reward({
      engineHash: "ab".repeat(32),
      entryMemo: "miniapp-demo:entry",
      modes: [
        { id: 0, entryFixed8: 2_000_000n, rewardFixed8: 10_000_000n },
      ],
    });

    const start = await game.start(0);
    game.storage.save(start.gameId, [{ type: "tap" }]);

    expect(start).toMatchObject({
      gameId: "9",
      usedCredit: false,
      playerHash: ADDRESS_HASH,
    });
    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "2000000",
      "miniapp-demo:entry",
      "startGame",
      [
        { type: "Hash160", value: ADDRESS_HASH },
        { type: "Integer", value: "0" },
      ],
      { waitForEvent: "GameStarted", waitTimeoutMs: 30_000 },
    );
    expect(localStorage.getItem("neo:miniapp-demo:gamefi/miniapp-demo/ops/9")).toBe('[{"type":"tap"}]');
  });
});
