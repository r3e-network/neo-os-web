import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletAdapter, WalletBalance, SignedMessage, NeoInvokeParams, TransactionResult } from "./adapters";
import { NeoLineAdapter, O3Adapter, OneGateAdapter, WalletNotInstalledError } from "./adapters";
import type { ChainId, ChainType } from "../chains/types";
import { getChainRegistry } from "../chains/registry";
import { getChainRpcUrl } from "../chains/rpc-functions";

// Multi-chain wallet provider types
export type NeoWalletProvider = "neoline" | "o3" | "onegate";
export type WalletProvider = NeoWalletProvider | string; // Allow string for future extensibility

/** Initial chain for wallet state */
export const DEFAULT_CHAIN_ID: ChainId = "neo-n3-mainnet";

/** Network configuration with multi-chain support */
export interface NetworkConfig {
  /** Active chain ID */
  chainId: ChainId;
  /** Chain type for the active chain */
  chainType: ChainType;
  /** Custom RPC URLs per chain */
  customRpcUrls: Partial<Record<ChainId, string>>;
}

interface WalletState {
  connected: boolean;
  address: string;
  publicKey: string;
  provider: WalletProvider | null;
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;

  // Multi-chain state
  chainId: ChainId;
  chainType: ChainType;

  // Network configuration
  networkConfig: NetworkConfig;

  // Password prompt state
  passwordCallback: {
    resolve: (password: string) => void;
    reject: (error: Error) => void;
  } | null;
}

interface WalletActions {
  connect: (provider: WalletProvider, chainId?: ChainId) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;

  // High-level actions
  signMessage: (message: string) => Promise<SignedMessage>;

  // Neo N3 specific
  invoke: (params: NeoInvokeParams) => Promise<TransactionResult>;

  // Multi-chain actions
  switchChain: (chainId: ChainId) => Promise<void>;
  setChainId: (chainId: ChainId) => void;

  // RPC configuration
  setCustomRpcUrl: (chainId: ChainId, url: string | null) => void;
  getActiveRpcUrl: () => string;

  // UI callbacks
  submitPassword: (password: string) => void;
  cancelPasswordRequest: () => void;
}

export type WalletStore = WalletState & WalletActions;

// Neo N3 adapters
const neoAdapters: Record<string, WalletAdapter> = {
  neoline: new NeoLineAdapter(),
  o3: new O3Adapter(),
  onegate: new OneGateAdapter(),
};

// Helper to check if provider is Neo
function isNeoProvider(provider: WalletProvider): boolean {
  return provider in neoAdapters;
}

// Helper to get chain type from chainId
function getChainTypeFromId(chainId: ChainId): ChainType {
  const registry = getChainRegistry();
  const chain = registry.getChain(chainId);
  return chain?.type || "neo-n3";
}

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

      // Multi-chain state - defaults to N3 Mainnet but persists
      chainId: DEFAULT_CHAIN_ID,
      chainType: "neo-n3" as ChainType,

      networkConfig: {
        chainId: DEFAULT_CHAIN_ID,
        chainType: "neo-n3" as ChainType,
        customRpcUrls: {},
      },

      // Actions
      connect: async (provider: WalletProvider, chainId?: ChainId) => {
        set({ loading: true, error: null });

        // Use requested chain, or current state chain, or default
        const currentChainId = get().chainId;
        const targetChainId = chainId || currentChainId || DEFAULT_CHAIN_ID;

        try {
          if (isNeoProvider(provider)) {
            // Neo N3 wallet connection
            const adapter = neoAdapters[provider];
            const account = await adapter.connect();
            const balance = await adapter.getBalance(account.address, targetChainId);

            set({
              connected: true,
              address: account.address,
              publicKey: account.publicKey,
              provider,
              balance,
              chainId: targetChainId,
              chainType: "neo-n3", // Neo adapters support N3 only
              loading: false,
              networkConfig: {
                ...get().networkConfig,
                chainId: targetChainId,
                chainType: "neo-n3",
              },
            });
          } else {
            throw new Error(`Unknown provider: ${provider}`);
          }
        } catch (err) {
          const message =
            err instanceof WalletNotInstalledError
              ? `Please install ${provider} wallet`
              : `Connection failed: ${err instanceof Error ? err.message : String(err)}`;

          set({ loading: false, error: message });
        }
      },

      disconnect: () => {
        const { provider } = get();
        if (provider) {
          if (isNeoProvider(provider)) {
            neoAdapters[provider].disconnect();
          }
        }

        set((state) => ({
          connected: false,
          address: "",
          publicKey: "",
          provider: null,
          balance: null,
          error: null,
          // We keep the chainId/Type to persist user preference
          chainId: state.chainId,
          chainType: state.chainType,
        }));
      },

      refreshBalance: async () => {
        const { connected, address, provider, chainId } = get();
        if (!connected || !provider) return;

        try {
          if (isNeoProvider(provider)) {
            const balance = await neoAdapters[provider].getBalance(address, chainId);
            set({ balance });
          }
        } catch (err) {
          console.warn("Balance refresh failed:", err);
        }
      },

      clearError: () => set({ error: null }),

      // Signing Actions
      signMessage: async (message: string) => {
        const { provider } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (!isNeoProvider(provider)) {
          throw new Error("Unsupported provider for signing");
        }

        return neoAdapters[provider].signMessage(message);
      },

      invoke: async (params: NeoInvokeParams) => {
        const { provider } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (!isNeoProvider(provider)) {
          throw new Error("Unsupported provider for Neo invocation");
        }

        return neoAdapters[provider].invoke(params);
      },

      submitPassword: (password: string) => {
        const cb = get().passwordCallback;
        if (cb) cb.resolve(password);
      },

      cancelPasswordRequest: () => {
        const cb = get().passwordCallback;
        if (cb) cb.reject(new Error("User cancelled password request"));
      },

      // RPC configuration actions
      setCustomRpcUrl: (chainId: ChainId, url: string | null) => {
        set((state) => ({
          networkConfig: {
            ...state.networkConfig,
            customRpcUrls: {
              ...state.networkConfig.customRpcUrls,
              [chainId]: url ?? undefined,
            },
          },
        }));
      },

      getActiveRpcUrl: () => {
        const { networkConfig, chainId } = get();
        const customUrl = networkConfig.customRpcUrls[chainId];
        return customUrl || getChainRpcUrl(chainId);
      },

      // Multi-chain actions
      switchChain: async (chainId: ChainId) => {
        const { provider, connected } = get();
        const chainType = getChainTypeFromId(chainId);

        // If connected, try to refresh the balance for the target chain.
        if (connected && provider && isNeoProvider(provider)) {
          const currentAddr = get().address;
          const newBalance = await neoAdapters[provider].getBalance(currentAddr, chainId);
          set({ balance: newBalance });
        }

        // Always update the internal state
        set({
          chainId,
          chainType,
          networkConfig: {
            ...get().networkConfig,
            chainId,
            chainType,
          },
        });
      },

      setChainId: (chainId: ChainId) => {
        const chainType = getChainTypeFromId(chainId);
        set({
          chainId,
          chainType,
          networkConfig: {
            ...get().networkConfig,
            chainId,
            chainType,
          },
        });
      },
    }),
    {
      name: "neo-wallet",
      partialize: (state) => ({
        provider: state.provider,
        networkConfig: state.networkConfig,
        chainId: state.chainId,
        chainType: state.chainType,
      }),
    },
  ),
);

/** Get adapter for current provider */
export function getWalletAdapter(): WalletAdapter | null {
  const provider = useWalletStore.getState().provider;
  if (!provider) return null;
  if (isNeoProvider(provider)) {
    return neoAdapters[provider];
  }
  return null;
}

/** Available wallet options */
export const walletOptions = [
  // Neo N3 wallets
  { id: "neoline" as const, name: "NeoLine", icon: "https://neoline.io/favicon.ico", chainType: "neo-n3" as ChainType },
  { id: "o3" as const, name: "O3", icon: "https://o3.network/favicon.ico", chainType: "neo-n3" as ChainType },
  {
    id: "onegate" as const,
    name: "OneGate",
    icon: "https://onegate.space/favicon.ico",
    chainType: "neo-n3" as ChainType,
  },
];

/** Get current active RPC URL based on network config */
export function getActiveRpcUrl(): string {
  const state = useWalletStore.getState();
  const { customRpcUrls, chainId } = state.networkConfig;
  return customRpcUrls[chainId] || getChainRpcUrl(chainId);
}
