import { create } from "zustand";
import { getWalletAdapter, useWalletStore, WalletProvider } from "@/lib/wallet/store";
import { getEdgeFunctionsBaseUrl } from "@/lib/edge";
import { getPublicSupabaseEnv } from "@/lib/supabase-env";

type AuthMethod = "social" | "wallet" | null;

interface AuthState {
  authenticated: boolean;
  userId: string;
  method: AuthMethod;
  walletAddress: string;
  walletType: "custodial" | "external" | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  loginSocial: (provider: string) => void;
  loginWallet: (provider: WalletProvider) => Promise<void>;
  loginWif: (wif: string) => Promise<void>;
  logout: () => Promise<void>;
  clearWalletSession: () => void;
  clearError: () => void;
  syncFromSession: (user: { sub?: string | null; email?: string | null } | null, walletAddr?: string) => void;
}

type AuthStore = AuthState & AuthActions;

class WalletAuthUnavailableError extends Error {
  constructor(message = "Wallet authentication service is not configured.") {
    super(message);
    this.name = "WalletAuthUnavailableError";
  }
}

function getAuthEdgeBaseUrl(): string {
  return getEdgeFunctionsBaseUrl();
}

function getWalletAuthHeaders(): HeadersInit {
  const { anonKey } = getPublicSupabaseEnv();
  const token = anonKey.trim();
  return token
    ? {
        apikey: token,
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function asAuthUnavailable(err: unknown, fallback: string): WalletAuthUnavailableError {
  if (err instanceof WalletAuthUnavailableError) return err;
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return new WalletAuthUnavailableError(message || fallback);
}

async function requestWalletAuthJson<T>(
  path: string,
  init: RequestInit,
  failureMessage: string,
): Promise<T> {
  const edgeBaseUrl = getAuthEdgeBaseUrl();
  if (!edgeBaseUrl) {
    throw new WalletAuthUnavailableError();
  }
  const endpoint = `/api/edge/${encodeURIComponent(path)}`;

  try {
    const resp = await fetch(endpoint, init);
    if (!resp.ok) {
      throw new WalletAuthUnavailableError(`${failureMessage} (status=${resp.status})`);
    }
    return (await resp.json()) as T;
  } catch (err: unknown) {
    throw asAuthUnavailable(err, failureMessage);
  }
}

async function authenticateWalletSession(address: string, publicKey: string) {
  const edgeBaseUrl = getAuthEdgeBaseUrl();
  if (!edgeBaseUrl) {
    throw new WalletAuthUnavailableError();
  }
  const authHeaders = getWalletAuthHeaders();

  const { nonce, message } = await requestWalletAuthJson<{ nonce: string; message: string }>(
    "auth-wallet-nonce",
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
      signal: AbortSignal.timeout(10000),
    },
    "loginWallet: failed to get nonce",
  );

  const adapter = getWalletAdapter();
  if (!adapter) throw new Error("loginWallet: no wallet adapter available");
  const signResult = await adapter.signMessage(message);

  return requestWalletAuthJson<{ access_token: string; user: { id: string } }>(
    "auth-wallet",
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        public_key: publicKey || signResult.publicKey,
        signature: signResult.data,
        message,
        nonce,
      }),
      signal: AbortSignal.timeout(10000),
    },
    "loginWallet: authentication failed",
  );
}

function toWalletLoginError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = raw.toLowerCase();
  if (lower.includes("invalid wif") || lower.includes("invalid developer key") || lower.includes("developer key")) {
    return "Invalid developer key. Use a funded test wallet key and never paste production keys.";
  }
  if (lower.includes("rejected") || lower.includes("denied")) {
    return "Wallet connection was rejected. Please try again and approve the connection request.";
  }
  if (lower.includes("not found") || lower.includes("not installed")) {
    return "Wallet not detected. Please install a compatible Neo wallet extension.";
  }
  if (lower.includes("timeout")) {
    return "Connection timed out. Please check your wallet is unlocked and try again.";
  }
  if (
    lower.includes("wallet is on") ||
    lower.includes("wallet network is not verified") ||
    lower.includes("switch wallet network")
  ) {
    return raw;
  }
  return "Could not connect wallet. Please try again or use a different wallet.";
}

function isWalletAuthUnavailable(err: unknown): boolean {
  return err instanceof WalletAuthUnavailableError;
}

function clearStoredWalletSessionTokens() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("sb-access-token");
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("neo_miniapp_auth_jwt");
    }
  } catch (e) {
    console.warn(
      "[auth] localStorage removal failed (SSR?):",
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Drop the wallet-bound auth session from the in-memory store. A social login
 * (Auth0) is preserved because its session lives in its own cookie/lane and is
 * not affected by the wallet JWT being cleared. `setWalletSession` lets the
 * cross-tab listener re-derive state WITHOUT mutating storage (which would
 * re-fire the storage event and loop).
 */
function clearWalletAuthState(
  get: () => AuthStore,
  set: (state: Partial<AuthStore>) => void,
) {
  const state = get();
  const keepSocialSession = state.method === "social";
  set({
    authenticated: keepSocialSession ? state.authenticated : false,
    userId: keepSocialSession ? state.userId : "",
    method: keepSocialSession ? "social" : null,
    walletAddress: "",
    walletType: null,
    loading: false,
    error: null,
  });
}

function completeWalletOnlyLogin(set: (state: Partial<AuthStore>) => void) {
  const { connected, address } = useWalletStore.getState();
  if (!connected || !address) {
    throw new Error("loginWallet: wallet-only fallback requires a connected wallet");
  }
  set({
    authenticated: false,
    userId: "",
    method: null,
    walletAddress: address,
    walletType: "external",
    loading: false,
    error: null,
  });
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  authenticated: false,
  userId: "",
  method: null,
  walletAddress: "",
  walletType: null,
  loading: false,
  error: null,

  loginSocial: (provider: string) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    window.location.href = `/api/auth/login-social?provider=${encodeURIComponent(provider)}`;
  },

  loginWallet: async (provider: WalletProvider) => {
    set({ loading: true, error: null });
    try {
      const walletStore = useWalletStore.getState();
      await walletStore.connect(provider);
      const { connected, address, publicKey } = useWalletStore.getState();
      if (!connected || !address) {
        throw new Error("loginWallet: wallet connection failed — wallet is not connected after connect()");
      }

      const { access_token, user } = await authenticateWalletSession(address, publicKey);

      sessionStorage.setItem("sb-access-token", access_token);
      // Also persist to localStorage so same-origin miniapp iframes (whose
      // EdgeClient reads `neo_miniapp_auth_jwt`) can attach the wallet session
      // to their OS calls. sessionStorage is not reliably shared into iframes.
      try { localStorage.setItem("neo_miniapp_auth_jwt", access_token); } catch (e) { console.warn("[auth] localStorage write failed (SSR?):", e instanceof Error ? e.message : String(e)); }
      set({
        authenticated: true,
        userId: user.id,
        method: "wallet",
        walletAddress: address,
        walletType: "external",
        loading: false,
      });
    } catch (err) {
      if (isWalletAuthUnavailable(err)) {
        completeWalletOnlyLogin(set);
        return;
      }
      set({ loading: false, error: toWalletLoginError(err) });
    }
  },

  loginWif: async (wif: string) => {
    set({ loading: true, error: null });
    try {
      const walletStore = useWalletStore.getState();
      await walletStore.connectWif(wif);
      const { connected, address, publicKey } = useWalletStore.getState();
      if (!connected || !address) {
        throw new Error("loginWallet: developer key connection failed — wallet is not connected after connectWif()");
      }

      const { access_token, user } = await authenticateWalletSession(address, publicKey);

      sessionStorage.setItem("sb-access-token", access_token);
      // Also persist to localStorage so same-origin miniapp iframes (whose
      // EdgeClient reads `neo_miniapp_auth_jwt`) can attach the wallet session
      // to their OS calls. sessionStorage is not reliably shared into iframes.
      try { localStorage.setItem("neo_miniapp_auth_jwt", access_token); } catch (e) { console.warn("[auth] localStorage write failed (SSR?):", e instanceof Error ? e.message : String(e)); }
      set({
        authenticated: true,
        userId: user.id,
        method: "wallet",
        walletAddress: address,
        walletType: "external",
        loading: false,
      });
    } catch (err) {
      if (isWalletAuthUnavailable(err)) {
        completeWalletOnlyLogin(set);
        return;
      }
      set({ loading: false, error: toWalletLoginError(err) });
    }
  },

  logout: async () => {
    const { method } = get();
    useWalletStore.getState().disconnect();
    clearStoredWalletSessionTokens();
    set({
      authenticated: false,
      userId: "",
      method: null,
      walletAddress: "",
      walletType: null,
      error: null,
    });
    if (method === "social") {
      window.location.href = "/api/auth/logout";
    }
  },

  clearWalletSession: () => {
    clearStoredWalletSessionTokens();
    clearWalletAuthState(get, set);
  },

  clearError: () => set({ error: null }),

  syncFromSession: (user, walletAddr) => {
    if (user?.sub) {
      set({
        authenticated: true,
        userId: user.sub,
        method: "social",
        walletAddress: walletAddr || "",
        walletType: walletAddr ? "custodial" : null,
      });
    }
  },
}));

/**
 * React to wallet-session JWT changes made by another tab.
 *
 * `sb-access-token` lives in sessionStorage (per-tab, never shared), so only the
 * localStorage `neo_miniapp_auth_jwt` can signal a cross-tab logout. When another
 * tab logs out / disconnects the wallet it clears that key. But each tab mints
 * its OWN wallet JWT during login and keeps it in its own sessionStorage, so a
 * logout in tab A must NOT tear down tab B's still-valid per-tab session. This
 * listener therefore only drops the local auth view when this tab's OWN access
 * token is also gone — i.e. the shared wallet session is truly dead here too.
 * It only re-derives state — it never writes storage — so it cannot loop with
 * the originating tab's clear.
 */
const AUTH_JWT_STORAGE_KEY = "neo_miniapp_auth_jwt";
const AUTH_SESSION_TOKEN_KEY = "sb-access-token";
let crossTabAuthSyncInstalled = false;
function installCrossTabAuthSync(): void {
  if (crossTabAuthSyncInstalled || typeof window === "undefined") return;
  crossTabAuthSyncInstalled = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== AUTH_JWT_STORAGE_KEY) return;
    const state = useAuthStore.getState();
    const hasExternalWalletSession =
      state.method === "wallet" || state.walletType === "external";
    if (!hasExternalWalletSession) return;
    if (event.newValue) return;
    // The shared wallet JWT was cleared in another tab. Only tear down THIS
    // tab's auth view when this tab does not still hold its own per-tab access
    // token — otherwise a logout in one tab would kill a live, independently
    // authenticated session in another (e.g. a dev-key tab beside an external-
    // wallet tab, or two separately-logged-in tabs).
    const ownToken =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(AUTH_SESSION_TOKEN_KEY)
        : null;
    if (ownToken) return;
    clearWalletAuthState(useAuthStore.getState, useAuthStore.setState);
  });
}

installCrossTabAuthSync();
