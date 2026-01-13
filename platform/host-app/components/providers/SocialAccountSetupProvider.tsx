/**
 * SocialAccountSetupProvider - Automatically triggers password setup for social account users
 *
 * This component monitors social account login state and shows the password setup modal
 * when a user needs to create their multi-chain wallets (Neo N3 + EVM chains).
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useMultiChainAccountSetup } from "@/lib/wallet/hooks/useMultiChainAccountSetup";
import { useWalletStore } from "@/lib/wallet/store";
import { PasswordSetupModal } from "@/components/wallet/PasswordSetupModal";
import type { ChainId, ChainType } from "@/lib/chains/types";

// Chains to generate accounts for on social login (platform-level, not MiniApp-specific)
const ACCOUNT_SETUP_CHAINS: Array<{ chainId: ChainId; chainType: ChainType }> = [
  { chainId: "neo-n3-mainnet", chainType: "neo-n3" },
  { chainId: "neox-mainnet", chainType: "evm" },
];

interface SocialAccountSetupProviderProps {
  children: React.ReactNode;
}

export function SocialAccountSetupProvider({ children }: SocialAccountSetupProviderProps) {
  const { user, isLoading: userLoading } = useUser();
  const { needsSetup, setupMultipleAccounts, isLoading: setupLoading } = useMultiChainAccountSetup();
  const { connect, connected } = useWalletStore();

  const [showModal, setShowModal] = useState(false);
  const [hasShownModal, setHasShownModal] = useState(false);

  // Show modal when user is logged in and needs setup
  useEffect(() => {
    if (user && !userLoading && needsSetup && !hasShownModal && !connected) {
      setShowModal(true);
      setHasShownModal(true);
    }
  }, [user, userLoading, needsSetup, hasShownModal, connected]);

  // Handle password setup completion - generates accounts for platform supported chains
  const handleSetup = useCallback(
    async (password: string) => {
      try {
        // Generate accounts for Neo N3 and EVM chains
        await setupMultipleAccounts(ACCOUNT_SETUP_CHAINS, password);
        setShowModal(false);

        // Auto-connect after setup
        await connect("auth0");
      } catch (err) {
        console.error("[SocialAccountSetupProvider] Multi-chain setup failed:", err);
        throw err;
      }
    },
    [setupMultipleAccounts, connect],
  );

  // Handle modal cancel
  const handleCancel = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <>
      {children}
      <PasswordSetupModal isOpen={showModal} onSetup={handleSetup} onCancel={handleCancel} isLoading={setupLoading} />
    </>
  );
}

export default SocialAccountSetupProvider;
