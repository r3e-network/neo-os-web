import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  WalletAdapter,
  NeoLineAdapter,
  O3Adapter,
  OneGateAdapter,
  Auth0Adapter,
  MetaMaskAdapter,
  WalletBalance,
  WalletNotInstalledError,
  SignedMessage,
  NeoInvokeParams,
  EVMTransactionParams,
  TransactionResult,
  EVMWalletAdapter,
} from "./adapters";
import { PasswordCache } from "./password-cache";
import type { ChainId, ChainType } from "../chains/types";
import { getChainRegistry } from "../chains/registry";
import { getChainRpcUrl } from "../chain/rpc-client";

// Multi-chain wallet provider types
export type NeoWalletProvider = "neoline" | "o3" | "onegate" | "auth0";
export type EVMWalletProvider = "metamask";
export type WalletProvider = NeoWalletProvider | EVMWalletProvider | string; // Allow string for future extensibility

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

  // EVM specific
  sendTransaction: (params: EVMTransactionParams) => Promise<TransactionResult>;

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
  auth0: new Auth0Adapter(),
};

// EVM adapters
const evmAdapters: Record<string, EVMWalletAdapter> = {
  metamask: new MetaMaskAdapter(),
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
        const targetChainType = getChainTypeFromId(targetChainId);

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
              chainType: "neo-n3", // Neo adapters are N3 only for now
              loading: false,
              networkConfig: {
                ...get().networkConfig,
                chainId: targetChainId,
                chainType: "neo-n3",
              },
            });
          } else if (provider in evmAdapters) {
            // EVM wallet connection
            const adapter = evmAdapters[provider];
            if (!adapter.isAvailable()) {
              throw new WalletNotInstalledError("MetaMask");
            }

            const chainAccount = await adapter.connect(targetChainId);

            // Get native symbol from chain registry
            const targetChainConfig = getChainRegistry().getChain(targetChainId);
            const nativeSymbol = targetChainConfig?.nativeCurrency?.symbol || "ETH";

            set({
              connected: true,
              address: chainAccount.address,
              publicKey: chainAccount.publicKey || "",
              provider,
              balance: {
                native: chainAccount.balance?.native || "0",
                nativeSymbol,
                governance: undefined,
                governanceSymbol: undefined,
              },
              chainId: targetChainId,
              chainType: "evm",
              loading: false,
              networkConfig: {
                ...get().networkConfig,
                chainId: targetChainId,
                chainType: "evm",
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
          } else if (provider in evmAdapters) {
            evmAdapters[provider].disconnect();
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
          } else if (provider in evmAdapters) {
            const balance = await evmAdapters[provider].getBalance(address, chainId);
            set({ balance });
          }
        } catch {
          // Silently fail balance refresh
        }
      },

      clearError: () => set({ error: null }),

      // Signing Actions
      signMessage: async (message: string) => {
        const { provider } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (isNeoProvider(provider)) {
          if (provider === "auth0") {
            const pwdPromise = new Promise<string>((resolve, reject) => {
              set({ passwordCallback: { resolve, reject } });
            });

            try {
              const password = await pwdPromise;
              try {
                return await (neoAdapters.auth0 as Auth0Adapter).signWithPassword(message, password);
              } catch (err) {
                PasswordCache.clear();
                throw err;
              }
            } finally {
              set({ passwordCallback: null });
            }
          }
          return neoAdapters[provider].signMessage(message);
        } else if (provider in evmAdapters) {
          // EVM signing
          const signature = await evmAdapters[provider].signMessage(message);
          return {
            publicKey: get().publicKey,
            data: signature,
            salt: "",
            message,
          };
        }
        throw new Error("Unsupported provider for signing");
      },

      invoke: async (params: NeoInvokeParams) => {
        const { provider, chainId } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (!isNeoProvider(provider)) {
          throw new Error("Use sendTransaction for EVM chains");
        }

        if (provider === "auth0") {
          const pwdPromise = new Promise<string>((resolve, reject) => {
            set({ passwordCallback: { resolve, reject } });
          });

          try {
            const password = await pwdPromise;
            try {
              return await (neoAdapters.auth0 as Auth0Adapter).invokeWithPassword(params, password, chainId);
            } catch (err) {
              PasswordCache.clear();
              throw err;
            }
          } finally {
            set({ passwordCallback: null });
          }
        }

        return neoAdapters[provider].invoke(params);
      },

      sendTransaction: async (params: EVMTransactionParams) => {
        const { provider } = get();
        if (!provider) throw new Error("Wallet not connected");

        if (isNeoProvider(provider)) {
          throw new Error("Use invoke for Neo chains");
        }

        if (provider in evmAdapters) {
          return evmAdapters[provider].sendTransaction(params);
        }

        throw new Error("Provider does not support EVM transactions");
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

        // If connected, try to switch the actual wallet network
        if (connected && provider) {
          // EVM wallets support chain switching
          if (provider in evmAdapters) {
            await evmAdapters[provider].switchChain(chainId);
            // Refresh balance after switch
            const currentAddr = get().address;
            const newBalance = await evmAdapters[provider].getBalance(currentAddr, chainId);
            set({ balance: newBalance });
          }
          // Neo wallets usually don't support switching purely via dApp except for prompt,
          // but we update the dApp state regardless.
          else if (isNeoProvider(provider)) {
            // Attempt to refresh balance to see if it works on new chain (if RPC used)
            const currentAddr = get().address;
            const newBalance = await neoAdapters[provider].getBalance(currentAddr, chainId);
            set({ balance: newBalance });
          }
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
      onRehydrateStorage: () => (state) => {
        if (state?.provider === "auth0") {
          state.provider = null;
        }
      },
    },
  ),
);

/** Get adapter for current provider */
export function getWalletAdapter(): WalletAdapter | EVMWalletAdapter | null {
  const provider = useWalletStore.getState().provider;
  if (!provider) return null;
  if (isNeoProvider(provider)) {
    return neoAdapters[provider];
  }
  if (provider in evmAdapters) {
    return evmAdapters[provider];
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
  // EVM wallets
  { id: "metamask" as const, name: "MetaMask", icon: "https://metamask.io/favicon.ico", chainType: "evm" as ChainType },
];

/** Get current active RPC URL based on network config */
export function getActiveRpcUrl(): string {
  const state = useWalletStore.getState();
  const { customRpcUrls, chainId } = state.networkConfig;
  return customRpcUrls[chainId] || getChainRpcUrl(chainId);
}

/** Check if user can configure network (social accounts only) */
export function canConfigureNetwork(): boolean {
  const provider = useWalletStore.getState().provider;
  return provider === "auth0";
}
