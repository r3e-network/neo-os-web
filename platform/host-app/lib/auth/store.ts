import { create } from "zustand";
import { getWalletAdapter, useWalletStore, WalletProvider } from "@/lib/wallet/store";
import { getEdgeFunctionsBaseUrl } from "@/lib/edge";

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
  clearError: () => void;
  syncFromSession: (user: { sub?: string | null; email?: string | null } | null, walletAddr?: string) => void;
}

type AuthStore = AuthState & AuthActions;

function getAuthEdgeBaseUrl(): string {
  return getEdgeFunctionsBaseUrl();
}

async function authenticateWalletSession(address: string, publicKey: string) {
  const edgeBaseUrl = getAuthEdgeBaseUrl();

  const nonceResp = await fetch(`${edgeBaseUrl}/auth-wallet-nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
    signal: AbortSignal.timeout(10000),
  });
  if (!nonceResp.ok) throw new Error(`loginWallet: failed to get nonce (status=${nonceResp.status})`);
  const { nonce, message } = await nonceResp.json();

  const adapter = getWalletAdapter();
  if (!adapter) throw new Error("loginWallet: no wallet adapter available");
  const signResult = await adapter.signMessage(message);

  const authResp = await fetch(`${edgeBaseUrl}/auth-wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      public_key: publicKey || signResult.publicKey,
      signature: signResult.data,
      message,
      nonce,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!authResp.ok) throw new Error(`loginWallet: authentication failed (status=${authResp.status})`);

  return authResp.json() as Promise<{ access_token: string; user: { id: string } }>;
}

function toWalletLoginError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = raw.toLowerCase();
  if (lower.includes("invalid wif") || lower.includes("direct wif")) {
    return "Invalid WIF. Use a funded test wallet WIF and never paste production keys.";
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
  return "Could not connect wallet. Please try again or use a different wallet.";
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
      const { address, publicKey } = useWalletStore.getState();
      if (!address) throw new Error("loginWallet: wallet connection failed — address is empty after connect()");

      const { access_token, user } = await authenticateWalletSession(address, publicKey);

      sessionStorage.setItem("sb-access-token", access_token);
      set({
        authenticated: true,
        userId: user.id,
        method: "wallet",
        walletAddress: address,
        walletType: "external",
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: toWalletLoginError(err) });
    }
  },

  loginWif: async (wif: string) => {
    set({ loading: true, error: null });
    try {
      const walletStore = useWalletStore.getState();
      await walletStore.connectWif(wif);
      const { address, publicKey } = useWalletStore.getState();
      if (!address) throw new Error("loginWallet: direct WIF connection failed — address is empty after connectWif()");

      const { access_token, user } = await authenticateWalletSession(address, publicKey);

      sessionStorage.setItem("sb-access-token", access_token);
      set({
        authenticated: true,
        userId: user.id,
        method: "wallet",
        walletAddress: address,
        walletType: "external",
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: toWalletLoginError(err) });
    }
  },

  logout: async () => {
    const { method } = get();
    useWalletStore.getState().disconnect();
    sessionStorage.removeItem("sb-access-token");
    try { localStorage.removeItem("neo_miniapp_auth_jwt"); } catch (e) { console.warn("[auth] localStorage removal failed (SSR?):", e instanceof Error ? e.message : String(e)); }
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
