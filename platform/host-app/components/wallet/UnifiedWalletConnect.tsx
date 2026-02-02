/**
 * UnifiedWalletConnect - Wallet connection component
 *
 * Supports extension wallets only
 */

import { useState, useCallback } from "react";
import { useWalletStore, walletOptions } from "@/lib/wallet/store";
import type { ChainId, ChainType } from "@/lib/chains/types";

// Chains to generate accounts for on social login (platform-level, not MiniApp-specific)
const ACCOUNT_SETUP_CHAINS: Array<{ chainId: ChainId; chainType: ChainType }> = [
  { chainId: "neo-n3-mainnet", chainType: "neo-n3" },
  { chainId: "neo-n3-testnet", chainType: "neo-n3" },
];

interface UnifiedWalletConnectProps {
  onConnect?: (address: string) => void;
  onError?: (error: string) => void;
}

export function UnifiedWalletConnect({ onConnect, onError }: UnifiedWalletConnectProps) {
  const { connect, connected, address, loading, error } = useWalletStore();

  // Handle extension wallet connection
  const handleExtensionConnect = useCallback(
    async (provider: "neoline" | "o3" | "onegate") => {
      try {
        await connect(provider);
        onConnect?.(address);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Connection failed");
      }
    },
    [connect, address, onConnect, onError],
  );

  if (connected) {
    return (
      <div className="bg-green-50 dark:bg-card/40 border border-green-500/20 p-4 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          <span className="text-sm font-bold text-green-600 dark:text-green-400 tracking-wide">Connected</span>
        </div>
        <p className="mt-2 font-mono text-xs text-green-700 dark:text-green-300 break-all opacity-80">{address}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Extension Wallets */}
        <div className="p-6 bg-white dark:bg-card/40 border border-gray-200 dark:border-white/10 rounded-2xl backdrop-blur-md transition-all hover:bg-gray-50 dark:hover:bg-card/60">
          <h3 className="mb-2 font-bold text-gray-900 dark:text-white tracking-tight">Extension Wallet</h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-white/50">
            Connect with NeoLine, O3, or OneGate browser extension.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {walletOptions.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleExtensionConnect(wallet.id)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 h-20 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 hover:border-neo/50 transition-all disabled:opacity-50"
              >
                {/* Icons would go here if available */}
                <span className="text-xs font-bold mt-1">{wallet.name}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm font-bold text-red-400 text-center">{error}</p>}
      </div>
    </>
  );
}
