import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useWalletStore } from "@/lib/wallet/store";
import { useUser } from "@auth0/nextjs-auth0/client";

export interface UseRequireWalletOptions {
  /** URL to redirect to if not connected (default: "/") */
  redirectUrl?: string;
  /** Use modal instead of redirect (default: false) */
  useModal?: boolean;
  /** Auto-check on mount (default: true) */
  autoCheck?: boolean;
}

export interface UseRequireWalletResult {
  loading: boolean;
  connected: boolean;
  showModal: boolean;
  address: string | null;
  provider: string | null;
  /** Manually trigger connection check */
  checkConnection: () => boolean;
  /** Close the modal */
  closeModal: () => void;
  /** Open the modal */
  openModal: () => void;
}

/**
 * Hook to enforce wallet connection.
 * Supports both redirect and modal modes.
 */
export function useRequireWallet(options: UseRequireWalletOptions | string = {}): UseRequireWalletResult {
  // Support legacy string parameter
  const opts = typeof options === "string" ? { redirectUrl: options } : options;

  const { redirectUrl = "/", useModal = false, autoCheck = true } = opts;

  const router = useRouter();
  const { connected, loading: walletLoading, address, provider } = useWalletStore();
  const { user, isLoading: authLoading } = useUser();
  const [showModal, setShowModal] = useState(false);

  const isLoading = walletLoading || authLoading;
  const isConnected = connected || !!user;

  const checkConnection = useCallback(() => {
    if (isLoading) return true; // Still loading, assume connected

    if (!isConnected) {
      if (useModal) {
        setShowModal(true);
      } else {
        router.replace(redirectUrl);
      }
      return false;
    }
    return true;
  }, [isLoading, isConnected, useModal, router, redirectUrl]);

  const closeModal = useCallback(() => setShowModal(false), []);
  const openModal = useCallback(() => setShowModal(true), []);

  useEffect(() => {
    if (!autoCheck || isLoading) return;
    checkConnection();
  }, [autoCheck, isLoading, checkConnection]);

  // Close modal when connected
  useEffect(() => {
    if (isConnected && showModal) {
      setShowModal(false);
    }
  }, [isConnected, showModal]);

  return {
    loading: isLoading,
    connected: isConnected,
    showModal,
    address: address || null,
    provider: provider || null,
    checkConnection,
    closeModal,
    openModal,
  };
}
