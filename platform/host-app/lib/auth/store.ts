import { create } from "zustand";
import { useWalletStore, WalletProvider } from "@/lib/wallet/store";
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
  logout: () => Promise<void>;
  clearError: () => void;
  syncFromSession: (user: { sub?: string | null; email?: string | null } | null, walletAddr?: string) => void;
}

type AuthStore = AuthState & AuthActions;

function getAuthEdgeBaseUrl(): string {
  return getEdgeFunctionsBaseUrl();
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
      if (!address) throw new Error("wallet connection failed");

      const edgeBaseUrl = getAuthEdgeBaseUrl();

      const nonceResp = await fetch(`${edgeBaseUrl}/auth-wallet-nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        signal: AbortSignal.timeout(10000),
      });
      if (!nonceResp.ok) throw new Error("failed to get nonce");
      const { nonce, message } = await nonceResp.json();

      const adapter = (await import("@/lib/wallet/store")).getWalletAdapter();
      if (!adapter) throw new Error("no wallet adapter");
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
      if (!authResp.ok) throw new Error("authentication failed");
      const { access_token, user } = await authResp.json();

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
      set({ loading: false, error: err instanceof Error ? err.message : "login failed" });
    }
  },

  logout: async () => {
    const { method } = get();
    useWalletStore.getState().disconnect();
    sessionStorage.removeItem("sb-access-token");
    try { localStorage.removeItem("neo_miniapp_auth_jwt"); } catch { /* SSR guard */ }
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
