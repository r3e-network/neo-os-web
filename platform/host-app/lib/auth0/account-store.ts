/**
 * Unified account store for wallet and OAuth modes
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountMode = "wallet" | "oauth" | null;

interface AccountState {
  mode: AccountMode;
  address: string;
  publicKey: string;
  hasEncryptedKey: boolean;
  oauthProvider: string | null;
}

interface AccountActions {
  setWalletMode: (address: string, publicKey: string) => void;
  setOAuthMode: (address: string, publicKey: string, provider: string) => void;
  clearAccount: () => void;
  checkEncryptedKey: (address: string) => Promise<boolean>;
}

type AccountStore = AccountState & AccountActions;

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      // State
      mode: null,
      address: "",
      publicKey: "",
      hasEncryptedKey: false,
      oauthProvider: null,

      // Actions
      setWalletMode: (address: string, publicKey: string) => {
        set({
          mode: "wallet",
          address,
          publicKey,
          hasEncryptedKey: false,
          oauthProvider: null,
        });
      },

      setOAuthMode: (address: string, publicKey: string, provider: string) => {
        set({
          mode: "oauth",
          address,
          publicKey,
          hasEncryptedKey: true,
          oauthProvider: provider,
        });
      },

      clearAccount: () => {
        set({
          mode: null,
          address: "",
          publicKey: "",
          hasEncryptedKey: false,
          oauthProvider: null,
        });
      },

      checkEncryptedKey: async (address: string) => {
        try {
          const response = await fetch(`/api/account/check-key?address=${address}`);
          const { hasKey } = await response.json();
          set({ hasEncryptedKey: hasKey });
          return hasKey;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "neo-account",
    },
  ),
);
