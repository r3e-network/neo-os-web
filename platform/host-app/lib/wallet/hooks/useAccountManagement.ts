/**
 * useAccountManagement - Hook for managing account
 *
 * This hook is now a placeholder for wallet-based account management.
 * Wallet-based authentication does not support the same management features
 * as social authentication (password change, WIF import/export, etc.).
 */

import { useState, useCallback } from "react";

interface AccountInfo {
  address: string;
  publicKey: string;
}

interface ManagementState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * @deprecated Wallet-based authentication does not support account management features.
 * This hook is kept for API compatibility but does nothing in wallet-only mode.
 */
export function useAccountManagement() {
  const [state, setState] = useState<ManagementState>({
    loading: false,
    error: null,
    success: false,
  });

  /**
   * Change account password - not supported in wallet mode
   */
  const changePassword = useCallback(
    async (_currentPassword: string, _newPassword: string): Promise<boolean> => {
      setState({ loading: false, error: "Password change is not supported for wallet-based authentication", success: false });
      return false;
    },
    [],
  );

  /**
   * Import external WIF - not supported in wallet mode
   */
  const importWIF = useCallback(
    async (_wif: string, _password: string): Promise<AccountInfo | null> => {
      setState({ loading: false, error: "WIF import is not supported for wallet-based authentication", success: false });
      return null;
    },
    [],
  );

  /**
   * Verify password - not supported in wallet mode
   */
  const verifyPassword = useCallback(async (_password: string): Promise<boolean> => {
    return false;
  }, []);

  const clearState = useCallback(() => {
    setState({ loading: false, error: null, success: false });
  }, []);

  return {
    ...state,
    changePassword,
    importWIF,
    verifyPassword,
    clearState,
  };
}
