/**
 * Multi-Chain Wallet Store
 *
 * Zustand store for managing multi-chain wallet state.
 * Adapters are managed as singletons outside the store to avoid serialization issues.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainId, ChainAccount, MultiChainAccount, WalletProviderType } from "../chains/types";
import type { IWalletAdapter } from "./adapters/interface";

// ============================================================================
// Adapter Registry (Singleton - outside store to avoid serialization issues)
// ============================================================================

const adapterRegistry = new Map<string, IWalletAdapter>();

/** Get a wallet adapter by provider type */
export function getMultiChainAdapter(provider: string): IWalletAdapter | undefined {
  return adapterRegistry.get(provider);
}

/** Register a new wallet adapter */
export function registerMultiChainAdapter(provider: string, adapter: IWalletAdapter): void {
  adapterRegistry.set(provider, adapter);
}

// ============================================================================
// Store Types
// ============================================================================

interface MultiChainWalletState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;

  // Account data
  account: MultiChainAccount | null;
  activeChainId: ChainId | null;

  // Actions
  connect: (provider: WalletProviderType, chainId: ChainId) => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: ChainId) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useMultiChainWallet = create<MultiChainWalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      connected: false,
      connecting: false,
      error: null,
      account: null,
      activeChainId: null,

      // Connect to wallet
      connect: async (provider: WalletProviderType, chainId: ChainId) => {
        const adapter = adapterRegistry.get(provider);
        if (!adapter) {
          set({ error: `Provider ${provider} not found` });
          return;
        }

        set({ connecting: true, error: null });

        try {
          const chainAccount = await adapter.connect(chainId);

          set({
            connected: true,
            connecting: false,
            activeChainId: chainId,
            account: {
              id: chainAccount.address,
              type: "external",
              provider,
              accounts: { [chainId]: chainAccount } as Record<ChainId, ChainAccount>,
              activeChainId: chainId,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Connection failed";
          set({
            connecting: false,
            error: message,
          });
        }
      },

      // Disconnect
      disconnect: async () => {
        const { account } = get();
        if (account) {
          const adapter = adapterRegistry.get(account.provider);
          await adapter?.disconnect();
        }
        set({ connected: false, account: null, activeChainId: null });
      },

      // Switch chain
      switchChain: async (chainId: ChainId) => {
        const { account } = get();
        if (!account) return;

        const adapter = adapterRegistry.get(account.provider);
        if (!adapter) return;

        try {
          await adapter.switchChain(chainId);
          set({ activeChainId: chainId });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Chain switch failed";
          set({ error: message });
        }
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: "multi-chain-wallet",
      partialize: (state) => ({
        activeChainId: state.activeChainId,
      }),
    },
  ),
);
