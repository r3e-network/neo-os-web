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
  SignedMessage,
  InvokeParams,
  TransactionResult,
} from "./adapters";
import { PasswordCache } from "./password-cache";

export type WalletProvider = "neoline" | "o3" | "onegate" | "auth0";
export type NetworkType = "testnet" | "mainnet";

/** Default RPC endpoints */
export const DEFAULT_RPC_URLS: Record<NetworkType, string> = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
};

/** Network configuration for social accounts */
export interface NetworkConfig {
  network: NetworkType;
  customRpcUrls: {
    testnet: string | null;
    mainnet: string | null;
  };
}

interface WalletState {
  connected: boolean;
  address: string;
  publicKey: string;
  provider: WalletProvider | null;
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;

  // Network configuration (for social accounts)
  networkConfig: NetworkConfig;

  // Password prompt state
  passwordCallback: {
    resolve: (password: string) => void;
    reject: (error: Error) => void;
  } | null;
}

interface WalletActions {
  connect: (provider: WalletProvider) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;

  // High-level actions
  signMessage: (message: string) => Promise<SignedMessage>;
  invoke: (params: InvokeParams) => Promise<TransactionResult>;

  // Network configuration (for social accounts)
  setNetwork: (network: NetworkType) => void;
  setCustomRpcUrl: (network: NetworkType, url: string | null) => void;
  getActiveRpcUrl: () => string;

  // UI callbacks
  submitPassword: (password: string) => void;
  cancelPasswordRequest: () => void;
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
      passwordCallback: null,
      networkConfig: {
        network: "testnet" as NetworkType,
        customRpcUrls: {
          testnet: null,
          mainnet: null,
        },
      },

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

      // Signing Actions
      signMessage: async (message: string) => {
        const { provider } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (provider === "auth0") {
          const pwdPromise = new Promise<string>((resolve, reject) => {
            set({ passwordCallback: { resolve, reject } });
          });

          try {
            const password = await pwdPromise;
            try {
              return await (adapters.auth0 as Auth0Adapter).signWithPassword(message, password);
            } catch (err) {
              PasswordCache.clear();
              throw err;
            }
          } finally {
            set({ passwordCallback: null });
          }
        }

        return adapters[provider].signMessage(message);
      },

      invoke: async (params: InvokeParams) => {
        const { provider } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (provider === "auth0") {
          const pwdPromise = new Promise<string>((resolve, reject) => {
            set({ passwordCallback: { resolve, reject } });
          });

          try {
            const password = await pwdPromise;
            try {
              return await (adapters.auth0 as Auth0Adapter).invokeWithPassword(params, password);
            } catch (err) {
              PasswordCache.clear();
              throw err;
            }
          } finally {
            set({ passwordCallback: null });
          }
        }

        return adapters[provider].invoke(params);
      },

      submitPassword: (password: string) => {
        const cb = get().passwordCallback;
        if (cb) cb.resolve(password);
      },

      cancelPasswordRequest: () => {
        const cb = get().passwordCallback;
        if (cb) cb.reject(new Error("User cancelled password request"));
      },

      // Network configuration actions
      setNetwork: (network: NetworkType) => {
        set((state) => ({
          networkConfig: { ...state.networkConfig, network },
        }));
      },

      setCustomRpcUrl: (network: NetworkType, url: string | null) => {
        set((state) => ({
          networkConfig: {
            ...state.networkConfig,
            customRpcUrls: {
              ...state.networkConfig.customRpcUrls,
              [network]: url,
            },
          },
        }));
      },

      getActiveRpcUrl: () => {
        const { networkConfig } = get();
        const customUrl = networkConfig.customRpcUrls[networkConfig.network];
        return customUrl || DEFAULT_RPC_URLS[networkConfig.network];
      },
    }),
    {
      name: "neo-wallet",
      partialize: (state) => ({
        provider: state.provider,
        networkConfig: state.networkConfig,
      }),
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

/** Get current active RPC URL based on network config */
export function getActiveRpcUrl(): string {
  const state = useWalletStore.getState();
  const { network, customRpcUrls } = state.networkConfig;
  return customRpcUrls[network] || DEFAULT_RPC_URLS[network];
}

/** Check if user can configure network (social accounts only) */
export function canConfigureNetwork(): boolean {
  const provider = useWalletStore.getState().provider;
  return provider === "auth0";
}
