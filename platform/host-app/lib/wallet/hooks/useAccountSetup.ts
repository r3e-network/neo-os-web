/**
 * useAccountSetup - Hook for account setup flow
 *
 * This hook is now a placeholder for wallet-based account setup.
 * Wallet-based authentication does not require the same setup flow
 * as social authentication.
 */

import { useState, useCallback } from "react";

interface SetupState {
  status: "idle" | "complete";
  error: string | null;
}

interface UseAccountSetupReturn {
  state: SetupState;
  checkStatus: () => Promise<void>;
  setupAccount: (_password: string) => Promise<{ address: string; publicKey: string }>;
  isLoading: boolean;
  needsSetup: boolean;
}

/**
 * @deprecated Wallet-based authentication does not require account setup.
 * This hook is kept for API compatibility but does nothing in wallet-only mode.
 */
export function useAccountSetup(): UseAccountSetupReturn {
  const [state, setState] = useState<SetupState>({
    status: "complete",
    error: null,
  });

  const checkStatus = useCallback(async () => {
    // Wallet-based auth doesn't require setup
    setState({ status: "complete", error: null });
  }, []);

  const setupAccount = useCallback(async (_password: string): Promise<{ address: string; publicKey: string }> => {
    // Wallet-based auth doesn't require setup
    throw new Error("Account setup is not required for wallet-based authentication");
  }, []);

  return {
    state,
    checkStatus,
    setupAccount,
    isLoading: false,
    needsSetup: false,
  };
}
