import { useWalletStore } from "@/lib/wallet/store";

type ProviderListener = () => void;

const STORAGE_KEY = "neo-wallet";

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

function installProvider(provider: ReturnType<typeof makeProvider>) {
  (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
    DapiProvider: provider,
  };
}

function resetStore() {
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
}

function readPersisted(): Record<string, unknown> {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw).toBeTruthy();
  return (JSON.parse(raw as string) as { state: Record<string, unknown> })
    .state;
}

describe("wallet store session restore", () => {
  // The store keeps singleton adapters that cache the first dAPI provider
  // they see, so every test must reuse (and reconfigure) the same object.
  const provider = makeProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    provider.getAccounts.mockReset();
    provider.authenticate.mockReset();
    localStorage.clear();
    installProvider(provider);
    resetStore();
  });

  afterEach(() => {
    useWalletStore.getState().disconnect();
  });

  it("persists the session identity (provider, address, network) but never the connected flag", () => {
    useWalletStore.setState({
      connected: true,
      address: "NPersistedAddress",
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
      balance: { neo: "1", gas: "2" },
    });

    const persisted = readPersisted();
    expect(persisted.provider).toBe("onegate");
    expect(persisted.address).toBe("NPersistedAddress");
    expect(persisted.publicKey).toBe("03abc");
    expect(persisted.network).toBe("testnet");
    expect(persisted).not.toHaveProperty("connected");
    expect(persisted).not.toHaveProperty("balance");
  });

  it("never persists the developer-key session identity", () => {
    useWalletStore.setState({
      connected: true,
      address: "NWifAddress",
      publicKey: "03wif",
      network: "testnet",
      provider: "wif",
    });

    const persisted = readPersisted();
    expect(persisted.provider).toBeNull();
    expect(persisted.address).toBe("");
    expect(persisted.publicKey).toBe("");
    expect(persisted.network).toBeNull();
  });

  it("silently reconnects through getAccounts without prompting", async () => {
    provider.getAccounts.mockResolvedValue([
      { hash: "0xrestored", address: "NRestoredAddress", isDefault: true },
    ]);

    useWalletStore.setState({
      provider: "nep21",
      address: "NRestoredAddress",
      network: "testnet",
    });

    await useWalletStore.getState().restoreSession();

    const state = useWalletStore.getState();
    expect(state.connected).toBe(true);
    expect(state.address).toBe("NRestoredAddress");
    expect(state.network).toBe("testnet");
    expect(state.restorePending).toBe(false);
    expect(state.loading).toBe(false);
    expect(provider.authenticate).not.toHaveBeenCalled();
  });

  it("keeps the persisted public key when the silent read does not expose one", async () => {
    provider.getAccounts.mockResolvedValue([
      { hash: "0xrestored", address: "NRestoredAddress", isDefault: true },
    ]);

    useWalletStore.setState({
      provider: "nep21",
      address: "NRestoredAddress",
      publicKey: "03persisted",
    });

    await useWalletStore.getState().restoreSession();

    expect(useWalletStore.getState().publicKey).toBe("03persisted");
  });

  it("falls back to restorePending when the wallet cannot be read silently", async () => {
    provider.getAccounts.mockRejectedValue(new Error("requires auth"));

    useWalletStore.setState({
      provider: "nep21",
      address: "NPendingAddress",
    });

    await useWalletStore.getState().restoreSession();

    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.restorePending).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.address).toBe("NPendingAddress");
    expect(provider.authenticate).not.toHaveBeenCalled();
  });

  it("does nothing without a persisted session identity", async () => {
    await useWalletStore.getState().restoreSession();

    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.restorePending).toBe(false);
  });

  it("restores automatically after rehydration from storage", async () => {
    provider.getAccounts.mockResolvedValue([
      { hash: "0xhydrated", address: "NHydratedAddress", isDefault: true },
    ]);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          provider: "nep21",
          address: "NHydratedAddress",
          publicKey: "",
          network: "testnet",
        },
        version: 0,
      }),
    );

    await useWalletStore.persist.rehydrate();
    // restoreSession is deferred past store creation via queueMicrotask
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = useWalletStore.getState();
    expect(state.connected).toBe(true);
    expect(state.address).toBe("NHydratedAddress");
    expect(provider.authenticate).not.toHaveBeenCalled();
  });

  it("clears the persisted identity on disconnect", () => {
    useWalletStore.setState({
      connected: true,
      address: "NPersistedAddress",
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
    });

    useWalletStore.getState().disconnect();

    const persisted = readPersisted();
    expect(persisted.provider).toBeNull();
    expect(persisted.address).toBe("");
    expect(useWalletStore.getState().restorePending).toBe(false);
  });
});
