import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  function observable<T>(initial: T) {
    let value = initial;
    return {
      get: () => value,
      set: (next: T) => {
        value = next;
      },
      subscribe: () => () => undefined,
    };
  }

  const state = {
    definition: null as null | { setup?: (ctx: Record<string, unknown>) => unknown },
    developers: observable<Array<Record<string, unknown>>>([]),
    recentTips: observable<Array<Record<string, unknown>>>([]),
    totalDonated: observable(0),
    isLoading: observable(false),
    isRegistering: observable(false),
    isWithdrawing: observable(false),
    address: observable(""),
    walletSendTip: vi.fn(),
    walletRegister: vi.fn(),
    walletWithdraw: vi.fn(),
    loadDevelopers: vi.fn(),
    loadRecentTips: vi.fn(),
    developerIdOf: vi.fn(),
  };

  const reset = () => {
    state.definition = null;
    state.developers = observable<Array<Record<string, unknown>>>([]);
    state.recentTips = observable<Array<Record<string, unknown>>>([]);
    state.totalDonated = observable(0);
    state.isLoading = observable(false);
    state.isRegistering = observable(false);
    state.isWithdrawing = observable(false);
    state.address = observable("");
    state.walletSendTip = vi.fn();
    state.walletRegister = vi.fn();
    state.walletWithdraw = vi.fn();
    state.loadDevelopers = vi.fn(async () => {
      state.developers.set([
        {
          id: 1,
          name: "Neo Core",
          role: "Protocol",
          wallet: "Nwallet1",
          totalTips: 1.2,
          balance: 0.4,
        },
        {
          id: 2,
          name: "Wallet Tools",
          role: "SDK",
          wallet: "Nwallet2",
          totalTips: 0.3,
          balance: 0,
        },
      ]);
      state.totalDonated.set(1.5);
    });
    state.loadRecentTips = vi.fn(async () => {
      state.recentTips.set([
        { id: "tip-1", amount: "0.50" },
        { id: "tip-2", amount: "0.25" },
        { id: "tip-3", amount: "0.75" },
      ]);
    });
    state.developerIdOf = vi.fn(async () => 0);
  };

  reset();
  return { state, reset };
});

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("../react")>("@shared/react");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.state.definition = definition as { setup?: (ctx: Record<string, unknown>) => unknown };
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("../../dev-tipping/src/composables/useDevTippingStats", () => ({
  useDevTippingStats: vi.fn(() => ({
    developers: harness.state.developers,
    recentTips: harness.state.recentTips,
    totalDonated: harness.state.totalDonated,
    isLoading: harness.state.isLoading,
    formatNum: (value: number | string) => Number(value).toFixed(2),
    loadDevelopers: harness.state.loadDevelopers,
    loadRecentTips: harness.state.loadRecentTips,
    developerIdOf: harness.state.developerIdOf,
  })),
}));

vi.mock("../../dev-tipping/src/composables/useDevTippingWallet", () => ({
  useDevTippingWallet: vi.fn(() => ({
    isLoading: harness.state.isLoading,
    isRegistering: harness.state.isRegistering,
    isWithdrawing: harness.state.isWithdrawing,
    address: harness.state.address,
    sendTip: harness.state.walletSendTip,
    registerDeveloper: harness.state.walletRegister,
    withdrawTips: harness.state.walletWithdraw,
  })),
}));

function buildCtx(registeredActions: Map<string, (...args: unknown[]) => Promise<unknown>>) {
  return {
    os: {},
    services: {
      chain: {},
      events: {},
      notify: { guard: vi.fn(async (fn: () => Promise<unknown>) => fn()) },
    },
    t: (key: string) => key,
    registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      registeredActions.set(key, handler);
    },
  };
}

describe("Dev Tipping setup", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.reset();
    await import("../../dev-tipping/src/main");
  });

  it("syncs derived stats from chain reads after loading developers and recent tips", async () => {
    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    expect(setup).toBeTypeOf("function");

    const result = await setup?.(buildCtx(registeredActions));

    const setupResult = result as {
      state: Record<string, { get: () => unknown }>;
      loadData: () => Promise<void>;
    };

    await setupResult.loadData();

    expect(harness.state.loadDevelopers).toHaveBeenCalledTimes(1);
    expect(harness.state.loadRecentTips).toHaveBeenCalledTimes(1);
    expect(setupResult.state.developerCount?.get()).toBe(2);
    expect(setupResult.state.totalDonatedDisplay?.get()).toBe("1.50 GAS");
    expect(setupResult.state.recentTipCount?.get()).toBe(3);
    // No wallet connected → not registered, no claimable balance surfaced.
    expect(setupResult.state.myDeveloperId?.get()).toBe(0);
    expect(setupResult.state.myClaimableBalance?.get()).toBe(0);
  });

  it("registers the sendTip, registerDeveloper, and withdrawTips actions", async () => {
    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    await setup?.(buildCtx(registeredActions));

    expect(registeredActions.has("sendTip")).toBe(true);
    expect(registeredActions.has("registerDeveloper")).toBe(true);
    expect(registeredActions.has("withdrawTips")).toBe(true);
  });

  it("dispatches sendTip to the wallet composable and reports success", async () => {
    harness.state.walletSendTip = vi.fn(async () => true);
    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    await setup?.(buildCtx(registeredActions));

    const sendTip = registeredActions.get("sendTip");
    const ok = await sendTip?.(1, "0.5", "thanks", "Ada", false);

    expect(harness.state.walletSendTip).toHaveBeenCalledTimes(1);
    expect(harness.state.walletSendTip).toHaveBeenCalledWith(
      1,
      "0.5",
      "thanks",
      "Ada",
      false,
      expect.any(Function),
    );
    expect(ok).toBe(true);
  });

  it("surfaces the connected wallet's developer id and claimable balance", async () => {
    harness.state.address = (() => {
      let value = "Nwallet1";
      return {
        get: () => value,
        set: (next: string) => {
          value = next;
        },
        subscribe: () => () => undefined,
      };
    })();
    harness.state.developerIdOf = vi.fn(async () => 1);

    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    const result = await setup?.(buildCtx(registeredActions));
    const setupResult = result as {
      state: Record<string, { get: () => unknown }>;
      loadData: () => Promise<void>;
    };

    await setupResult.loadData();

    expect(harness.state.developerIdOf).toHaveBeenCalledWith("Nwallet1");
    expect(setupResult.state.myDeveloperId?.get()).toBe(1);
    // Developer 1's claimable balance from the loaded registry.
    expect(setupResult.state.myClaimableBalance?.get()).toBe(0.4);
  });
});
