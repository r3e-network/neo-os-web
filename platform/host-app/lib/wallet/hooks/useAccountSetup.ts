/**
 * useAccountSetup - Hook for social account setup flow
 *
 * Handles:
 * 1. Check if user needs account setup
 * 2. Generate Neo account client-side
 * 3. Encrypt with user password
 * 4. Store encrypted key in database
 */

import { useState, useCallback, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { generateNeoAccountBrowser, encryptPrivateKeyBrowser } from "../crypto-browser";

interface AccountStatus {
  hasAccount: boolean;
  address?: string;
  publicKey?: string;
  needsPasswordSetup: boolean;
  oauthProvider?: string;
}

interface SetupState {
  status: "idle" | "checking" | "needs_setup" | "setting_up" | "complete" | "error";
  accountStatus: AccountStatus | null;
  error: string | null;
  address?: string;
}

interface UseAccountSetupReturn {
  state: SetupState;
  checkStatus: () => Promise<void>;
  setupAccount: (password: string) => Promise<{ address: string; publicKey: string }>;
  isLoading: boolean;
  needsSetup: boolean;
}

export function useAccountSetup(): UseAccountSetupReturn {
  const { user, isLoading: userLoading } = useUser();
  const [state, setState] = useState<SetupState>({
    status: "idle",
    accountStatus: null,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    if (!user) return;

    setState((s) => ({ ...s, status: "checking", error: null }));

    try {
      const res = await fetch("/api/account/status");
      if (!res.ok) {
        throw new Error("Failed to check account status");
      }

      const data: AccountStatus = await res.json();

      setState({
        status: data.needsPasswordSetup ? "needs_setup" : "complete",
        accountStatus: data,
        error: null,
        address: data.address,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [user]);

  // Auto-check on mount when user is available
  useEffect(() => {
    if (user && !userLoading && state.status === "idle") {
      checkStatus();
    }
  }, [user, userLoading, state.status, checkStatus]);

  const setupAccount = useCallback(
    async (password: string): Promise<{ address: string; publicKey: string }> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      setState((s) => ({ ...s, status: "setting_up", error: null }));

      try {
        // 1. Generate Neo account client-side
        const account = generateNeoAccountBrowser();

        // 2. Encrypt private key with password (client-side)
        const encrypted = await encryptPrivateKeyBrowser(account.privateKey, password);

        // 3. Store encrypted key in database
        const res = await fetch("/api/auth/neo-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: account.address,
            publicKey: account.publicKey,
            encrypted: {
              encryptedData: encrypted.encryptedData,
              salt: encrypted.salt,
              iv: encrypted.iv,
              tag: encrypted.tag,
              iterations: encrypted.iterations,
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create account");
        }

        const result = await res.json();

        setState({
          status: "complete",
          accountStatus: {
            hasAccount: true,
            address: result.address,
            publicKey: result.publicKey,
            needsPasswordSetup: false,
          },
          error: null,
          address: result.address,
        });

        return { address: result.address, publicKey: result.publicKey };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Setup failed";
        setState((s) => ({ ...s, status: "error", error: errorMsg }));
        throw err;
      }
    },
    [user],
  );

  return {
    state,
    checkStatus,
    setupAccount,
    isLoading: state.status === "checking" || state.status === "setting_up" || userLoading,
    needsSetup: state.status === "needs_setup",
  };
}
