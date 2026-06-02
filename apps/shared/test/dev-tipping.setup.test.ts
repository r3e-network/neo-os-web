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
    address: observable(""),
    walletSendTip: vi.fn(),
    loadDevelopers: vi.fn(),
    loadRecentTips: vi.fn(),
  };

  const reset = () => {
    state.definition = null;
    state.developers = observable<Array<Record<string, unknown>>>([]);
    state.recentTips = observable<Array<Record<string, unknown>>>([]);
    state.totalDonated = observable(0);
    state.isLoading = observable(false);
    state.address = observable("");
    state.walletSendTip = vi.fn();
    state.loadDevelopers = vi.fn(async () => {
      state.developers.set([
        { id: 1, name: "Neo Core", role: "Protocol", totalTips: 1.2 },
        { id: 2, name: "Wallet Tools", role: "SDK", totalTips: 0.3 },
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
  })),
}));

vi.mock("../../dev-tipping/src/composables/useDevTippingWallet", () => ({
  useDevTippingWallet: vi.fn(() => ({
    isLoading: harness.state.isLoading,
    address: harness.state.address,
    sendTip: harness.state.walletSendTip,
  })),
}));

describe("Dev Tipping setup", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.reset();
    await import("../../dev-tipping/src/main");
  });

  it("syncs derived stats after loading developers and recent tips", async () => {
    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    expect(setup).toBeTypeOf("function");

    const result = await setup?.({
      os: { storage: {}, payment: {} },
      services: {
        chain: {},
        events: {},
        notify: { guard: vi.fn(async (fn: () => Promise<unknown>) => fn()) },
      },
      t: (key: string) => key,
      registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        registeredActions.set(key, handler);
      },
    });

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
  });
});
