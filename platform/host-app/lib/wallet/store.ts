import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  WalletAdapter,
  NeoLineAdapter,
  O3Adapter,
  OneGateAdapter,
  Auth0Adapter,
  WalletBalance,
  WalletNotInstalledError,
} from "./adapters";

export type WalletProvider = "neoline" | "o3" | "onegate" | "auth0";

interface WalletState {
  connected: boolean;
  address: string;
  publicKey: string;
  provider: WalletProvider | null;
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;
}

interface WalletActions {
  connect: (provider: WalletProvider) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

type WalletStore = WalletState & WalletActions;

const adapters: Record<WalletProvider, WalletAdapter> = {
  neoline: new NeoLineAdapter(),
  o3: new O3Adapter(),
  onegate: new OneGateAdapter(),
  auth0: new Auth0Adapter(),
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // State
      connected: false,
      address: "",
      publicKey: "",
      provider: null,
      balance: null,
      loading: false,
      error: null,

      // Actions
      connect: async (provider: WalletProvider) => {
        set({ loading: true, error: null });

        const adapter = adapters[provider];

        try {
          const account = await adapter.connect();
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
            publicKey: account.publicKey,
            provider,
            balance,
            loading: false,
          });
        } catch (err) {
          const message =
            err instanceof WalletNotInstalledError
              ? `Please install ${adapter.name} wallet`
              : `Connection failed: ${err}`;

          set({ loading: false, error: message });
        }
      },

      disconnect: () => {
        const { provider } = get();
        if (provider) {
          adapters[provider].disconnect();
        }

        set({
          connected: false,
          address: "",
          publicKey: "",
          provider: null,
          balance: null,
          error: null,
        });
      },

      refreshBalance: async () => {
        const { connected, address, provider } = get();
        if (!connected || !provider) return;

        try {
          const balance = await adapters[provider].getBalance(address);
          set({ balance });
        } catch {
          // Silently fail balance refresh
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "neo-wallet",
      partialize: (state) => ({
        provider: state.provider,
      }),
      // Clear auth0 provider on rehydration - auth0 requires fresh login
      onRehydrateStorage: () => (state) => {
        if (state?.provider === "auth0") {
          console.log("[WalletStore] Clearing stale auth0 provider on rehydration");
          state.provider = null;
        }
      },
    },
  ),
);

/** Get adapter for current provider */
export function getWalletAdapter(): WalletAdapter | null {
  const provider = useWalletStore.getState().provider;
  return provider ? adapters[provider] : null;
}

/** Available wallet options */
export const walletOptions = [
  { id: "neoline" as const, name: "NeoLine", icon: "https://neoline.io/favicon.ico" },
  { id: "o3" as const, name: "O3", icon: "https://o3.network/favicon.ico" },
  { id: "onegate" as const, name: "OneGate", icon: "https://onegate.space/favicon.ico" },
];
