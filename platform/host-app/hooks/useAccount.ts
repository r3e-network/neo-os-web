/**
 * useAccount - Unified account management hook
 * Abstracts wallet and OAuth signing differences
 */

import { useState, useCallback, useMemo } from "react";
import { useWalletStore } from "@/lib/wallet/store";
import { useAccountStore, AccountMode } from "@/lib/auth0/account-store";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Auth0Adapter } from "@/lib/wallet/adapters/auth0";

export interface SigningContext {
  mode: AccountMode;
  address: string;
  publicKey: string;
  requiresPassword: boolean;
}

export interface UseAccountResult {
  // State
  isConnected: boolean;
  isLoading: boolean;
  mode: AccountMode;
  address: string | null;
  publicKey: string | null;
  error: Error | null;

  // Signing context
  signingContext: SigningContext | null;

  // Password modal state
  showPasswordModal: boolean;
  pendingAction: (() => Promise<void>) | null;

  // Actions
  signMessage: (message: string, password?: string) => Promise<string>;
  invokeContract: (
    params: { scriptHash: string; operation: string; args?: Array<{ type: string; value: unknown }> },
    password?: string,
  ) => Promise<{ txid: string }>;

  // Password flow
  requestPassword: (action: () => Promise<void>) => void;
  submitPassword: (password: string) => Promise<void>;
  cancelPassword: () => void;
  clearError: () => void;
}

/**
 * Unified account management hook
 * Handles both wallet and OAuth signing flows
 */
export function useAccount(): UseAccountResult {
  const walletStore = useWalletStore();
  const accountStore = useAccountStore();
  const { user, isLoading: authLoading } = useUser();

  const [error, setError] = useState<Error | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);

  // Determine connection state and mode
  const isConnected = walletStore.connected || !!user;
  const isLoading = walletStore.loading || authLoading;

  const mode: AccountMode = useMemo(() => {
    if (walletStore.connected && walletStore.provider !== "auth0") {
      return "wallet";
    }
    if (user || walletStore.provider === "auth0") {
      return "oauth";
    }
    return null;
  }, [walletStore.connected, walletStore.provider, user]);

  const address = walletStore.address || accountStore.address || null;
  const publicKey = walletStore.publicKey || accountStore.publicKey || null;

  // Signing context
  const signingContext: SigningContext | null = useMemo(() => {
    if (!isConnected || !mode || !address) return null;
    return {
      mode,
      address,
      publicKey: publicKey || "",
      requiresPassword: mode === "oauth",
    };
  }, [isConnected, mode, address, publicKey]);

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
    setPendingPassword(null);
  }, []);

  const submitPassword = useCallback(
    async (password: string) => {
      setPendingPassword(password);
      setShowPasswordModal(false);
      if (pendingAction) {
        try {
          await pendingAction();
        } catch (err) {
          setError(err instanceof Error ? err : new Error("Signing failed"));
        }
      }
      setPendingAction(null);
      setPendingPassword(null);
    },
    [pendingAction],
  );

  // Sign message - unified for both modes
  const signMessage = useCallback(
    async (message: string, password?: string): Promise<string> => {
      if (!signingContext) {
        throw new Error("Not connected");
      }

      setError(null);

      try {
        if (signingContext.mode === "wallet") {
          // Wallet mode - use wallet adapter
          const result = await walletStore.signMessage(message);
          return result.data;
        } else {
          // OAuth mode - requires password
          if (!password) {
            throw new Error("Password required for OAuth signing");
          }
          const adapter = new Auth0Adapter();
          const result = await adapter.signWithPassword(message, password);
          return result.data;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Signing failed");
        setError(error);
        throw error;
      }
    },
    [signingContext, walletStore],
  );

  // Invoke contract - unified for both modes
  const invokeContract = useCallback(
    async (
      params: { scriptHash: string; operation: string; args?: Array<{ type: string; value: unknown }> },
      password?: string,
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

        if (signingContext.mode === "wallet") {
          const result = await walletStore.invoke(invokeParams);
          return { txid: result.txid };
        } else {
          if (!password) {
            throw new Error("Password required for OAuth transactions");
          }
          const adapter = new Auth0Adapter();
          const result = await adapter.invokeWithPassword(invokeParams, password);
          return { txid: result.txid };
        }
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
