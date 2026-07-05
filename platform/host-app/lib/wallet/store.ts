import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  assertWalletNetworkMatchesTarget,
  isNeoNetwork,
} from "@/lib/neo-network";
import { getActiveRpcNetwork } from "@/lib/rpc-helpers";
import {
  WalletAdapter,
  WalletAccount,
  NeoWalletNetwork,
  Nep21Adapter,
  NeoLineAdapter,
  OneGateAdapter,
  WifAdapter,
  WalletBalance,
  WalletConnectionError,
  WalletNotInstalledError,
  WalletTransactionError,
} from "./adapters";

export type WalletProvider = "nep21" | "neoline" | "onegate" | "wif";
export type ConnectableWalletProvider = "onegate" | "neoline";
type WalletOptionId = "nep21" | ConnectableWalletProvider;

export type WalletOption = {
  id: WalletOptionId;
  name: string;
  icon: string;
  description: string;
  protocol: "NEP-21";
  recommended?: boolean;
};

interface WalletState {
  connected: boolean;
  address: string;
  accountHash: string;
  publicKey: string;
  network: NeoWalletNetwork | null;
  provider: WalletProvider | null;
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;
  /**
   * True when a persisted wallet session exists but could not be restored
   * silently — the UI shows a "reconnect" affordance instead of pretending
   * the user is logged out.
   */
  restorePending: boolean;
}

interface WalletActions {
  connect: (provider: WalletProvider) => Promise<void>;
  connectWif: (wif: string) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  /**
   * Attempt to silently resume the persisted wallet session after a page
   * load (adapter `getAccounts` without prompting). Falls back to
   * `restorePending` so the navbar can offer a one-click resume.
   */
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

type WalletStore = WalletState & WalletActions;

export function selectConnectedWalletAddress(state: {
  connected: boolean;
  address: string;
}): string {
  return state.connected && state.address ? state.address : "";
}

/** Slow background poll so the navbar balance cannot drift for long. */
const BALANCE_REFRESH_INTERVAL_MS = 60_000;
/** Re-read the balance once a submitted transaction has had time to land in a block. */
const POST_INVOKE_BALANCE_REFRESH_DELAY_MS = 15_000;
/** Wallet extensions can hang without rejecting when locked or half-injected. */
const WALLET_CONNECT_TIMEOUT_MS = 12_000;
const WALLET_BALANCE_TIMEOUT_MS = 10_000;

let balanceRefreshInterval: ReturnType<typeof setInterval> | null = null;
let postInvokeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let balanceVisibilityListener: (() => void) | null = null;

function isDocumentHidden(): boolean {
  return (
    typeof document !== "undefined" && document.visibilityState === "hidden"
  );
}

function stopBalanceAutoRefresh() {
  if (balanceRefreshInterval !== null) {
    clearInterval(balanceRefreshInterval);
    balanceRefreshInterval = null;
  }
  if (postInvokeRefreshTimer !== null) {
    clearTimeout(postInvokeRefreshTimer);
    postInvokeRefreshTimer = null;
  }
  if (balanceVisibilityListener !== null && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", balanceVisibilityListener);
  }
  balanceVisibilityListener = null;
}

function withWalletTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new WalletConnectionError(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function startBalanceAutoRefresh() {
  if (typeof window === "undefined") return;
  stopBalanceAutoRefresh();
  // Pause the poll while the tab is backgrounded so a hidden navbar does not
  // keep hitting the RPC every minute; refresh once it becomes visible again
  // (mirrors the activity-feed visibility gating).
  balanceRefreshInterval = setInterval(() => {
    if (isDocumentHidden()) return;
    void useWalletStore.getState().refreshBalance();
  }, BALANCE_REFRESH_INTERVAL_MS);
  if (typeof document !== "undefined") {
    balanceVisibilityListener = () => {
      if (isDocumentHidden()) return;
      void useWalletStore.getState().refreshBalance();
    };
    document.addEventListener("visibilitychange", balanceVisibilityListener);
  }
}

/**
 * Refresh the balance right after a wallet transaction is accepted and again
 * once it should be included in a block, so the navbar GAS figure tracks
 * spends from every invoke lane (host console, embedded bridge, transfers).
 */
function scheduleBalanceRefreshAfterTransaction() {
  void useWalletStore.getState().refreshBalance();
  if (typeof window === "undefined") return;
  if (postInvokeRefreshTimer !== null) clearTimeout(postInvokeRefreshTimer);
  postInvokeRefreshTimer = setTimeout(() => {
    postInvokeRefreshTimer = null;
    void useWalletStore.getState().refreshBalance();
  }, POST_INVOKE_BALANCE_REFRESH_DELAY_MS);
}

/**
 * Wrap an adapter so signing and transaction paths use a fresh wallet-network
 * read. Successful transaction paths also schedule balance refreshes.
 */
function withWalletOperationGuards(adapter: WalletAdapter): WalletAdapter {
  const signMessage = adapter.signMessage.bind(adapter);
  adapter.signMessage = async (message) => {
    await assertAdapterNetworkFresh(adapter);
    return signMessage(message);
  };
  const invoke = adapter.invoke.bind(adapter);
  adapter.invoke = async (params) => {
    await assertAdapterNetworkFresh(adapter);
    const result = await invoke(params);
    scheduleBalanceRefreshAfterTransaction();
    return result;
  };
  const invokeMultiple = adapter.invokeMultiple?.bind(adapter);
  if (invokeMultiple) {
    adapter.invokeMultiple = async (params, signers) => {
      await assertAdapterNetworkFresh(adapter);
      const result = await invokeMultiple(params, signers);
      scheduleBalanceRefreshAfterTransaction();
      return result;
    };
  }
  const send = adapter.send?.bind(adapter);
  if (send) {
    adapter.send = async (asset, amount, to, from) => {
      await assertAdapterNetworkFresh(adapter);
      const result = await send(asset, amount, to, from);
      scheduleBalanceRefreshAfterTransaction();
      return result;
    };
  }
  return adapter;
}

const adapters: Record<WalletProvider, WalletAdapter> = {
  nep21: withWalletOperationGuards(new Nep21Adapter()),
  neoline: withWalletOperationGuards(new NeoLineAdapter()),
  onegate: withWalletOperationGuards(new OneGateAdapter()),
  wif: withWalletOperationGuards(new WifAdapter()),
};

const walletProviderIds = new Set<WalletProvider>([
  "nep21",
  "neoline",
  "onegate",
  "wif",
]);

let walletEventCleanup: (() => void) | null = null;

function clearWalletEventCleanup() {
  walletEventCleanup?.();
  walletEventCleanup = null;
}

function isWalletProvider(provider: unknown): provider is WalletProvider {
  return typeof provider === "string" && walletProviderIds.has(provider as WalletProvider);
}

function isPersistableWalletProvider(
  provider: unknown,
): provider is Exclude<WalletProvider, "wif"> {
  return provider === "nep21" || provider === "neoline" || provider === "onegate";
}

function getAdapter(provider: WalletProvider | string | null): WalletAdapter | null {
  return isWalletProvider(provider) ? adapters[provider] : null;
}

async function readWalletNetwork(
  adapter: WalletAdapter,
  account?: WalletAccount,
): Promise<NeoWalletNetwork | null> {
  if (account?.network) return account.network;
  if (!adapter.getNetwork) return null;
  try {
    return await adapter.getNetwork();
  } catch (_e: unknown) {
    return null;
  }
}

function getWalletTargetNetwork(): NeoWalletNetwork {
  return getActiveRpcNetwork();
}

async function assertAdapterNetworkFresh(adapter: WalletAdapter): Promise<void> {
  const previous = useWalletStore.getState().network;
  const latest = await readWalletNetwork(adapter);
  if (latest !== previous) {
    useWalletStore.setState({ network: latest });
  }
  const target = getWalletTargetNetwork();
  if (!latest) {
    throw new WalletTransactionError(
      `Wallet network is not verified. Reconnect your wallet on ${target} before submitting.`,
    );
  }
  if (latest !== target) {
    throw new WalletTransactionError(
      `Wallet is on ${latest} but this app targets ${target}. Switch wallet network before submitting.`,
    );
  }
  if (latest === previous) return;
  throw new WalletTransactionError(
    `Wallet network changed to ${latest}. Review the selected network and submit again.`,
  );
}

function assertWalletNetworkForConnect(
  network: NeoWalletNetwork | null,
): void {
  assertWalletNetworkMatchesTarget(network, getWalletTargetNetwork());
}

function walletConnectErrorMessage(
  adapter: WalletAdapter,
  err: unknown,
): string {
  if (err instanceof WalletNotInstalledError) {
    return `${adapter.name} was not detected. Install or enable the extension, allow site access for this page, then reload and try again.`;
  }
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("reject") || lower.includes("denied") || lower.includes("cancel")) {
    return "Wallet connection was rejected. Please try again and approve the request in your wallet.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return `${adapter.name} did not respond. Unlock the extension, confirm it has site access for this page, reload, then try again.`;
  }
  return raw || "Wallet connection failed";
}

function isWalletNetworkGuardError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  return (
    lower.includes("wallet is on") ||
    lower.includes("wallet network is not verified") ||
    lower.includes("switch wallet network")
  );
}

/**
 * Subscribe to adapter account/network events and keep the store in sync.
 * Shared by the interactive connect flow and the silent session restore.
 */
function attachAdapterListeners(
  adapter: WalletAdapter,
  provider: WalletProvider,
  set: (state: Partial<WalletStore>) => void,
  get: () => WalletStore,
): void {
  const cleanups: Array<() => void> = [];
  if (adapter.onAccountChanged) {
    cleanups.push(adapter.onAccountChanged(async () => {
      try {
        const nextAccount = await adapter.connect();
        const nextNetwork = await readWalletNetwork(adapter, nextAccount);
        assertWalletNetworkForConnect(nextNetwork);
        const nextBalance = await adapter.getBalance(nextAccount.address);
        set({
          connected: true,
          address: nextAccount.address,
          accountHash: nextAccount.accountHash || "",
          publicKey: nextAccount.publicKey,
          network: nextNetwork,
          provider,
          balance: nextBalance,
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        const message = walletConnectErrorMessage(adapter, err);
        void adapter.disconnect();
        stopBalanceAutoRefresh();
        set({
          connected: false,
          address: "",
          accountHash: "",
          publicKey: "",
          network: null,
          provider: null,
          balance: null,
          loading: false,
          restorePending: false,
          error: message || "Wallet account changed. Please reconnect.",
        });
      }
    }));
  }
  if (adapter.onNetworkChanged) {
    cleanups.push(adapter.onNetworkChanged(async () => {
      try {
        const nextNetwork = await readWalletNetwork(adapter);
        assertWalletNetworkForConnect(nextNetwork);
        set({ network: nextNetwork, error: null });
        await get().refreshBalance();
      } catch (err: unknown) {
        const message = walletConnectErrorMessage(adapter, err);
        void adapter.disconnect();
        stopBalanceAutoRefresh();
        set({
          connected: false,
          address: "",
          accountHash: "",
          publicKey: "",
          network: null,
          provider: null,
          balance: null,
          loading: false,
          restorePending: false,
          error: message || "Wallet network changed. Please reconnect.",
        });
      }
    }));
  }
  walletEventCleanup = cleanups.length
    ? () => cleanups.forEach((cleanup) => cleanup())
    : null;
}

const WALLET_STORAGE_KEY = "neo-wallet";

function parsePersistedWalletSnapshot(
  raw: string | null,
): Partial<WalletState> | null | undefined {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown };
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed.state && typeof parsed.state === "object"
      ? (parsed.state as Partial<WalletState>)
      : undefined;
  } catch (_err: unknown) {
    return undefined;
  }
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // State
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

      // Actions
      connect: async (provider: WalletProvider) => {
        const previous = get();
        set({ loading: true, error: null });

        const adapter = adapters[provider];
        clearWalletEventCleanup();

        try {
          if (provider === "wif") {
            throw new WalletConnectionError("Use connectWif() for developer key wallets");
          }
          const account = await withWalletTimeout(
            adapter.connect(),
            WALLET_CONNECT_TIMEOUT_MS,
            "Wallet connection timed out.",
          );
          const network = await readWalletNetwork(adapter, account);
          assertWalletNetworkForConnect(network);
          const balance = await withWalletTimeout(
            adapter.getBalance(account.address),
            WALLET_BALANCE_TIMEOUT_MS,
            "Wallet balance read timed out.",
          );

          set({
            connected: true,
            address: account.address,
            accountHash: account.accountHash || "",
            publicKey: account.publicKey,
            network,
            provider,
            balance,
            loading: false,
            restorePending: false,
          });

          attachAdapterListeners(adapter, provider, set, get);
          startBalanceAutoRefresh();
        } catch (err) {
          const message = walletConnectErrorMessage(adapter, err);
          const preservePendingIdentity =
            previous.provider === provider &&
            Boolean(previous.address) &&
            !previous.connected;

          void adapter.disconnect();
          stopBalanceAutoRefresh();
          set({
            connected: false,
            address: preservePendingIdentity ? previous.address : "",
            accountHash: preservePendingIdentity ? previous.accountHash : "",
            publicKey: preservePendingIdentity ? previous.publicKey : "",
            network: preservePendingIdentity ? previous.network : null,
            provider: preservePendingIdentity ? provider : null,
            balance: null,
            loading: false,
            restorePending: preservePendingIdentity,
            error: message,
          });
          throw new WalletConnectionError(message);
        }
      },

      restoreSession: async () => {
        const { connected, loading, provider, address } = get();
        if (connected || loading) return;
        if (!isPersistableWalletProvider(provider) || !address) return;

        const adapter = adapters[provider];
        if (typeof adapter.connectSilently !== "function") {
          set({ restorePending: true });
          return;
        }

        set({ loading: true });
        try {
          const account = await withWalletTimeout(
            adapter.connectSilently(),
            WALLET_CONNECT_TIMEOUT_MS,
            "Wallet session restore timed out.",
          );
          if (!account) {
            set({ loading: false, restorePending: true });
            return;
          }
          const network = await readWalletNetwork(adapter, account);
          assertWalletNetworkForConnect(network);
          const balance = await withWalletTimeout(
            adapter.getBalance(account.address),
            WALLET_BALANCE_TIMEOUT_MS,
            "Wallet balance read timed out.",
          );

          clearWalletEventCleanup();
          set({
            connected: true,
            address: account.address,
            accountHash: account.accountHash || "",
            // Silent dAPI reads do not expose the public key; keep the one
            // captured during the original interactive connect.
            publicKey: account.publicKey || get().publicKey,
            network,
            provider,
            balance,
            loading: false,
            restorePending: false,
            error: null,
          });

          attachAdapterListeners(adapter, provider, set, get);
          startBalanceAutoRefresh();
        } catch (err: unknown) {
          void adapter.disconnect();
          set({
            loading: false,
            restorePending: true,
            error: isWalletNetworkGuardError(err)
              ? walletConnectErrorMessage(adapter, err)
              : get().error,
          });
        }
      },

      connectWif: async (wif: string) => {
        set({ loading: true, error: null });
        clearWalletEventCleanup();

        const adapter = adapters.wif as WifAdapter;

        try {
          const account = await adapter.connectWithWif(wif);
          const network = await readWalletNetwork(adapter, account);
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
            accountHash: account.accountHash || "",
            publicKey: account.publicKey,
            network,
            provider: "wif",
            balance,
            loading: false,
            restorePending: false,
          });
          startBalanceAutoRefresh();
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err);
          const lower = raw.toLowerCase();
          const message = lower.includes("invalid wif") || lower.includes("invalid developer key")
            ? "Invalid developer key. Use a funded test wallet key and never paste production keys."
            : "Developer key connection failed";

          set({
            connected: false,
            address: "",
            accountHash: "",
            publicKey: "",
            network: null,
            provider: null,
            balance: null,
            loading: false,
            restorePending: false,
            error: message,
          });
          throw new WalletConnectionError(message);
        }
      },

      disconnect: () => {
        const { provider } = get();
        clearWalletEventCleanup();
        stopBalanceAutoRefresh();
        getAdapter(provider)?.disconnect();

        set({
          connected: false,
          address: "",
          accountHash: "",
          publicKey: "",
          network: null,
          provider: null,
          balance: null,
          restorePending: false,
          error: null,
        });
      },

      refreshBalance: async () => {
        const { connected, address, provider } = get();
        if (!connected || !provider) return;

        const adapter = getAdapter(provider);
        if (!adapter) {
          stopBalanceAutoRefresh();
          set({
            connected: false,
            address: "",
            accountHash: "",
            publicKey: "",
            network: null,
            provider: null,
            balance: null,
            restorePending: false,
          });
          return;
        }

        try {
          const network = await readWalletNetwork(adapter);
          assertWalletNetworkForConnect(network);
          const balance = await adapter.getBalance(address);
          set({ balance, network, error: null });
        } catch (err: unknown) {
          console.warn("[wallet-store] refreshBalance failed:", err instanceof Error ? err.message : String(err));
          if (!isWalletNetworkGuardError(err)) return;
          const message = walletConnectErrorMessage(adapter, err);
          void adapter.disconnect();
          stopBalanceAutoRefresh();
          set({
            connected: false,
            address: "",
            accountHash: "",
            publicKey: "",
            network: null,
            provider: null,
            balance: null,
            loading: false,
            restorePending: false,
            error: message,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: WALLET_STORAGE_KEY,
      // Persist the session identity (never secrets) so a reload can resume
      // the connection instead of forcing a fresh wallet popup.
      partialize: (state) => {
        const persistable = isPersistableWalletProvider(state.provider);
        return {
          provider: persistable ? state.provider : null,
          address: persistable ? state.address : "",
          accountHash: persistable ? state.accountHash : "",
          publicKey: persistable ? state.publicKey : "",
          network: persistable ? state.network : null,
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WalletState> | undefined;
        const provider = isPersistableWalletProvider(persisted?.provider)
          ? persisted.provider
          : null;
        return {
          ...currentState,
          provider,
          address: provider && typeof persisted?.address === "string" ? persisted.address : "",
          accountHash: provider && typeof persisted?.accountHash === "string" ? persisted.accountHash : "",
          publicKey: provider && typeof persisted?.publicKey === "string" ? persisted.publicKey : "",
          network: provider && isNeoNetwork(persisted?.network) ? persisted.network : null,
          // A persisted session is only a candidate until restoreSession
          // either reconnects silently or downgrades it to a resume chip.
          connected: false,
          balance: null,
          restorePending: false,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state || typeof window === "undefined") return;
        // Defer past store creation so the silent reconnect runs with the
        // fully constructed store (and never blocks first paint).
        queueMicrotask(() => {
          void state.restoreSession();
        });
      },
    },
  ),
);

/**
 * Keep the in-memory wallet store in sync with another tab that mutated the
 * persisted session.
 *
 * Zustand's `persist` writes to localStorage but only reads it back on the
 * originating tab's page load. Without this listener, a disconnect / account
 * switch / network change performed in tab A leaves tab B (and every miniapp
 * embedded in it) rendering a stale "connected" state — its `useWalletStore`
 * never learns the persisted identity changed. The `storage` event fires in
 * every *other* same-origin tab when localStorage is written, which is exactly
 * the cross-tab fan-out the navbar, action console, and embedded bridge need to
 * converge on the same wallet truth.
 *
 * Two cases:
 *  - Another tab cleared the persisted identity (disconnect): drop the local
 *    connection immediately. We deliberately do NOT call restoreSession here,
 *    because the user just signed out — silently re-prompting would be wrong.
 *  - Another tab changed the persisted identity (connect / account switch):
 *    synchronously adopt the persisted identity so the navbar/balance converge,
 *    then let the guard surface a reconnect only if the silent read is unavailable.
 */
let crossTabSyncInstalled = false;

function installCrossTabWalletSync(): void {
  if (crossTabSyncInstalled || typeof window === "undefined") return;
  crossTabSyncInstalled = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== WALLET_STORAGE_KEY) return;
    const snapshot = parsePersistedWalletSnapshot(event.newValue);
    if (typeof snapshot === "undefined") return;
    const store = useWalletStore.getState();
    // A developer-key (WIF) session is intentionally never persisted, so the
    // shared storage key never describes it. Ignore cross-tab writes while this
    // tab holds a live in-memory WIF session — otherwise a disconnect in another
    // tab would wrongly tear down this tab's local dev-key connection.
    if (store.provider === "wif") return;
    const provider = isPersistableWalletProvider(snapshot?.provider)
      ? snapshot.provider
      : null;
    // If nothing about the shared identity actually changed for this tab, do not
    // churn the store (and re-fire bridge/balance side effects) on unrelated
    // storage writes that happened to re-serialize the same snapshot.
    const identityUnchanged =
      store.provider === provider &&
      store.address === (provider && typeof snapshot?.address === "string" ? snapshot.address : "") &&
      store.network === (provider && isNeoNetwork(snapshot?.network) ? snapshot.network : null);
    if (identityUnchanged && !store.connected && !store.restorePending) return;
    if (store.connected || store.restorePending) {
      clearWalletEventCleanup();
      stopBalanceAutoRefresh();
    }
    useWalletStore.setState({
      connected: false,
      address: provider && typeof snapshot?.address === "string" ? snapshot.address : "",
      accountHash:
        provider && typeof snapshot?.accountHash === "string"
          ? snapshot.accountHash
          : "",
      publicKey:
        provider && typeof snapshot?.publicKey === "string" ? snapshot.publicKey : "",
      network: provider && isNeoNetwork(snapshot?.network) ? snapshot.network : null,
      provider,
      balance: null,
      loading: false,
      restorePending: false,
      error: null,
    });
  });
}

installCrossTabWalletSync();

/** Get adapter for current provider */
export function getWalletAdapter(): WalletAdapter | null {
  const provider = useWalletStore.getState().provider;
  return getAdapter(provider);
}

/** Available wallet options */
export const walletOptions: WalletOption[] = [
  {
    id: "onegate",
    name: "OneGate",
    icon: "/wallets/onegate.svg",
    description: "OneGate wallet for Neo N3 account connection and contract calls.",
    protocol: "NEP-21",
    recommended: true,
  },
  {
    id: "neoline",
    name: "NeoLine",
    icon: "/wallets/neoline.svg",
    description: "NeoLine browser extension for Neo N3 accounts and contract signing.",
    protocol: "NEP-21",
  },
];

export const walletOptionsById: Partial<Record<WalletProvider, WalletOption>> =
  Object.fromEntries([
    ...walletOptions.map((option) => [option.id, option] as const),
    [
      "nep21",
      {
        id: "nep21",
        name: "Detected Neo Wallet",
        icon: "/wallets/onegate.svg",
        description: "Uses the Neo dAPI signing protocol when a compatible wallet is injected.",
        protocol: "NEP-21",
      } satisfies WalletOption,
    ],
  ]);
