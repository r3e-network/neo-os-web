/**
 * Wave-1 integration spec (framework-extraction plan §2): every standalone
 * module surface is reachable on the object built by createMiniAppFramework,
 * wired to the injected platform services, and the S11 manifest permission
 * gate default-allows hosts that deliver no declaration while enforcing a
 * present one (chain.invoke → "invoke:primary", oracle.* → "oracle:request").
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type {
  FrameworkAaSurface,
  FrameworkBusSurface,
  FrameworkClipboardSurface,
  FrameworkEventsSurface,
  FrameworkLifecycleSurface,
  FrameworkPermissionsSurface,
  FrameworkResourcesSurface,
  FrameworkShareSurface,
  FrameworkWalletSurface,
  MiniAppFrameworkContext,
  MiniAppFrameworkOptions,
} from "../index";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

const SOLVED_EVENT = {
  tx_hash: "0xabc",
  state: [
    { type: "Hash160", value: "0x1234" },
    { type: "Integer", value: "42" },
  ],
};

/** Minimal platform-EventBus stand-in (on/emit/off with unsubscribe return). */
function makeBus() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    on(event: string, handler: (payload: unknown) => void) {
      const set = handlers.get(event) ?? new Set<(payload: unknown) => void>();
      handlers.set(event, set);
      set.add(handler);
      return () => set.delete(handler);
    },
    emit(event: string, payload?: unknown) {
      for (const handler of [...(handlers.get(event) ?? [])]) handler(payload);
    },
    off(event: string, handler?: (payload: unknown) => void) {
      if (!handler) handlers.delete(event);
      else handlers.get(event)?.delete(handler);
    },
  };
}

/** LifecycleService stand-in that can replay unmount callbacks + cleanups. */
function makeLifecycleService() {
  const unmountCallbacks: Array<() => void> = [];
  const cleanups: Array<() => void> = [];
  const service = {
    onMount: vi.fn(),
    onUnmount: vi.fn((fn: () => void) => unmountCallbacks.push(fn)),
    onDataLoad: vi.fn(),
    reloadData: vi.fn(async () => {}),
    registerCleanup: vi.fn((fn: () => void) => cleanups.push(fn)),
    unmount: vi.fn(() => {
      for (let index = unmountCallbacks.length - 1; index >= 0; index -= 1) {
        unmountCallbacks[index]?.();
      }
      for (const cleanup of cleanups) cleanup();
    }),
  };
  return { service };
}

function makeFramework(setup: {
  launchContext?: Record<string, unknown>;
  options?: Omit<MiniAppFrameworkOptions, "appId">;
  balance?: boolean;
  aa?: boolean;
} = {}) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "150000000"),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => [SOLVED_EVENT]),
    listAllEvents: vi.fn(async () => [SOLVED_EVENT]),
    waitForEvent: vi.fn(async () => SOLVED_EVENT),
  };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const bus = makeBus();
  const lifecycle = makeLifecycleService();
  const balance = setup.balance
    ? {
        getBalance: vi.fn(async () => 12.5),
        getRawBalance: vi.fn(async () => 1_250_000_000n),
        getAllBalances: vi.fn(async () => ({ NEO: 3, GAS: 12.5 })),
        useBalance: vi.fn(() => ({
          balance: createObservable(12.5),
          loading: createObservable(false),
          refresh: async () => {},
          cleanup: () => {},
        })),
      }
    : undefined;
  const aa = setup.aa
    ? {
        checkSponsorship: vi.fn(async () => ({ eligible: true, remaining: 3 })),
        requestSponsorship: vi.fn(async () => ({ approved: true, txid: "0xspon" })),
        submitRelay: vi.fn(async () => ({ txid: "0xrelay" })),
        createSessionKey: vi.fn(async () => ({ created: true })),
      }
    : undefined;

  const ctx = {
    services: { chain, notify, events: bus, lifecycle: lifecycle.service, balance, aa },
    t: (key: string) => key,
    launchContext: setup.launchContext,
  } as unknown as MiniAppFrameworkContext;

  const app = createMiniAppFramework(ctx, { appId: "surface-integration", ...setup.options });
  return { app, chain, notify, bus, lifecycle, balance, aa };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (navigator as { clipboard?: unknown }).clipboard;
  localStorage.clear();
});

describe("Wave-1 surface reachability", () => {
  it("exposes every module surface with the exported types", () => {
    const { app } = makeFramework();

    // Compile-time contract: the mounted modules ARE the exported surface types.
    const events: FrameworkEventsSurface = app.events;
    const bus: FrameworkBusSurface = app.bus;
    const wallet: FrameworkWalletSurface = app.wallet;
    const lifecycle: FrameworkLifecycleSurface = app.lifecycle;
    const clipboard: FrameworkClipboardSurface = app.clipboard;
    const share: FrameworkShareSurface = app.share;
    const permissions: FrameworkPermissionsSurface = app.permissions;
    const resources: FrameworkResourcesSurface = app.resources;
    const aa: FrameworkAaSurface = app.aa;

    for (const surface of [
      events, bus, wallet, lifecycle, clipboard, share, permissions, resources, aa,
    ]) {
      expect(surface).toBeTruthy();
    }
    expect(app.oracle.dataFeed).toBeTruthy();
    // Lazy modules cache: repeated access returns the same instance.
    expect(app.events).toBe(app.events);
    expect(app.wallet).toBe(app.wallet);
  });
});

describe("app.events wiring (S4)", () => {
  it("delegates to the injected chain event methods and decodes slots", async () => {
    const { app, chain } = makeFramework();

    await expect(app.events.listAll("Solved")).resolves.toEqual([SOLVED_EVENT]);
    expect(chain.listAllEvents).toHaveBeenCalledWith("Solved");

    await expect(app.events.waitFor("0xabc", "Solved")).resolves.toEqual(SOLVED_EVENT);
    expect(chain.waitForEvent).toHaveBeenCalledWith("0xabc", "Solved", 45_000);

    expect(app.events.value(SOLVED_EVENT, 1)).toBe("42");
    expect(app.events.record(SOLVED_EVENT, ["player", "score"])).toEqual({
      player: "0x1234",
      score: "42",
    });
  });
});

describe("app.bus wiring (S4)", () => {
  it("delegates to the platform bus and auto-unsubscribes on lifecycle unmount", () => {
    const { app, bus, lifecycle } = makeFramework();
    const handler = vi.fn();

    app.bus.on("platform:tx:confirmed", handler);
    // Delegation proof: an emit on the INJECTED platform bus reaches the
    // app.bus subscriber (cross-service channels keep flowing).
    bus.emit("platform:tx:confirmed", { txid: "0x1" });
    expect(handler).toHaveBeenCalledWith({ txid: "0x1" });

    // app.lifecycle is the unmount authority: unmounting releases the handler.
    lifecycle.service.unmount();
    bus.emit("platform:tx:confirmed", { txid: "0x2" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("app.wallet wiring (S5)", () => {
  it("reads identity from the chain and balances via the balanceOf fallback", async () => {
    const { app, chain } = makeFramework();

    expect(app.wallet.isConnected()).toBe(true);
    expect(app.wallet.address()).toBe(ADDRESS);
    await expect(app.wallet.gas()).resolves.toBe(1.5);
    expect(chain.read).toHaveBeenCalledWith(
      "balanceOf",
      [expect.objectContaining({ type: "Hash160" })],
      expect.objectContaining({ scriptHash: expect.stringMatching(/^0x/) }),
    );
  });

  it("prefers the injected BalanceService and lifecycle-scopes observeBalance", async () => {
    const { app, balance, lifecycle } = makeFramework({ balance: true });

    await expect(app.wallet.balance("GAS")).resolves.toBe(12.5);
    expect(balance?.getBalance).toHaveBeenCalledWith("GAS", undefined);

    const handle = app.wallet.observeBalance("GAS");
    expect(balance?.useBalance).toHaveBeenCalledWith("GAS");
    // The handle's cleanup is registered with app.lifecycle for auto-release.
    expect(lifecycle.service.registerCleanup).toHaveBeenCalledTimes(1);
    expect(handle.balance.get()).toBe("12.5");
  });
});

describe("app.lifecycle wiring (S8)", () => {
  it("delegates registrations to the injected LifecycleService", async () => {
    const { app, lifecycle } = makeFramework();
    const onUnmount = vi.fn();

    app.lifecycle.onUnmount(onUnmount);
    expect(lifecycle.service.onUnmount).toHaveBeenCalledWith(onUnmount);

    await app.lifecycle.reload();
    expect(lifecycle.service.reloadData).toHaveBeenCalledTimes(1);
  });

  it("polls on an interval and disposes through the returned stopper", () => {
    vi.useFakeTimers();
    const { app } = makeFramework();
    const tick = vi.fn();

    const stop = app.lifecycle.poll(tick, 1_000);
    expect(tick).toHaveBeenCalledTimes(1); // immediate by default

    vi.advanceTimersByTime(1_000);
    expect(tick).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(5_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});

describe("app.clipboard + app.share wiring (S9)", () => {
  it("copies through the host clipboard and toasts via app.notify", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { app, notify } = makeFramework();

    await expect(app.clipboard.copy("gm")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("gm");
    // app.notify forwards (key, params) to the host service; params is unset.
    expect(notify.success).toHaveBeenCalledWith("copied", undefined);

    // copyAddress pulls the connected wallet address from the chain wiring.
    await expect(app.clipboard.copyAddress()).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
  });

  it("share.url falls back to the shared clipboard surface when Web Share is absent", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { app, notify } = makeFramework();

    await expect(app.share.url("https://example.com/x")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.com/x");
    expect(notify.success).toHaveBeenCalledWith("copied", undefined);
  });
});

describe("app.permissions gating (S11)", () => {
  it("default-allows when the host delivers NO manifest declaration", async () => {
    // The pre-S11 contract every existing test relies on: contexts built from
    // bare mock services (no launchContext.permissions) must not be bricked.
    const { app, chain } = makeFramework();

    expect(app.permissions.list()).toEqual([]);
    expect(app.permissions.has("invoke:primary")).toBe(true);
    expect(() => app.permissions.require("anything")).not.toThrow();

    await expect(app.chain.invoke("vote", [])).resolves.toMatchObject({ txid: "0xinvoke" });
    expect(chain.invoke).toHaveBeenCalledWith("vote", [], undefined);
    await expect(app.oracle.http({ url: "https://example.com" })).resolves.toMatchObject({
      kind: "oracle.http.request",
    });
  });

  it("blocks chain.invoke when a present declaration omits invoke:primary", async () => {
    const { app, chain } = makeFramework({
      launchContext: { permissions: ["oracle:request"] },
    });

    await expect(app.chain.invoke("vote", [])).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof FrameworkPermissionError && error.permission === "invoke:primary",
    );
    expect(chain.invoke).not.toHaveBeenCalled();
    // The granted oracle lane still works.
    await expect(app.oracle.http({ url: "https://example.com" })).resolves.toBeTruthy();
  });

  it("blocks oracle requests under the manifest boolean-record form", async () => {
    const { app } = makeFramework({
      launchContext: { permissions: { payments: true, oracle: false } },
    });

    expect(app.permissions.list()).toEqual(["payments"]);
    await expect(app.oracle.vrf({ consumer: "0xc", salt: "s" })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof FrameworkPermissionError && error.permission === "oracle:request",
    );
  });

  it("enforces an EMPTY declaration verbatim (deny everything gated)", async () => {
    const { app } = makeFramework({ launchContext: { permissions: [] } });

    await expect(app.chain.invoke("vote", [])).rejects.toBeInstanceOf(FrameworkPermissionError);
    await expect(app.oracle.seal({ purpose: "p", payload: {} })).rejects.toBeInstanceOf(
      FrameworkPermissionError,
    );
  });

  it("gates every chain write lane and mutating funds lane on invoke:primary", async () => {
    // Hardening round 2: the original S11 gate covered only chain.invoke +
    // the oracle lanes — write / invokeWithPayment / invokeMultiple and the
    // mutating funds.* lanes reached the host chain service ungated.
    const { app, chain, notify } = makeFramework({
      launchContext: { permissions: ["oracle:request"] },
    });

    const expectDenied = (fn: () => unknown) =>
      expect((async () => fn())()).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof FrameworkPermissionError && error.permission === "invoke:primary",
      );

    await expectDenied(() => app.chain.write({ operation: "op", args: [] }));
    await expectDenied(() => app.chain.invokeWithPayment("1", "m", "op", []));
    await expectDenied(() => app.chain.invokeMultiple([{ operation: "op", args: [] }]));
    await expectDenied(() =>
      app.funds.payAndCall({ operation: "op", args: [], memo: "m", amountGas: 1 }),
    );
    await expectDenied(() =>
      app.funds.prepayAndCall({ operation: "op", args: [], memo: "m", amountGas: 1 }),
    );
    await expectDenied(() =>
      app.funds.receiptPay({ operation: "op", args: [], receiptId: 1 }),
    );
    await expectDenied(() => app.funds.withdrawCredit());

    // Denials happen before the notify wrapper and before any wallet prompt.
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("keeps the extended lanes working when invoke:primary is granted", async () => {
    const { app, chain } = makeFramework({
      launchContext: { permissions: ["invoke:primary"] },
    });

    await expect(app.chain.write({ operation: "op", args: [] })).resolves.toMatchObject({
      txid: "0xinvoke",
    });
    await expect(app.chain.invokeWithPayment("1", "m", "op", [])).resolves.toMatchObject({
      txid: "0xpay",
    });
    await expect(
      app.funds.payAndCall({ operation: "op", args: [], memo: "m", amountGas: 1 }),
    ).resolves.toMatchObject({ txid: "0xpay" });
    await expect(app.funds.withdrawCredit()).resolves.toMatchObject({ txid: "0xinvoke" });
    // invokeMultiple passes the gate and fails only on the missing host lane.
    await expect(
      app.chain.invokeMultiple([{ operation: "op", args: [] }]),
    ).rejects.toSatisfy(
      (error: unknown) =>
        !(error instanceof FrameworkPermissionError) &&
        (error as Error).message.includes("invokeMultiple"),
    );
    expect(chain.invoke).toHaveBeenCalled();
    expect(chain.invokeWithPayment).toHaveBeenCalledTimes(2);
  });
});

describe("app.resources wiring (S12)", () => {
  it("resolves against the injected base and keeps injected token art byte-identical", () => {
    const { app } = makeFramework({
      options: {
        resources: {
          baseUrl: "https://cdn.example.com/app",
          tokenArt: { gasUrl: "/bundled/gas-icon.svg" },
        },
      },
    });

    expect(app.resources.url("assets/logo.png")).toBe(
      "https://cdn.example.com/app/assets/logo.png",
    );
    expect(app.resources.image("./assets/logo.png")).toBe(
      "https://cdn.example.com/app/assets/logo.png",
    );
    expect(app.resources.tokenArt.gasUrl).toBe("/bundled/gas-icon.svg");
    expect(app.resources.tokenArt.neoUrl).toBe(
      "https://cdn.example.com/app/assets/tokens/neo-icon.svg",
    );
  });
});

describe("app.aa wiring (S10)", () => {
  it("throws a typed capability error when the host has no AA lane", async () => {
    const { app } = makeFramework();

    expect(app.aa.available).toBe(false);
    await expect(app.aa.relay({ rawTransaction: "00" })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof FrameworkCapabilityError && error.capability === "aa",
    );
  });

  it("delegates to the injected AA service when present", async () => {
    const { app, aa } = makeFramework({ aa: true });

    expect(app.aa.available).toBe(true);
    await expect(app.aa.sponsorship.check()).resolves.toEqual({ eligible: true, remaining: 3 });
    expect(aa?.checkSponsorship).toHaveBeenCalledTimes(1);
    await expect(app.aa.relay({ rawTransaction: "00" })).resolves.toEqual({ txid: "0xrelay" });
  });
});

describe("app.oracle extensions wiring (S13)", () => {
  it("exposes dataFeed with capability degradation when unconfigured", async () => {
    const { app } = makeFramework();

    expect(app.oracle.dataFeed.available).toBe(false);
    await expect(app.oracle.dataFeed.price("BTC/USD")).rejects.toBeInstanceOf(
      FrameworkCapabilityError,
    );
    // Pure freshness math is reachable without any deps.
    const nowSec = Math.floor(Date.now() / 1000);
    expect(app.oracle.dataFeed.freshness({ recordTimestamp: nowSec }, 60_000).stale).toBe(false);
  });

  it("reports dataFeed available when the host injects feed config", () => {
    const { app } = makeFramework({
      options: {
        oracle: {
          dataFeed: { rpcUrl: "https://rpc.example", contractHash: "0xfeed" },
        },
      },
    });
    expect(app.oracle.dataFeed.available).toBe(true);
  });

  it("keeps oracle.seal callable while exposing the S13 client methods", async () => {
    const { app } = makeFramework();

    expect(typeof app.oracle.seal).toBe("function");
    const envelope = await app.oracle.seal({ purpose: "backup", payload: { a: 1 } });
    expect(envelope.kind).toBe("oracle.seal.envelope");

    expect(typeof app.oracle.seal.publicKey).toBe("function");
    expect(typeof app.oracle.seal.encrypt).toBe("function");
    expect(typeof app.oracle.seal.store).toBe("function");
  });
});
