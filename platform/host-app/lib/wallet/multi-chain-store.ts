/**
 * Multi-Chain Wallet Store
 *
 * Zustand store for managing multi-chain wallet state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainId, ChainAccount, MultiChainAccount, WalletProviderType } from "../chains/types";
import type { IWalletAdapter } from "./adapters/interface";
import { MetaMaskAdapter } from "./adapters/metamask";

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

  // Adapters
  adapters: Map<string, IWalletAdapter>;

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
      adapters: new Map([["metamask", new MetaMaskAdapter()]]),

      // Connect to wallet
      connect: async (provider: WalletProviderType, chainId: ChainId) => {
        const adapter = get().adapters.get(provider);
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
              accounts: { [chainId]: chainAccount },
              activeChainId: chainId,
            },
          });
        } catch (error: any) {
          set({
            connecting: false,
            error: error.message || "Connection failed",
          });
        }
      },

      // Disconnect
      disconnect: async () => {
        const { account, adapters } = get();
        if (account) {
          const adapter = adapters.get(account.provider);
          await adapter?.disconnect();
        }
        set({ connected: false, account: null, activeChainId: null });
      },

      // Switch chain
      switchChain: async (chainId: ChainId) => {
        const { account, adapters } = get();
        if (!account) return;

        const adapter = adapters.get(account.provider);
        if (!adapter) return;

        try {
          await adapter.switchChain(chainId);
          set({ activeChainId: chainId });
        } catch (error: any) {
          set({ error: error.message });
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
