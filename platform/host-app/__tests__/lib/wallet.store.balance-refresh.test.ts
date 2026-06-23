import { getWalletAdapter, useWalletStore } from "@/lib/wallet/store";

type ProviderListener = () => void;

function makeProvider() {
  return {
    network: 894710606,
    getAccounts: jest.fn(),
    getBalance: jest.fn(async () => ({ amount: "1" })),
    authenticate: jest.fn(),
    signMessage: jest.fn(),
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn((_event: string, _listener: ProviderListener) => {}),
    removeListener: jest.fn(),
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe("wallet store balance freshness", () => {
  // The store keeps singleton adapters that cache the first dAPI provider
  // they see, so every test must reuse (and reconfigure) the same object.
  const provider = makeProvider();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    provider.network = 894710606;
    window.history.replaceState({}, "", "/");
    localStorage.clear();
    provider.getAccounts.mockResolvedValue([
      { hash: "0xaccount", address: "NBalanceAddress", isDefault: true },
    ]);
    provider.invoke.mockResolvedValue("0xtxid");
    provider.send.mockResolvedValue("0xsendtxid");
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };
    useWalletStore.setState({
      connected: false,
      address: "",
      accountHash: "",
      publicKey: "",
      network: null,
      provider: null,
      balance: null,
      loading: false,
      error: null,
      restorePending: false,
    });
  });

  afterEach(() => {
    useWalletStore.getState().disconnect();
    delete process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK;
    jest.useRealTimers();
  });

  it("refreshes the balance after a successful invoke and again once the tx can be included", async () => {
    await useWalletStore.getState().connect("nep21");
    expect(useWalletStore.getState().connected).toBe(true);

    const baseline = provider.getBalance.mock.calls.length;

    const adapter = getWalletAdapter();
    expect(adapter).not.toBeNull();
    await adapter!.invoke({
      scriptHash: "0xcontract",
      operation: "transfer",
      args: [],
    });
    await flushMicrotasks();

    const afterInvoke = provider.getBalance.mock.calls.length;
    expect(afterInvoke).toBeGreaterThan(baseline);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(provider.getBalance.mock.calls.length).toBeGreaterThan(afterInvoke);
  });

  it("refreshes the balance after a successful invokeMultiple", async () => {
    await useWalletStore.getState().connect("nep21");
    const baseline = provider.getBalance.mock.calls.length;

    const adapter = getWalletAdapter();
    await adapter!.invokeMultiple!(
      [{ scriptHash: "0xcontract", operation: "transfer", args: [] }],
      undefined,
    );
    await flushMicrotasks();

    expect(provider.getBalance.mock.calls.length).toBeGreaterThan(baseline);
  });

  it("refreshes the balance after a successful send", async () => {
    await useWalletStore.getState().connect("nep21");
    const baseline = provider.getBalance.mock.calls.length;

    const adapter = getWalletAdapter();
    await adapter!.send!("GAS", "100000000", "NRecipientAddress");
    await flushMicrotasks();

    expect(provider.getBalance.mock.calls.length).toBeGreaterThan(baseline);
  });

  it("rejects a transaction if the wallet network changed before signing", async () => {
    await useWalletStore.getState().connect("nep21");
    expect(useWalletStore.getState().network).toBe("testnet");
    provider.network = 860833102;

    const adapter = getWalletAdapter();
    await expect(
      adapter!.invoke({
        scriptHash: "0xcontract",
        operation: "transfer",
        args: [],
      }),
    ).rejects.toThrow(/targets testnet/);

    expect(useWalletStore.getState().network).toBe("mainnet");
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("fails closed before refreshing balances when the wallet network no longer matches the page", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    await useWalletStore.getState().connect("nep21");
    const balanceReadsAfterConnect = provider.getBalance.mock.calls.length;
    provider.network = 860833102;

    try {
      await useWalletStore.getState().refreshBalance();

      expect(useWalletStore.getState()).toMatchObject({
        connected: false,
        address: "",
        network: null,
        provider: null,
        balance: null,
        error: expect.stringMatching(/targets Neo N3 Testnet/),
      });
      expect(provider.getBalance).toHaveBeenCalledTimes(balanceReadsAfterConnect);
      expect(warnSpy).toHaveBeenCalledWith(
        "[wallet-store] refreshBalance failed:",
        expect.stringMatching(/targets Neo N3 Testnet/),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("uses the current page network before the deployment default", async () => {
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "mainnet";
    window.history.replaceState({}, "", "/miniapps/demo?network=testnet");
    provider.network = 894710606;
    await useWalletStore.getState().connect("nep21");

    const adapter = getWalletAdapter();
    await expect(
      adapter!.invoke({
        scriptHash: "0xcontract",
        operation: "transfer",
        args: [],
      }),
    ).resolves.toMatchObject({ txid: "0xtxid" });
    expect(provider.invoke).toHaveBeenCalled();
  });

  it("rejects an explicit connection when the wallet starts on the wrong network", async () => {
    provider.network = 860833102;
    await expect(
      useWalletStore.getState().connect("nep21"),
    ).rejects.toThrow(/targets Neo N3 Testnet/);

    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toMatch(/targets Neo N3 Testnet/);
    expect(provider.getBalance).not.toHaveBeenCalled();
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("rejects message signing when the wallet switches to the wrong network", async () => {
    await useWalletStore.getState().connect("nep21");
    provider.network = 860833102;

    const adapter = getWalletAdapter();
    await expect(adapter!.signMessage("login")).rejects.toThrow(
      /targets testnet/,
    );
    expect(provider.signMessage).not.toHaveBeenCalled();
  });

  it("rejects a transaction when the wallet network becomes unverified", async () => {
    await useWalletStore.getState().connect("nep21");
    provider.network = undefined as unknown as number;

    const adapter = getWalletAdapter();
    await expect(
      adapter!.invoke({
        scriptHash: "0xcontract",
        operation: "transfer",
        args: [],
      }),
    ).rejects.toThrow(/network is not verified/);
    expect(useWalletStore.getState().network).toBeNull();
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("polls the balance on a slow background interval while connected", async () => {
    await useWalletStore.getState().connect("nep21");
    const baseline = provider.getBalance.mock.calls.length;

    await jest.advanceTimersByTimeAsync(60_000);
    const afterFirstTick = provider.getBalance.mock.calls.length;
    expect(afterFirstTick).toBeGreaterThan(baseline);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(provider.getBalance.mock.calls.length).toBeGreaterThan(
      afterFirstTick,
    );
  });

  it("stops the background poll after disconnect", async () => {
    await useWalletStore.getState().connect("nep21");
    useWalletStore.getState().disconnect();

    const baseline = provider.getBalance.mock.calls.length;
    await jest.advanceTimersByTimeAsync(180_000);
    expect(provider.getBalance.mock.calls.length).toBe(baseline);
  });

  it("skips the background poll while the tab is hidden", async () => {
    const setVisibility = (state: "visible" | "hidden") =>
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      });
    try {
      await useWalletStore.getState().connect("nep21");
      const baseline = provider.getBalance.mock.calls.length;

      setVisibility("hidden");
      await jest.advanceTimersByTimeAsync(60_000);
      // Hidden tab: the interval tick is a no-op.
      expect(provider.getBalance.mock.calls.length).toBe(baseline);

      // Becoming visible again fires an immediate refresh.
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await flushMicrotasks();
      expect(provider.getBalance.mock.calls.length).toBeGreaterThan(baseline);
    } finally {
      setVisibility("visible");
    }
  });
});
