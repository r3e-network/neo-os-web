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
