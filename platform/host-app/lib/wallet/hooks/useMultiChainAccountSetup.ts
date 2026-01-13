/**
 * useMultiChainAccountSetup - Hook for multi-chain social account setup
 *
 * Handles:
 * 1. Check if user needs account setup for specific chains
 * 2. Generate accounts for Neo N3 and EVM chains client-side
 * 3. Encrypt with user password
 * 4. Store encrypted keys in database
 */

import { useState, useCallback, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import {
  generateEncryptedMultiChainAccount,
  generateMultipleChainAccounts,
  EncryptedMultiChainAccount,
} from "../../auth0/multichain-account-browser";
import type { ChainId, ChainType } from "../../chains/types";

// ============================================================================
// Types
// ============================================================================

interface ChainAccountStatus {
  chainId: ChainId;
  chainType: ChainType;
  address: string;
  publicKey: string;
  hasAccount: boolean;
}

interface MultiChainAccountStatus {
  accounts: ChainAccountStatus[];
  needsPasswordSetup: boolean;
  oauthProvider?: string;
}

interface SetupState {
  status: "idle" | "checking" | "needs_setup" | "setting_up" | "complete" | "error";
  accountStatus: MultiChainAccountStatus | null;
  error: string | null;
}

interface UseMultiChainAccountSetupReturn {
  state: SetupState;
  checkStatus: () => Promise<void>;
  setupAccount: (chainId: ChainId, chainType: ChainType, password: string) => Promise<ChainAccountStatus>;
  setupMultipleAccounts: (
    chains: Array<{ chainId: ChainId; chainType: ChainType }>,
    password: string,
  ) => Promise<ChainAccountStatus[]>;
  getAccountForChain: (chainId: ChainId) => ChainAccountStatus | undefined;
  isLoading: boolean;
  needsSetup: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMultiChainAccountSetup(): UseMultiChainAccountSetupReturn {
  const { user, isLoading: userLoading } = useUser();
  const [state, setState] = useState<SetupState>({
    status: "idle",
    accountStatus: null,
    error: null,
  });

  // Check account status for all chains
  const checkStatus = useCallback(async () => {
    if (!user) return;

    setState((s) => ({ ...s, status: "checking", error: null }));

    try {
      const res = await fetch("/api/auth/multichain-account");
      if (!res.ok) {
        throw new Error("Failed to check account status");
      }

      const data = await res.json();
      const accounts: ChainAccountStatus[] = (data.accounts || []).map(
        (acc: { chainId: ChainId; chainType: ChainType; address: string; publicKey: string }) => ({
          ...acc,
          hasAccount: true,
        }),
      );

      setState({
        status: accounts.length === 0 ? "needs_setup" : "complete",
        accountStatus: {
          accounts,
          needsPasswordSetup: accounts.length === 0,
        },
        error: null,
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

  // Setup single chain account
  const setupAccount = useCallback(
    async (chainId: ChainId, chainType: ChainType, password: string): Promise<ChainAccountStatus> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      setState((s) => ({ ...s, status: "setting_up", error: null }));

      try {
        // 1. Generate and encrypt account client-side
        const encryptedAccount = await generateEncryptedMultiChainAccount(chainId, chainType, password);

        // 2. Store in database
        const result = await storeAccount(encryptedAccount);

        // 3. Update state
        const newAccount: ChainAccountStatus = {
          chainId: result.chainId,
          chainType,
          address: result.address,
          publicKey: result.publicKey,
          hasAccount: true,
        };

        setState((s) => ({
          status: "complete",
          accountStatus: {
            accounts: [...(s.accountStatus?.accounts || []), newAccount],
            needsPasswordSetup: false,
          },
          error: null,
        }));

        return newAccount;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Setup failed";
        setState((s) => ({ ...s, status: "error", error: errorMsg }));
        throw err;
      }
    },
    [user],
  );

  // Setup multiple chain accounts at once
  const setupMultipleAccounts = useCallback(
    async (
      chains: Array<{ chainId: ChainId; chainType: ChainType }>,
      password: string,
    ): Promise<ChainAccountStatus[]> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      setState((s) => ({ ...s, status: "setting_up", error: null }));

      try {
        // 1. Generate and encrypt all accounts client-side
        const encryptedAccounts = await generateMultipleChainAccounts(chains, password);

        // 2. Store all accounts in database
        const results: ChainAccountStatus[] = [];
        for (const encryptedAccount of encryptedAccounts) {
          const result = await storeAccount(encryptedAccount);
          results.push({
            chainId: result.chainId,
            chainType: encryptedAccount.chainType,
            address: result.address,
            publicKey: result.publicKey,
            hasAccount: true,
          });
        }

        // 3. Update state
        setState((s) => ({
          status: "complete",
          accountStatus: {
            accounts: [...(s.accountStatus?.accounts || []), ...results],
            needsPasswordSetup: false,
          },
          error: null,
        }));

        return results;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Setup failed";
        setState((s) => ({ ...s, status: "error", error: errorMsg }));
        throw err;
      }
    },
    [user],
  );

  // Get account for specific chain
  const getAccountForChain = useCallback(
    (chainId: ChainId): ChainAccountStatus | undefined => {
      return state.accountStatus?.accounts.find((acc) => acc.chainId === chainId);
    },
    [state.accountStatus],
  );

  return {
    state,
    checkStatus,
    setupAccount,
    setupMultipleAccounts,
    getAccountForChain,
    isLoading: state.status === "checking" || state.status === "setting_up" || userLoading,
    needsSetup: state.status === "needs_setup",
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function storeAccount(
  encryptedAccount: EncryptedMultiChainAccount,
): Promise<{ chainId: ChainId; address: string; publicKey: string }> {
  const res = await fetch("/api/auth/multichain-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId: encryptedAccount.chainId,
      chainType: encryptedAccount.chainType,
      address: encryptedAccount.address,
      publicKey: encryptedAccount.publicKey,
      encrypted: {
        encryptedData: encryptedAccount.encrypted.encryptedData,
        salt: encryptedAccount.encrypted.salt,
        iv: encryptedAccount.encrypted.iv,
        tag: encryptedAccount.encrypted.tag,
        iterations: encryptedAccount.encrypted.iterations,
      },
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to store account");
  }

  return res.json();
}
