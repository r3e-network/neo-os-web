/**
 * useAccountManagement - Hook for managing social account
 *
 * Provides:
 * - Change password
 * - Import external WIF
 * - Export account (with password verification)
 */

import { useState, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { encryptPrivateKeyBrowser, decryptPrivateKeyBrowser } from "../crypto-browser";

interface AccountInfo {
  address: string;
  publicKey: string;
}

interface ManagementState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function useAccountManagement() {
  const { user } = useUser();
  const [state, setState] = useState<ManagementState>({
    loading: false,
    error: null,
    success: false,
  });

  /**
   * Change account password
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      if (!user) throw new Error("Not authenticated");

      setState({ loading: true, error: null, success: false });

      try {
        // 1. Fetch current encrypted key
        const res = await fetch("/api/auth/neo-account");
        if (!res.ok) throw new Error("Failed to fetch account");

        const data = await res.json();
        const { encryptedKey, address, publicKey } = data;

        // 2. Decrypt with current password
        const privateKey = await decryptPrivateKeyBrowser(
          encryptedKey.encryptedData,
          currentPassword,
          encryptedKey.salt,
          encryptedKey.iv,
          encryptedKey.tag,
          encryptedKey.iterations,
        );

        // 3. Re-encrypt with new password
        const newEncrypted = await encryptPrivateKeyBrowser(privateKey, newPassword);

        // 4. Update in database
        const updateRes = await fetch("/api/account/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            publicKey,
            encrypted: newEncrypted,
          }),
        });

        if (!updateRes.ok) {
          const err = await updateRes.json();
          throw new Error(err.error || "Update failed");
        }

        setState({ loading: false, error: null, success: true });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        setState({ loading: false, error: msg, success: false });
        return false;
      }
    },
    [user],
  );

  /**
   * Import external WIF
   */
  const importWIF = useCallback(
    async (wif: string, password: string): Promise<AccountInfo | null> => {
      if (!user) throw new Error("Not authenticated");

      setState({ loading: true, error: null, success: false });

      try {
        // Encrypt WIF with password (client-side)
        const encrypted = await encryptPrivateKeyBrowser(wif, password);

        const res = await fetch("/api/account/import-wif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wif, encrypted }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Import failed");
        }

        const result = await res.json();
        setState({ loading: false, error: null, success: true });

        return { address: result.address, publicKey: result.publicKey };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        setState({ loading: false, error: msg, success: false });
        return null;
      }
    },
    [user],
  );

  /**
   * Verify password (for sensitive operations)
   */
  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/account/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      return res.ok;
    } catch {
      return false;
    }
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
