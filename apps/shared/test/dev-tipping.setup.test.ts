import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../../../framework";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BOB = "NUuJw4C4XJFzxAvSZnFTfsNoWZytmQKXQP";

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
    totalDonatedBase: observable("0"),
    registryStatus: observable("ready"),
    activityStatus: observable("ready"),
    readError: observable(""),
    isLoading: observable(false),
    isRegistering: observable(false),
    isWithdrawing: observable(false),
    address: observable(""),
    runtimeStatus: observable("ready"),
    runtimeCompatible: observable(true),
    activeNetwork: observable("testnet"),
    runtimeChecksum: observable<number | null>(2_483_335_541),
    runtimeError: observable(""),
    pendingTip: observable(null),
    lastReceipt: observable(null),
    actionNotice: observable(""),
    recoveryStorageHealthy: observable(true),
    isRecovering: observable(false),
    walletSendTip: vi.fn(),
    walletRegister: vi.fn(),
    walletWithdraw: vi.fn(),
    loadDevelopers: vi.fn(),
    loadRecentTips: vi.fn(),
    developerIdOf: vi.fn(),
    creditOf: vi.fn(),
    loadWalletSnapshot: vi.fn(),
    walletRefreshRuntime: vi.fn(),
    walletRestoreRecovery: vi.fn(),
    walletRecoverTip: vi.fn(),
    walletClearRecovery: vi.fn(),
  };

  const reset = () => {
    state.definition = null;
    state.developers = observable<Array<Record<string, unknown>>>([]);
    state.recentTips = observable<Array<Record<string, unknown>>>([]);
    state.totalDonated = observable(0);
    state.totalDonatedBase = observable("0");
    state.registryStatus = observable("ready");
    state.activityStatus = observable("ready");
    state.readError = observable("");
    state.isLoading = observable(false);
    state.isRegistering = observable(false);
    state.isWithdrawing = observable(false);
    state.address = observable("");
    state.runtimeStatus = observable("ready");
    state.runtimeCompatible = observable(true);
    state.activeNetwork = observable("testnet");
    state.runtimeChecksum = observable<number | null>(2_483_335_541);
    state.runtimeError = observable("");
    state.pendingTip = observable(null);
    state.lastReceipt = observable(null);
    state.actionNotice = observable("");
    state.recoveryStorageHealthy = observable(true);
    state.isRecovering = observable(false);
    state.walletSendTip = vi.fn();
    state.walletRegister = vi.fn();
    state.walletWithdraw = vi.fn();
    state.loadDevelopers = vi.fn(async () => {
      state.developers.set([
        {
          id: 1,
          name: "Neo Core",
          role: "Protocol",
          wallet: ALICE,
          totalTips: 1.2,
          balance: 0.4,
          balanceBase: "40000000",
        },
        {
          id: 2,
          name: "Wallet Tools",
          role: "SDK",
          wallet: BOB,
          totalTips: 0.3,
          balance: 0,
          balanceBase: "0",
        },
      ]);
      state.totalDonated.set(1.5);
      state.totalDonatedBase.set("150000000");
    });
    state.loadRecentTips = vi.fn(async () => {
      state.recentTips.set([
        { id: "tip-1", amount: "0.50" },
        { id: "tip-2", amount: "0.25" },
        { id: "tip-3", amount: "0.75" },
      ]);
    });
    state.developerIdOf = vi.fn(async () => 0);
    state.creditOf = vi.fn(async () => 0);
    state.loadWalletSnapshot = vi.fn(async (address: string) => ({
      developerId: await state.developerIdOf(address),
      creditBase: BigInt(await state.creditOf(address)),
      gasBalanceBase: 500_000_000n,
    }));
    state.walletRefreshRuntime = vi.fn(async () => null);
    state.walletRestoreRecovery = vi.fn(async () => undefined);
    state.walletRecoverTip = vi.fn(async () => "none");
    state.walletClearRecovery = vi.fn();
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
    totalDonatedBase: harness.state.totalDonatedBase,
    isLoading: harness.state.isLoading,
    registryStatus: harness.state.registryStatus,
    activityStatus: harness.state.activityStatus,
    readError: harness.state.readError,
    formatNum: (value: number | string) => Number(value).toFixed(2),
    loadDevelopers: harness.state.loadDevelopers,
    loadRecentTips: harness.state.loadRecentTips,
    developerIdOf: harness.state.developerIdOf,
    creditOf: harness.state.creditOf,
    loadWalletSnapshot: harness.state.loadWalletSnapshot,
  })),
}));

vi.mock("../../dev-tipping/src/composables/useDevTippingWallet", () => ({
  useDevTippingWallet: vi.fn(() => ({
    isLoading: harness.state.isLoading,
    isRegistering: harness.state.isRegistering,
    isWithdrawing: harness.state.isWithdrawing,
    isRecovering: harness.state.isRecovering,
    address: harness.state.address,
    runtimeStatus: harness.state.runtimeStatus,
    runtimeCompatible: harness.state.runtimeCompatible,
    activeNetwork: harness.state.activeNetwork,
    runtimeChecksum: harness.state.runtimeChecksum,
    runtimeError: harness.state.runtimeError,
    pendingOperation: harness.state.pendingTip,
    pendingTip: harness.state.pendingTip,
    lastReceipt: harness.state.lastReceipt,
    actionNotice: harness.state.actionNotice,
    recoveryStorageHealthy: harness.state.recoveryStorageHealthy,
    refreshRuntime: harness.state.walletRefreshRuntime,
    restoreRecovery: harness.state.walletRestoreRecovery,
    clearRecoveryView: harness.state.walletClearRecovery,
    recoverPendingOperation: harness.state.walletRecoverTip,
    recoverPendingTip: harness.state.walletRecoverTip,
    sendTip: harness.state.walletSendTip,
    registerDeveloper: harness.state.walletRegister,
    withdrawTips: harness.state.walletWithdraw,
    withdrawCredit: harness.state.walletWithdraw,
  })),
}));

function buildCtx(registeredActions: Map<string, (...args: unknown[]) => Promise<unknown>>) {
  const ctx = {
    os: {},
    services: {
      chain: {
        address: harness.state.address,
        contractAddress: { get: () => "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec", subscribe: () => () => undefined },
        ensureWallet: vi.fn(async () => harness.state.address.get()),
        detectNetwork: vi.fn(async () => "neo-n3-testnet"),
      },
      events: {},
      notify: { guard: vi.fn(async (fn: () => Promise<unknown>) => fn()) },
    },
    launchContext: { network: "testnet" },
    t: (key: string) => key,
    registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      registeredActions.set(key, handler);
    },
  };
  return {
    ...ctx,
    framework: createMiniAppFramework(ctx as never, { appId: "miniapp-dev-tipping" }),
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
    expect(setupResult.state.totalDonatedDisplay?.get()).toBe("1.5 GAS");
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
    harness.state.walletSendTip = vi.fn(async () => "confirmed");
    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    await setup?.(buildCtx(registeredActions));

    const sendTip = registeredActions.get("sendTip");
    // The on-chain tip() stores only devId, amount and anonymous — the message
    // and tipper-name inputs were removed, so the action takes (devId, amount,
    // anonymous) and forwards empty strings for the composable's UI-only message
    // and name parameters.
    const ok = await sendTip?.(1, "0.5", false);

    expect(harness.state.walletSendTip).toHaveBeenCalledTimes(1);
    expect(harness.state.walletSendTip).toHaveBeenCalledWith(
      1,
      "0.5",
      "",
      "",
      false,
    );
    expect(ok).toBe("confirmed");
  });

  it("surfaces the connected wallet's developer id and claimable balance", async () => {
    harness.state.address = (() => {
      let value = ALICE;
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

    expect(harness.state.developerIdOf).toHaveBeenCalledWith(ALICE);
    expect(setupResult.state.myDeveloperId?.get()).toBe(1);
    // Developer 1's claimable balance from the loaded registry.
    expect(setupResult.state.myClaimableBalance?.get()).toBe(0.4);
  });

  it("does not let an old-wallet snapshot overwrite a newer wallet refresh", async () => {
    harness.state.address.set(ALICE);
    let resolveOld: ((value: { developerId: number; creditBase: bigint; gasBalanceBase: bigint }) => void) | undefined;
    const oldSnapshot = new Promise<{ developerId: number; creditBase: bigint; gasBalanceBase: bigint }>(
      (resolve) => { resolveOld = resolve; },
    );
    harness.state.loadWalletSnapshot = vi.fn(async (address: string) => {
      if (address === ALICE) return oldSnapshot;
      return { developerId: 2, creditBase: 20_000_000n, gasBalanceBase: 900_000_000n };
    });

    const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const setup = harness.state.definition?.setup;
    const result = await setup?.(buildCtx(registeredActions));
    const setupResult = result as {
      state: Record<string, { get: () => unknown }>;
      loadData: () => Promise<void>;
    };

    const first = setupResult.loadData();
    await vi.waitFor(() => expect(harness.state.loadWalletSnapshot).toHaveBeenCalledWith(ALICE));
    harness.state.address.set(BOB);
    const second = setupResult.loadData();
    await second;
    resolveOld?.({ developerId: 1, creditBase: 0n, gasBalanceBase: 100_000_000n });
    await first;

    expect(setupResult.state.myDeveloperId?.get()).toBe(2);
    expect(setupResult.state.gasBalanceDisplay?.get()).toBe("9 GAS");
    expect(setupResult.state.myCreditDisplay?.get()).toBe("0.2 GAS");
  });
});
