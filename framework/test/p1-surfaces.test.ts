/**
 * RFC P1 surfaces landed with the P0 wave:
 * - P1-2 `app.game.rules(config)` — standard game-rules helpers.
 * - P1-3 `guestBlocked` action option + `actions.registerConnectWallet`.
 * - P1-7 `platform.params` / `platform.network` / `platform.explorer`.
 */
import { describe, expect, it, vi } from "vitest";
import { createGameRules, DEFAULT_SETTLEMENT_GRACE_MS } from "../game-rules";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function makeApp(appId: string, launch: Record<string, unknown> = {}) {
  const setStatus = vi.fn();
  const notify = { success: vi.fn(), error: vi.fn() };
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => {
      chain.address.set(ADDRESS);
      return ADDRESS;
    }),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0x1", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0x2", success: true })),
  };
  const ctx = {
    services: { chain, notify },
    t: (key: string) => `t:${key}`,
    setStatus,
    launchContext: { appId, ...launch },
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId }), chain, notify, setStatus };
}

describe("P1-2 game.rules factory", () => {
  const rules = createGameRules({
    difficulties: {
      easy: { stakeFixed8: 2_000_000n, label: "Easy" },
      hard: { stakeFixed8: 20_000_000n, meta: { targetSeq: 16 } },
    },
    payout: { basePct: 100, undoPenaltyPct: 30, maxUndos: 3 },
  });

  it("ruleOf returns the difficulty row (label defaults to the key)", () => {
    expect(rules.ruleOf("easy")).toEqual({ stakeFixed8: 2_000_000n, label: "Easy", meta: {} });
    expect(rules.ruleOf("hard")).toEqual({
      stakeFixed8: 20_000_000n,
      label: "hard",
      meta: { targetSeq: 16 },
    });
    expect(() => rules.ruleOf("nope")).toThrow(/unknown difficulty/);
  });

  it("statusOf delegates to rewardGameStatusOf", () => {
    expect(rules.statusOf(1)).toBe("dealt");
    expect(rules.statusOf("2")).toBe("solved");
    expect(rules.statusOf(99)).toBe("unknown");
  });

  it("payout math: undo penalty clamped to maxUndos and floor 0, bigint-exact", () => {
    expect(rules.rewardPctAfterUndos(0)).toBe(100);
    expect(rules.rewardPctAfterUndos(2)).toBe(40);
    expect(rules.rewardPctAfterUndos(10)).toBe(10); // clamped at maxUndos=3
    expect(rules.payoutFixed8(10_000_000n, 40)).toBe(4_000_000n);
    expect(rules.payoutFixed8(1n, 33)).toBe(0n); // bigint floor
  });

  it("settlement grace: default constant + release check", () => {
    expect(rules.settlementGraceMs).toBe(DEFAULT_SETTLEMENT_GRACE_MS);
    const finishedAt = 1_000_000;
    expect(rules.canReleaseExpiredGame({ finishedAt }, finishedAt + 1)).toBe(false);
    expect(
      rules.canReleaseExpiredGame({ finishedAt }, finishedAt + DEFAULT_SETTLEMENT_GRACE_MS + 1),
    ).toBe(true);
    expect(rules.canReleaseExpiredGame({ finishedAt: 0 }, Date.now())).toBe(false);
  });

  it("display helpers delegate to the shared format implementations", () => {
    expect(rules.gasDisplay(2_000_000n)).toBe("0.02");
    expect(rules.formatClock(83_000)).toBe("01:23");
  });

  it("is exposed as app.game.rules", () => {
    const { app } = makeApp("p1-rules");
    const appRules = app.game.rules({
      difficulties: { easy: { stakeFixed8: 1n } },
      payout: { basePct: 100 },
    });
    expect(appRules.ruleOf("easy").stakeFixed8).toBe(1n);
  });
});

describe("P1-3 guestBlocked action option", () => {
  it("blocks the handler in guest mode with the standard status copy (no throw)", async () => {
    const { app, setStatus } = makeApp("p1-guest-blocked");
    const handler = vi.fn(async () => "ran");
    app.actions.register("withdraw", handler, { guestBlocked: true });

    app.mode.set("guest");
    await expect(app.actions.run("withdraw")).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("t:guestModeBlocked", "warning");

    app.mode.set("gamefi");
    await expect(app.actions.run("withdraw")).resolves.toBe("ran");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports a custom statusKey and leaves unguarded actions alone", async () => {
    const { app, setStatus } = makeApp("p1-guest-key");
    app.actions.register("save", async () => "saved", {
      guestBlocked: { statusKey: "guestSaveBlocked" },
    });
    app.actions.register("read", async () => "read-ok");

    app.mode.set("guest");
    await expect(app.actions.run("save")).resolves.toBeUndefined();
    expect(setStatus).toHaveBeenCalledWith("t:guestSaveBlocked", "warning");
    await expect(app.actions.run("read")).resolves.toBe("read-ok"); // ungated
  });
});

describe("P1-3 registerConnectWallet", () => {
  it("registers the standard body: ensureWallet → error-isolated refresh fan-out → toast", async () => {
    const { app, chain, notify } = makeApp("p1-connect");
    const reloadA = vi.fn(async () => {});
    const reloadB = vi.fn(async () => Promise.reject(new Error("one loader down")));
    app.actions.registerConnectWallet({
      refresh: [reloadA, reloadB],
      successKey: "walletConnected",
    });

    await expect(app.actions.run("connectWallet")).resolves.toBe(ADDRESS);
    expect(chain.ensureWallet).toHaveBeenCalledTimes(1);
    expect(reloadA).toHaveBeenCalledTimes(1);
    expect(reloadB).toHaveBeenCalledTimes(1); // its failure never broke the flow
    expect(notify.success).toHaveBeenCalledWith("walletConnected");
  });

  it("collapses double-clicks via the run lane single-flight", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { app, chain } = makeApp("p1-connect-flight");
    let release!: (value: string) => void;
    chain.ensureWallet.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        release = resolve;
      }),
    );
    app.actions.registerConnectWallet();
    const first = app.actions.run("connectWallet");
    await expect(app.actions.run("connectWallet")).resolves.toBeUndefined(); // dropped
    release(ADDRESS);
    await first;
    expect(chain.ensureWallet).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("P1-7 platform params/network/explorer", () => {
  it("params decodes launch params through per-field coercers", () => {
    const { app } = makeApp("p1-params", { params: { tab: "history", round: "4" } });
    const decoded = app.platform.params({
      tab: (raw) => raw ?? "overview",
      round: (raw) => Number(raw ?? 0),
      missing: (raw) => raw ?? "default",
    });
    expect(decoded).toEqual({ tab: "history", round: 4, missing: "default" });
  });

  it("network reads the launch context and defaults to testnet", () => {
    expect(makeApp("p1-net-default").app.platform.network()).toEqual({
      name: "testnet",
      isMainnet: false,
    });
    expect(makeApp("p1-net-main", { network: "MainNet" }).app.platform.network()).toEqual({
      name: "mainnet",
      isMainnet: true,
    });
  });

  it("explorer builds the canonical Dora URLs for the active network", () => {
    const { app } = makeApp("p1-explorer", { network: "mainnet" });
    expect(app.platform.explorer.tx("0xabc")).toBe(
      "https://dora.coz.io/transaction/neo3/mainnet/0xabc",
    );
    expect(app.platform.explorer.address(ADDRESS)).toBe(
      `https://dora.coz.io/address/neo3/mainnet/${ADDRESS}`,
    );
    expect(app.platform.explorer.contract("0xdef")).toBe(
      "https://dora.coz.io/contract/neo3/mainnet/0xdef",
    );
    expect(app.platform.explorer.tx("")).toBe("");

    const testnet = makeApp("p1-explorer-testnet");
    expect(testnet.app.platform.explorer.tx("0xabc")).toBe(
      "https://dora.coz.io/transaction/neo3/testnet/0xabc",
    );
  });
});
