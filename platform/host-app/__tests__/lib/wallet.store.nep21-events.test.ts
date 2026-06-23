import { getWalletAdapter, useWalletStore } from "@/lib/wallet/store";

type ProviderListener = () => void;

const makeBalance = (neo: string, gas: string) => {
  let call = 0;
  return jest.fn(async () => {
    call += 1;
    return { amount: call % 2 === 1 ? neo : gas };
  });
};

describe("wallet store NEP-21 events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWalletStore.setState({ provider: "nep21" });
    useWalletStore.getState().disconnect();
    window.history.replaceState({}, "", "/?network=testnet");
    localStorage.clear();
    delete (window as unknown as { Neo?: unknown }).Neo;
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

  it("refreshes the connected account after the standard accountchanged event", async () => {
    const listeners = new Map<string, ProviderListener>();
    const provider = {
      network: 894710606,
      getAccounts: jest.fn()
        .mockResolvedValueOnce([
          { hash: "0xinitial", address: "NInitialAddress", isDefault: true },
        ])
        .mockResolvedValueOnce([
          { hash: "0xchanged", address: "NChangedAddress", isDefault: true },
        ]),
      getBalance: makeBalance("1", "2"),
      signMessage: jest.fn(),
      invoke: jest.fn(),
      on: jest.fn((eventName: string, listener: ProviderListener) => {
        listeners.set(eventName, listener);
      }),
      removeListener: jest.fn(),
    };
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };

    await useWalletStore.getState().connect("nep21");
    expect(useWalletStore.getState().address).toBe("NInitialAddress");
    expect(useWalletStore.getState().network).toBe("testnet");

    listeners.get("accountchanged")?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useWalletStore.getState().address).toBe("NChangedAddress");
    expect(useWalletStore.getState().balance).toEqual({ neo: "1", gas: "2" });
  });

  it("disconnects instead of accepting an accountchanged event on the wrong network", async () => {
    const listeners = new Map<string, ProviderListener>();
    const provider = {
      network: 894710606,
      getAccounts: jest.fn()
        .mockResolvedValueOnce([
          { hash: "0xinitial", address: "NInitialAddress", isDefault: true },
        ])
        .mockResolvedValueOnce([
          { hash: "0xchanged", address: "NChangedAddress", isDefault: true },
        ]),
      getBalance: makeBalance("1", "2"),
      signMessage: jest.fn(),
      invoke: jest.fn(),
      on: jest.fn((eventName: string, listener: ProviderListener) => {
        listeners.set(eventName, listener);
      }),
      removeListener: jest.fn(),
    };
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };

    await useWalletStore.getState().connect("nep21");
    const balanceReadsAfterConnect = provider.getBalance.mock.calls.length;
    provider.network = 860833102;

    listeners.get("accountchanged")?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useWalletStore.getState()).toMatchObject({
      connected: false,
      address: "",
      network: null,
      provider: null,
      error: expect.stringMatching(/targets Neo N3 Testnet/),
    });
    expect(provider.getBalance).toHaveBeenCalledTimes(balanceReadsAfterConnect);
  });

  it("disconnects instead of refreshing balances after a networkchanged event to the wrong network", async () => {
    const listeners = new Map<string, ProviderListener>();
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xinitial", address: "NInitialAddress", isDefault: true },
      ]),
      getBalance: makeBalance("1", "2"),
      signMessage: jest.fn(),
      invoke: jest.fn(),
      on: jest.fn((eventName: string, listener: ProviderListener) => {
        listeners.set(eventName, listener);
      }),
      removeListener: jest.fn(),
    };
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };

    await useWalletStore.getState().connect("nep21");
    const balanceReadsAfterConnect = provider.getBalance.mock.calls.length;
    provider.network = 860833102;

    listeners.get("networkchanged")?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useWalletStore.getState()).toMatchObject({
      connected: false,
      address: "",
      network: null,
      provider: null,
      balance: null,
      error: expect.stringMatching(/targets Neo N3 Testnet/),
    });
    expect(provider.getBalance).toHaveBeenCalledTimes(balanceReadsAfterConnect);
  });

  it("rediscovers the provider after a failed wrong-network connection", async () => {
    const badProvider = {
      network: 860833102,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xbad", address: "NBadNetworkAddress", isDefault: true },
      ]),
      getBalance: makeBalance("1", "2"),
      signMessage: jest.fn(),
      invoke: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: badProvider,
    };

    await expect(useWalletStore.getState().connect("nep21")).rejects.toThrow(
      /targets Neo N3 Testnet/,
    );

    const goodProvider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xgood", address: "NGoodNetworkAddress", isDefault: true },
      ]),
      getBalance: makeBalance("3", "4"),
      signMessage: jest.fn(),
      invoke: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: goodProvider,
    };

    await useWalletStore.getState().connect("nep21");

    expect(useWalletStore.getState()).toMatchObject({
      connected: true,
      address: "NGoodNetworkAddress",
      network: "testnet",
      error: null,
    });
    expect(goodProvider.getAccounts).toHaveBeenCalled();
    expect(badProvider.getBalance).not.toHaveBeenCalled();
  });

  it("clears a removed persisted wallet provider without touching a missing adapter", async () => {
    useWalletStore.setState({
      connected: true,
      address: "NStalePersistedAddress",
      publicKey: "stale-public-key",
      network: "testnet",
      provider: "o3" as never,
      balance: { neo: "1", gas: "2" },
      loading: false,
      error: null,
    });

    expect(getWalletAdapter()).toBeNull();
    await expect(useWalletStore.getState().refreshBalance()).resolves.toBeUndefined();
    expect(useWalletStore.getState().provider).toBeNull();

    useWalletStore.setState({
      connected: true,
      address: "NStalePersistedAddress",
      publicKey: "stale-public-key",
      network: "testnet",
      provider: "o3" as never,
      balance: { neo: "1", gas: "2" },
      loading: false,
      error: null,
    });

    expect(() => useWalletStore.getState().disconnect()).not.toThrow();
    expect(useWalletStore.getState().provider).toBeNull();
  });
});
