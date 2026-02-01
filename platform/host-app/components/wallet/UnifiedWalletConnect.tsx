/**
 * UnifiedWalletConnect - Wallet connection component
 *
 * Supports both social accounts and extension wallets
 */

import { useState, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useWalletStore, walletOptions } from "@/lib/wallet/store";
import { useMultiChainAccountSetup } from "@/lib/wallet/hooks/useMultiChainAccountSetup";
import { PasswordSetupModal } from "./PasswordSetupModal";
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
  const { user, isLoading: userLoading } = useUser();
  const { connect, connected, address, loading, error } = useWalletStore();
  const { needsSetup, setupMultipleAccounts, isLoading: setupLoading } = useMultiChainAccountSetup();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [, setConnectMode] = useState<"social" | "extension" | null>(null);

  // Handle social account connection
  const handleSocialConnect = useCallback(async () => {
    if (!user) {
      // Redirect to login
      window.location.href = "/api/auth/login";
      return;
    }

    if (needsSetup) {
      setShowPasswordModal(true);
      setConnectMode("social");
      return;
    }

    try {
      await connect("auth0");
      onConnect?.(address);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Connection failed");
    }
  }, [user, needsSetup, connect, address, onConnect, onError]);

  // Handle extension wallet connection
  const handleExtensionConnect = useCallback(
    async (provider: "neoline" | "o3" | "onegate") => {
      setConnectMode("extension");
      try {
        await connect(provider);
        onConnect?.(address);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Connection failed");
      }
    },
    [connect, address, onConnect, onError],
  );

  // Handle password setup completion - generates accounts for platform supported chains
  const handlePasswordSetup = useCallback(
    async (password: string) => {
      try {
        await setupMultipleAccounts(ACCOUNT_SETUP_CHAINS, password);
        setShowPasswordModal(false);
        await connect("auth0");
        onConnect?.(address);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Setup failed");
      }
    },
    [setupMultipleAccounts, connect, address, onConnect, onError],
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
        {/* Social Account Option */}
        <div className="p-6 bg-white dark:bg-card/40 border border-gray-200 dark:border-white/10 rounded-2xl backdrop-blur-md transition-all hover:bg-gray-50 dark:hover:bg-card/60">
          <h3 className="mb-2 font-bold text-gray-900 dark:text-white tracking-tight">Social Account</h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-white/50">
            Sign in with Google, GitHub, or Twitter. No extension needed.
          </p>
          <button
            onClick={handleSocialConnect}
            disabled={loading || userLoading || setupLoading}
            className="w-full py-3 bg-neo text-black font-bold rounded-full shadow-[0_0_15px_rgba(0,229,153,0.3)] hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(0,229,153,0.5)] transition-all disabled:opacity-50"
          >
            {userLoading || setupLoading ? "Loading..." : user ? "Connect Social Account" : "Sign In"}
          </button>
        </div>

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

      {/* Password Setup Modal */}
      <PasswordSetupModal
        isOpen={showPasswordModal}
        onSetup={handlePasswordSetup}
        onCancel={() => setShowPasswordModal(false)}
        isLoading={setupLoading}
      />
    </>
  );
}
