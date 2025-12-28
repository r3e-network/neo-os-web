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
}

interface OAuthActions {
  linkAccount: (provider: OAuthProvider) => Promise<void>;
  unlinkAccount: (provider: OAuthProvider) => void;
  clearError: () => void;
}

type OAuthStore = OAuthState & OAuthActions;

export const useOAuthStore = create<OAuthStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      loading: null,
      error: null,

      linkAccount: async (provider: OAuthProvider) => {
        set({ loading: provider, error: null });

        try {
          // Open OAuth popup
          const width = 500;
          const height = 600;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;

          const popup = window.open(
            `/api/oauth/${provider}`,
            `oauth-${provider}`,
            `width=${width},height=${height},left=${left},top=${top}`,
          );

          if (!popup) {
            throw new Error("Popup blocked. Please allow popups.");
          }

          // Wait for OAuth callback
          const account = await waitForOAuthCallback(popup, provider);

          const { accounts } = get();
          const filtered = accounts.filter((a) => a.provider !== provider);

          set({
            accounts: [...filtered, account],
            loading: null,
          });
        } catch (err) {
          set({
            loading: null,
            error: err instanceof Error ? err.message : "OAuth failed",
          });
        }
      },

      unlinkAccount: (provider: OAuthProvider) => {
        const { accounts } = get();
        set({
          accounts: accounts.filter((a) => a.provider !== provider),
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "oauth-accounts",
    },
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
