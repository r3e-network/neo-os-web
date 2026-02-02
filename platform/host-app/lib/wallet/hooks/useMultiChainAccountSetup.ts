/**
 * useMultiChainAccountSetup - Hook for multi-chain account setup
 *
 * This hook is now a placeholder for wallet-based multi-chain account setup.
 * Wallet-based authentication handles multi-chain support natively through
 * the wallet provider.
 */

import { useState, useCallback } from "react";
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
}

interface SetupState {
  status: "idle" | "checking" | "needs_setup" | "setting_up" | "complete" | "error";
  accountStatus: MultiChainAccountStatus | null;
  error: string | null;
}

interface UseMultiChainAccountSetupReturn {
  state: SetupState;
  checkStatus: () => Promise<void>;
  setupAccount: (_chainId: ChainId, _chainType: ChainType, _password: string) => Promise<ChainAccountStatus>;
  setupMultipleAccounts: (
    _chains: Array<{ chainId: ChainId; chainType: ChainType }>,
    _password: string,
  ) => Promise<ChainAccountStatus[]>;
  getAccountForChain: (_chainId: ChainId) => ChainAccountStatus | undefined;
  isLoading: boolean;
  needsSetup: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * @deprecated Wallet-based authentication handles multi-chain support natively.
 * This hook is kept for API compatibility but does nothing in wallet-only mode.
 */
export function useMultiChainAccountSetup(): UseMultiChainAccountSetupReturn {
  const [state, setState] = useState<SetupState>({
    status: "complete",
    accountStatus: {
      accounts: [],
      needsPasswordSetup: false,
    },
    error: null,
  });

  // Check account status - wallet-based auth doesn't require setup
  const checkStatus = useCallback(async () => {
    setState((s) => ({
      ...s,
      status: "complete",
      error: null,
    }));
  }, []);

  // Setup single chain account - not supported in wallet mode
  const setupAccount = useCallback(
    async (_chainId: ChainId, _chainType: ChainType, _password: string): Promise<ChainAccountStatus> => {
      throw new Error("Account setup is not required for wallet-based authentication");
    },
    [],
  );

  // Setup multiple chain accounts - not supported in wallet mode
  const setupMultipleAccounts = useCallback(
    async (
      _chains: Array<{ chainId: ChainId; chainType: ChainType }>,
      _password: string,
    ): Promise<ChainAccountStatus[]> => {
      throw new Error("Account setup is not required for wallet-based authentication");
    },
    [],
  );

  // Get account for specific chain - wallet-based auth handles this natively
  const getAccountForChain = useCallback((_chainId: ChainId): ChainAccountStatus | undefined => {
    return undefined;
  }, []);

  return {
    state,
    checkStatus,
    setupAccount,
    setupMultipleAccounts,
    getAccountForChain,
    isLoading: false,
    needsSetup: false,
  };
}
