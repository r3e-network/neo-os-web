/**
 * useAccount - Wallet-based account management hook
 * Provides unified wallet signing interface
 */

import { useState, useCallback, useMemo } from "react";
import { useWalletStore } from "@/lib/wallet/store";

export interface SigningContext {
  mode: "wallet";
  address: string;
  publicKey: string;
  requiresPassword: boolean;
}

export interface UseAccountResult {
  // State
  isConnected: boolean;
  isLoading: boolean;
  mode: "wallet" | null;
  address: string | null;
  publicKey: string | null;
  error: Error | null;

  // Signing context
  signingContext: SigningContext | null;

  // Password modal state
  showPasswordModal: boolean;
  pendingAction: (() => Promise<void>) | null;

  // Actions
  signMessage: (message: string, _password?: string) => Promise<string>;
  invokeContract: (
    params: { scriptHash: string; operation: string; args?: Array<{ type: string; value: unknown }> },
    _password?: string,
  ) => Promise<{ txid: string }>;

  // Password flow
  requestPassword: (action: () => Promise<void>) => void;
  submitPassword: (password: string) => Promise<void>;
  cancelPassword: () => void;
  clearError: () => void;
}

/**
 * Wallet-based account management hook
 * Handles wallet signing flows only
 */
export function useAccount(): UseAccountResult {
  const walletStore = useWalletStore();

  const [error, setError] = useState<Error | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Determine connection state and mode
  const isConnected = walletStore.connected;
  const isLoading = walletStore.loading;

  const mode: "wallet" | null = useMemo(() => {
    if (walletStore.connected) {
      return "wallet";
    }
    return null;
  }, [walletStore.connected]);

  const address = walletStore.address || null;
  const publicKey = walletStore.publicKey || null;

  // Signing context
  const signingContext: SigningContext | null = useMemo(() => {
    if (!isConnected || !address) return null;
    return {
      mode: "wallet",
      address,
      publicKey: publicKey || "",
      requiresPassword: false,
    };
  }, [isConnected, address, publicKey]);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Password flow handlers
  const requestPassword = useCallback((action: () => Promise<void>) => {
    setPendingAction(() => action);
    setShowPasswordModal(true);
  }, []);

  const cancelPassword = useCallback(() => {
    setShowPasswordModal(false);
    setPendingAction(null);
  }, []);

  const submitPassword = useCallback(
    async (_password: string) => {
      setShowPasswordModal(false);
      if (pendingAction) {
        try {
          await pendingAction();
        } catch (err) {
          setError(err instanceof Error ? err : new Error("Signing failed"));
        }
      }
      setPendingAction(null);
    },
    [pendingAction],
  );

  // Sign message - wallet mode only
  const signMessage = useCallback(
    async (message: string, _password?: string): Promise<string> => {
      if (!signingContext) {
        throw new Error("Not connected");
      }

      setError(null);

      try {
        const result = await walletStore.signMessage(message);
        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Signing failed");
        setError(error);
        throw error;
      }
    },
    [signingContext, walletStore],
  );

  // Invoke contract - wallet mode only
  const invokeContract = useCallback(
    async (
      params: { scriptHash: string; operation: string; args?: Array<{ type: string; value: unknown }> },
      _password?: string,
    ): Promise<{ txid: string }> => {
      if (!signingContext) {
        throw new Error("Not connected");
      }

      setError(null);

      try {
        const invokeParams = {
          scriptHash: params.scriptHash,
          operation: params.operation,
          args: params.args || [],
        };

        const result = await walletStore.invoke(invokeParams);
        return { txid: result.txid };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Transaction failed");
        setError(error);
        throw error;
      }
    },
    [signingContext, walletStore],
  );

  return {
    isConnected,
    isLoading,
    mode,
    address,
    publicKey,
    error,
    signingContext,
    showPasswordModal,
    pendingAction,
    signMessage,
    invokeContract,
    requestPassword,
    submitPassword,
    cancelPassword,
    clearError,
  };
}
