import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isNeoNetwork } from "@/lib/neo-network";
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

/** Slow background poll so the navbar balance cannot drift for long. */
const BALANCE_REFRESH_INTERVAL_MS = 60_000;
/** Re-read the balance once a submitted transaction has had time to land in a block. */
const POST_INVOKE_BALANCE_REFRESH_DELAY_MS = 15_000;

let balanceRefreshInterval: ReturnType<typeof setInterval> | null = null;
let postInvokeRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function stopBalanceAutoRefresh() {
  if (balanceRefreshInterval !== null) {
    clearInterval(balanceRefreshInterval);
    balanceRefreshInterval = null;
  }
  if (postInvokeRefreshTimer !== null) {
    clearTimeout(postInvokeRefreshTimer);
    postInvokeRefreshTimer = null;
  }
}

function startBalanceAutoRefresh() {
  if (typeof window === "undefined") return;
  stopBalanceAutoRefresh();
  balanceRefreshInterval = setInterval(() => {
    void useWalletStore.getState().refreshBalance();
  }, BALANCE_REFRESH_INTERVAL_MS);
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
 * Wrap an adapter so every successful invoke/invokeMultiple schedules a
 * balance refresh. All invoke lanes resolve adapters through this module, so
 * this keeps the store balance truthful without touching the call sites.
 */
function withBalanceRefreshOnInvoke(adapter: WalletAdapter): WalletAdapter {
  const invoke = adapter.invoke.bind(adapter);
  adapter.invoke = async (params) => {
    const result = await invoke(params);
    scheduleBalanceRefreshAfterTransaction();
    return result;
  };
  const invokeMultiple = adapter.invokeMultiple?.bind(adapter);
  if (invokeMultiple) {
    adapter.invokeMultiple = async (params, signers) => {
      const result = await invokeMultiple(params, signers);
      scheduleBalanceRefreshAfterTransaction();
      return result;
    };
  }
  return adapter;
}

const adapters: Record<WalletProvider, WalletAdapter> = {
  nep21: withBalanceRefreshOnInvoke(new Nep21Adapter()),
  neoline: withBalanceRefreshOnInvoke(new NeoLineAdapter()),
  onegate: withBalanceRefreshOnInvoke(new OneGateAdapter()),
  wif: withBalanceRefreshOnInvoke(new WifAdapter()),
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
        const nextBalance = await adapter.getBalance(nextAccount.address);
        set({
          connected: true,
          address: nextAccount.address,
          publicKey: nextAccount.publicKey,
          network: nextNetwork,
          provider,
          balance: nextBalance,
          loading: false,
          error: null,
        });
      } catch (_e: unknown) {
        stopBalanceAutoRefresh();
        set({
          connected: false,
          address: "",
          publicKey: "",
          network: null,
          provider: null,
          balance: null,
          loading: false,
          restorePending: false,
          error: "Wallet account changed. Please reconnect.",
        });
      }
    }));
  }
  if (adapter.onNetworkChanged) {
    cleanups.push(adapter.onNetworkChanged(async () => {
      set({ network: await readWalletNetwork(adapter) });
      await get().refreshBalance();
    }));
  }
  walletEventCleanup = cleanups.length
    ? () => cleanups.forEach((cleanup) => cleanup())
    : null;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // State
      connected: false,
      address: "",
      publicKey: "",
      network: null,
      provider: null,
      balance: null,
      loading: false,
      error: null,
      restorePending: false,

      // Actions
      connect: async (provider: WalletProvider) => {
        set({ loading: true, error: null });

        const adapter = adapters[provider];
        clearWalletEventCleanup();

        try {
          if (provider === "wif") {
            throw new WalletConnectionError("Use connectWif() for developer key wallets");
          }
          const account = await adapter.connect();
          const network = await readWalletNetwork(adapter, account);
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
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
          const message =
            err instanceof WalletNotInstalledError
              ? `Please install ${adapter.name} wallet`
              : "Wallet connection failed";

          set({ loading: false, error: message });
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
          const account = await adapter.connectSilently();
          if (!account) {
            set({ loading: false, restorePending: true });
            return;
          }
          const network = await readWalletNetwork(adapter, account);
          const balance = await adapter.getBalance(account.address);

          clearWalletEventCleanup();
          set({
            connected: true,
            address: account.address,
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
        } catch (_e: unknown) {
          set({ loading: false, restorePending: true });
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

      disconnect: () => {
        const { provider } = get();
        clearWalletEventCleanup();
        stopBalanceAutoRefresh();
        getAdapter(provider)?.disconnect();

        set({
          connected: false,
          address: "",
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
            publicKey: "",
            network: null,
            provider: null,
            balance: null,
            restorePending: false,
          });
          return;
        }

        try {
          const balance = await adapter.getBalance(address);
          const network = await readWalletNetwork(adapter);
          set({ balance, network });
        } catch (_e: unknown) {
          console.warn("[wallet-store] refreshBalance failed:", _e instanceof Error ? _e.message : String(_e));
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "neo-wallet",
      // Persist the session identity (never secrets) so a reload can resume
      // the connection instead of forcing a fresh wallet popup.
      partialize: (state) => {
        const persistable = isPersistableWalletProvider(state.provider);
        return {
          provider: persistable ? state.provider : null,
          address: persistable ? state.address : "",
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
