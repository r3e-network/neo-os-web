import { create } from "zustand";
import { persist } from "zustand/middleware";
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
}

interface WalletActions {
  connect: (provider: WalletProvider) => Promise<void>;
  connectWif: (wif: string) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

type WalletStore = WalletState & WalletActions;

const adapters: Record<WalletProvider, WalletAdapter> = {
  nep21: new Nep21Adapter(),
  neoline: new NeoLineAdapter(),
  onegate: new OneGateAdapter(),
  wif: new WifAdapter(),
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
          });

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
                set({
                  connected: false,
                  address: "",
                  publicKey: "",
                  network: null,
                  provider: null,
                  balance: null,
                  loading: false,
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
        } catch (err) {
          const message =
            err instanceof WalletNotInstalledError
              ? `Please install ${adapter.name} wallet`
              : "Wallet connection failed";

          set({ loading: false, error: message });
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
          });
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
            error: message,
          });
        }
      },

      disconnect: () => {
        const { provider } = get();
        clearWalletEventCleanup();
        getAdapter(provider)?.disconnect();

        set({
          connected: false,
          address: "",
          publicKey: "",
          network: null,
          provider: null,
          balance: null,
          error: null,
        });
      },

      refreshBalance: async () => {
        const { connected, address, provider } = get();
        if (!connected || !provider) return;

        const adapter = getAdapter(provider);
        if (!adapter) {
          set({
            connected: false,
            address: "",
            publicKey: "",
            network: null,
            provider: null,
            balance: null,
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
      partialize: (state) => ({
        provider: isPersistableWalletProvider(state.provider)
          ? state.provider
          : null,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WalletState> | undefined;
        return {
          ...currentState,
          ...persisted,
          provider: isPersistableWalletProvider(persisted?.provider)
            ? persisted.provider
            : null,
        };
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
