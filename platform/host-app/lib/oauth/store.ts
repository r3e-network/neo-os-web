import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@supabase/supabase-js";

const OAUTH_STORAGE_KEY = "oauth-accounts";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { global: { headers: { Authorization: `Bearer ${typeof window !== "undefined" ? sessionStorage.getItem("sb-access-token") || "" : ""}` } } },
  );

export type OAuthProvider = "google" | "twitter" | "github";

export type OAuthProviderMetadata = {
  id: OAuthProvider;
  name: string;
  iconSrc: string;
  color: string;
};

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
  fetchLinkedAccounts: (userId: string) => Promise<void>;
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

      fetchLinkedAccounts: async (userId: string) => {
        try {
          const { data, error: fetchErr } = await getSupabase()
            .from("linked_identities")
            .select("provider,provider_user_id,email,name,avatar,linked_at")
            .eq("neohub_account_id", userId);
          if (fetchErr || !data) return;
          const accounts: OAuthAccount[] = data.map((row) => ({
            provider: row.provider as OAuthProvider,
            id: row.provider_user_id,
            email: row.email ?? undefined,
            name: row.name ?? undefined,
            avatar: row.avatar ?? undefined,
            linkedAt: row.linked_at,
          }));
          set({ accounts });
        } catch (e: unknown) {
          console.error("[oauth] fetchLinkedAccounts failed:", e instanceof Error ? e.message : String(e));
          // silently fail - linked accounts load failure is non-critical
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: OAUTH_STORAGE_KEY,
    },
  ),
);

/**
 * Keep the linked-accounts view in sync across tabs.
 *
 * Linking/unlinking an OAuth identity in one tab persists to localStorage, but
 * `persist` only re-reads on the originating tab's load. Without this listener a
 * second tab keeps rendering a stale linked-accounts list until reload. The
 * `storage` event fires in every other same-origin tab, so rehydrating here
 * converges the account-settings UI across tabs. This is display-only state
 * (the auth session itself lives in sessionStorage), so a plain rehydrate is
 * safe — it never affects wallet/network truth.
 */
let crossTabOAuthSyncInstalled = false;
function installCrossTabOAuthSync(): void {
  if (crossTabOAuthSyncInstalled || typeof window === "undefined") return;
  crossTabOAuthSyncInstalled = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== OAUTH_STORAGE_KEY) return;
    void useOAuthStore.persist.rehydrate();
  });
}

installCrossTabOAuthSync();

/** Wait for OAuth popup callback */
function waitForOAuthCallback(popup: Window, provider: OAuthProvider): Promise<OAuthAccount> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("OAuth timeout"));
    }, 120000);

    const handleMessage = (event: MessageEvent) => {
      const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;
      if (!allowedOrigin) {
        cleanup();
        reject(new Error("OAuth callback origin not configured"));
        return;
      }
      if (event.origin !== allowedOrigin) return;
      if (event.source !== popup) return;

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

/** @internal Exposed for testing only */
export const __test__ = { waitForOAuthCallback };

/** OAuth provider metadata */
export const oauthProviders: OAuthProviderMetadata[] = [
  { id: "google", name: "Google", iconSrc: "/brand/oauth-google.svg", color: "#4285F4" },
  { id: "twitter", name: "X / Twitter", iconSrc: "/brand/oauth-x.svg", color: "#111827" },
  { id: "github", name: "GitHub", iconSrc: "/brand/oauth-github.svg", color: "#181717" },
];
