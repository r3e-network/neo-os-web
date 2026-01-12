/**
 * SocialAccountSetupProvider - Automatically triggers password setup for social account users
 *
 * This component monitors social account login state and shows the password setup modal
 * when a user needs to create their Neo wallet.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAccountSetup } from "@/lib/wallet/hooks/useAccountSetup";
import { useWalletStore } from "@/lib/wallet/store";
import { PasswordSetupModal } from "@/components/wallet/PasswordSetupModal";

interface SocialAccountSetupProviderProps {
  children: React.ReactNode;
}

export function SocialAccountSetupProvider({ children }: SocialAccountSetupProviderProps) {
  const { user, isLoading: userLoading } = useUser();
  const { needsSetup, setupAccount, isLoading: setupLoading, state } = useAccountSetup();
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

  // Handle password setup completion
  const handleSetup = useCallback(
    async (password: string) => {
      try {
        await setupAccount(password);
        setShowModal(false);

        // Auto-connect after setup
        await connect("auth0");
      } catch (err) {
        console.error("[SocialAccountSetupProvider] Setup failed:", err);
        throw err;
      }
    },
    [setupAccount, connect],
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
