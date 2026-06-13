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
    localStorage.clear();
    provider.getAccounts.mockResolvedValue([
      { hash: "0xaccount", address: "NBalanceAddress", isDefault: true },
    ]);
    provider.invoke.mockResolvedValue("0xtxid");
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };
    useWalletStore.setState({
      connected: false,
      address: "",
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
});
