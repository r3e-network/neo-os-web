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
    accountHash: "",
    publicKey: "",
    network: null,
    provider: null,
    balance: null,
    loading: false,
    error: null,
    restorePending: false,
  });
}

function writePersisted(state: Record<string, unknown>, version = 0) {
  // A different tab mutated localStorage; reflect that on disk so rehydrate()
  // (which reads the storage) sees the new value.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state, version }),
  );
}

/**
 * Emulate the cross-tab `storage` event a *different* tab would receive when
 * localStorage is mutated. jsdom does not synthesize this event itself, and it
 * is intentionally NOT delivered to the originating tab — which is exactly the
 * fan-out semantics our listener relies on.
 */
function dispatchWalletStorageEvent(previousState: Record<string, unknown>) {
  const newValue = localStorage.getItem(STORAGE_KEY);
  const event = new StorageEvent("storage", {
    key: STORAGE_KEY,
    newValue,
    oldValue: JSON.stringify({ state: previousState, version: 0 }),
    storageArea: localStorage,
    url: window.location.href,
  });
  window.dispatchEvent(event);
}

describe("wallet store cross-tab sync", () => {
  const provider = makeProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/?network=testnet");
    provider.getAccounts.mockReset();
    provider.network = 894710606;
    localStorage.clear();
    installProvider(provider);
    resetStore();
  });

  afterEach(() => {
    useWalletStore.getState().disconnect();
  });

  it("clears the in-memory connection when another tab disconnects", () => {
    const previousPersisted = {
      provider: "onegate",
      address: "NConnectedAddress",
      network: "testnet",
    };
    // This tab believes it is connected to a wallet.
    useWalletStore.setState({
      connected: true,
      address: "NConnectedAddress",
      accountHash: "0xconnected",
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
      balance: { neo: "1", gas: "2" },
    });

    // Another tab wiped the persisted identity (logout).
    writePersisted({
      provider: null,
      address: "",
      accountHash: "",
      publicKey: "",
      network: null,
    });
    dispatchWalletStorageEvent(previousPersisted);

    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.address).toBe("");
    expect(state.provider).toBeNull();
    expect(state.balance).toBeNull();
    expect(state.restorePending).toBe(false);
  });

  it("does not silently re-prompt the wallet after a cross-tab disconnect", () => {
    provider.getAccounts.mockResolvedValue([
      { hash: "0xrestored", address: "NConnectedAddress", isDefault: true },
    ]);
    useWalletStore.setState({
      connected: true,
      address: "NConnectedAddress",
      accountHash: "0xrestored",
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
    });

    writePersisted({ provider: null, address: "" });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: "NConnectedAddress",
    });

    // The user explicitly disconnected in another tab; this tab must NOT call
    // getAccounts/authenticate to silently restore behind their back.
    expect(provider.getAccounts).not.toHaveBeenCalled();
    expect(useWalletStore.getState().connected).toBe(false);
  });

  it("ignores storage events for unrelated keys", () => {
    useWalletStore.setState({
      connected: true,
      address: "NConnectedAddress",
      network: "testnet",
      provider: "onegate",
    });

    const event = new StorageEvent("storage", {
      key: "some-other-key",
      newValue: "whatever",
      oldValue: null,
      storageArea: localStorage,
      url: window.location.href,
    });
    window.dispatchEvent(event);

    expect(useWalletStore.getState().connected).toBe(true);
    expect(useWalletStore.getState().address).toBe("NConnectedAddress");
  });

  it("adopts the new identity when another tab switches accounts", () => {
    useWalletStore.setState({
      connected: true,
      address: "NOldAddress",
      accountHash: "0xold",
      publicKey: "03old",
      network: "testnet",
      provider: "onegate",
    });

    writePersisted({
      provider: "onegate",
      address: "NNewAddress",
      accountHash: "0xnew",
      publicKey: "03new",
      network: "testnet",
    });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: "NOldAddress",
      network: "testnet",
    });

    const state = useWalletStore.getState();
    // merge() forces connected=false / restorePending=false so the guard can
    // re-verify; the new persisted identity is adopted for display.
    expect(state.address).toBe("NNewAddress");
    expect(state.accountHash).toBe("0xnew");
    expect(state.provider).toBe("onegate");
    expect(state.connected).toBe(false);
    expect(state.restorePending).toBe(false);
  });

  it("does not tear down a local developer-key (WIF) session on a cross-tab write", () => {
    // WIF sessions are intentionally never persisted, so the shared storage
    // key never represents them. Another tab clearing/rewriting it must NOT
    // disconnect this tab's in-memory WIF session.
    useWalletStore.setState({
      connected: true,
      address: "NWifAddress",
      accountHash: "0xwif",
      publicKey: "03wif",
      network: "testnet",
      provider: "wif",
      balance: { neo: "1", gas: "2" },
    });

    writePersisted({ provider: null, address: "" });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: "NOtherTabAddress",
    });

    const state = useWalletStore.getState();
    expect(state.connected).toBe(true);
    expect(state.address).toBe("NWifAddress");
    expect(state.provider).toBe("wif");
    expect(state.balance).toEqual({ neo: "1", gas: "2" });
  });

  it("adopts the new network when another tab switches chains", () => {
    useWalletStore.setState({
      connected: true,
      address: "NConnectedAddress",
      accountHash: "0xconnected",
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
    });

    // Another tab switched the persisted wallet to mainnet.
    writePersisted({
      provider: "onegate",
      address: "NConnectedAddress",
      accountHash: "0xconnected",
      publicKey: "03abc",
      network: "mainnet",
    });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: "NConnectedAddress",
      network: "testnet",
    });

    const state = useWalletStore.getState();
    // The local connection is dropped (the wallet may no longer be usable on
    // this tab's target), but the network identity converges to the new chain
    // so the navbar / bridge / iframe stop trusting the stale testnet value.
    expect(state.connected).toBe(false);
    expect(state.network).toBe("mainnet");
    expect(state.provider).toBe("onegate");
    expect(state.address).toBe("NConnectedAddress");
  });

  it("ignores a storage write that leaves this tab's identity unchanged", () => {
    // This tab is already in the rehydrated/disconnected state matching the
    // snapshot; a redundant re-serialization in another tab must not churn.
    useWalletStore.setState({
      connected: false,
      address: "NKnownAddress",
      accountHash: "0xknown",
      publicKey: "03known",
      network: "testnet",
      provider: "onegate",
      restorePending: false,
    });
    const before = useWalletStore.getState();
    const listener = jest.fn();
    const unsubscribe = useWalletStore.subscribe(listener);

    try {
      writePersisted({
        provider: "onegate",
        address: "NKnownAddress",
        accountHash: "0xknown",
        publicKey: "03known",
        network: "testnet",
      });
      dispatchWalletStorageEvent({
        provider: "onegate",
        address: "NKnownAddress",
        network: "testnet",
      });

      const after = useWalletStore.getState();
      expect(listener).not.toHaveBeenCalled();
      expect(after).toMatchObject({
        connected: before.connected,
        address: before.address,
        accountHash: before.accountHash,
        publicKey: before.publicKey,
        network: before.network,
        provider: before.provider,
      });
    } finally {
      unsubscribe();
    }
  });

  it("clears a restore-pending resume chip when another tab disconnects", () => {
    // Page load restored a persisted identity that could not silently reconnect,
    // so the navbar shows a resume chip (restorePending: true). Another tab
    // logging out must drop that chip so this tab does not offer to resume a
    // session the user just ended elsewhere.
    useWalletStore.setState({
      connected: false,
      address: "NRestorePending",
      accountHash: "0xrestorepending",
      publicKey: "03rp",
      network: "testnet",
      provider: "onegate",
      restorePending: true,
    });

    writePersisted({ provider: null, address: "" });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: "NRestorePending",
      network: "testnet",
    });

    const state = useWalletStore.getState();
    expect(state.restorePending).toBe(false);
    expect(state.connected).toBe(false);
    expect(state.provider).toBeNull();
    expect(state.address).toBe("");
  });

  it("does not let a cross-tab event resurrect a connection this tab dropped", () => {
    // This tab is fully logged out (no identity). A storage write carrying a
    // *different* tab's connected identity must not silently connect this tab —
    // it only adopts the persisted identity as a re-verify candidate.
    useWalletStore.setState({
      connected: false,
      address: "",
      provider: null,
      network: null,
      restorePending: false,
    });

    writePersisted({
      provider: "onegate",
      address: "NOtherTabConnected",
      accountHash: "0xohtertab",
      publicKey: "03other",
      network: "testnet",
    });
    dispatchWalletStorageEvent({ provider: null, address: "" });

    const state = useWalletStore.getState();
    // The persisted identity is adopted for display/restore, but the tab is NOT
    // marked connected — it must still silently re-verify or surface a chip.
    expect(state.connected).toBe(false);
    expect(state.address).toBe("NOtherTabConnected");
    expect(state.provider).toBe("onegate");
  });
});
