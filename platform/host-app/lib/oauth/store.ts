import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OAuthProvider = "google" | "twitter" | "github";

export interface OAuthAccount {
  provider: OAuthProvider;
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  linkedAt: string;
}

interface OAuthState {
  accounts: OAuthAccount[];
  loading: OAuthProvider | null;
  error: string | null;
  initialized: boolean;
}

interface OAuthActions {
  linkAccount: (provider: OAuthProvider, walletAddress: string) => Promise<void>;
  unlinkAccount: (provider: OAuthProvider, walletAddress: string) => Promise<void>;
  loadAccounts: (walletAddress: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

type OAuthStore = OAuthState & OAuthActions;

export const useOAuthStore = create<OAuthStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      loading: null,
      error: null,
      initialized: false,

      loadAccounts: async (walletAddress: string) => {
        try {
          const res = await fetch(`/api/oauth/accounts?wallet_address=${walletAddress}`);
          if (res.ok) {
            const data = await res.json();
            set({ accounts: data.accounts || [], initialized: true });
          }
        } catch {
          set({ initialized: true });
        }
      },

      linkAccount: async (provider: OAuthProvider, walletAddress: string) => {
        set({ loading: provider, error: null });

        try {
          const width = 500;
          const height = 600;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;

          const popup = window.open(
            `/api/oauth/${provider}?wallet_address=${walletAddress}`,
            `oauth-${provider}`,
            `width=${width},height=${height},left=${left},top=${top}`,
          );

          if (!popup) {
            throw new Error("Popup blocked. Please allow popups.");
          }

          const account = await waitForOAuthCallback(popup, provider);
          const { accounts } = get();
          const filtered = accounts.filter((a) => a.provider !== provider);

          set({ accounts: [...filtered, account], loading: null });
        } catch (err) {
          set({ loading: null, error: err instanceof Error ? err.message : "OAuth failed" });
        }
      },

      unlinkAccount: async (provider: OAuthProvider, walletAddress: string) => {
        try {
          await fetch(`/api/oauth/unlink`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, wallet_address: walletAddress }),
          });
          const { accounts } = get();
          set({ accounts: accounts.filter((a) => a.provider !== provider) });
        } catch {
          // Silent fail
        }
      },

      clearError: () => set({ error: null }),
      reset: () => set({ accounts: [], initialized: false, error: null }),
    }),
    { name: "oauth-accounts" },
  ),
);

/** Wait for OAuth popup callback */
function waitForOAuthCallback(popup: Window, provider: OAuthProvider): Promise<OAuthAccount> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("OAuth timeout"));
    }, 120000);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "oauth-success" && event.data?.provider === provider) {
        cleanup();
        resolve(event.data.account);
      }

      if (event.data?.type === "oauth-error" && event.data?.provider === provider) {
        cleanup();
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("OAuth cancelled"));
      }
    }, 500);

    const cleanup = () => {
      clearTimeout(timeout);
      clearInterval(checkClosed);
      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);
  });
}

/** OAuth provider metadata */
export const oauthProviders = [
  { id: "google" as const, name: "Google", icon: "🔵", color: "#4285F4" },
  { id: "twitter" as const, name: "Twitter", icon: "🐦", color: "#1DA1F2" },
  { id: "github" as const, name: "GitHub", icon: "🐙", color: "#333333" },
];
