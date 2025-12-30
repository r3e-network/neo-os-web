import { create } from "zustand";
import { useWalletStore } from "@/lib/wallet/store";

// Helper to get wallet address for API calls
const getWalletHeaders = (): Record<string, string> => {
  const { address } = useWalletStore.getState();
  return address ? { "x-wallet-address": address } : {};
};

export interface SecretToken {
  id: string;
  name: string;
  appId: string;
  appName: string;
  secretType: "api_key" | "encryption_key" | "custom";
  createdAt: string;
  expiresAt: string | null;
  lastUsed: string | null;
  status: "active" | "expired" | "revoked";
}

interface SecretsState {
  tokens: SecretToken[];
  loading: boolean;
  error: string | null;
}

interface SecretsActions {
  fetchTokens: (appId?: string) => Promise<void>;
  createToken: (name: string, appId: string, secretType: string, value: string) => Promise<void>;
  revokeToken: (id: string) => Promise<void>;
  clearError: () => void;
}

type SecretsStore = SecretsState & SecretsActions;

export const useSecretsStore = create<SecretsStore>((set, get) => ({
  tokens: [],
  loading: false,
  error: null,

  fetchTokens: async (appId?: string) => {
    set({ loading: true, error: null });
    try {
      const url = appId ? `/api/secrets/tokens?appId=${appId}` : "/api/secrets/tokens";
      const res = await fetch(url, { headers: getWalletHeaders() });
      if (!res.ok) throw new Error("Failed to fetch tokens");
      const data = await res.json();
      set({ tokens: data.tokens || [], loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch",
      });
    }
  },

  createToken: async (name: string, appId: string, secretType: string, value: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/secrets/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getWalletHeaders() },
        body: JSON.stringify({ name, appId, secretType, value }),
      });
      if (!res.ok) throw new Error("Failed to create token");
      const data = await res.json();

      const { tokens } = get();
      set({ tokens: [...tokens, data.token], loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to create",
      });
      throw err;
    }
  },

  revokeToken: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/secrets/tokens/${id}`, {
        method: "DELETE",
        headers: getWalletHeaders(),
      });
      if (!res.ok) throw new Error("Failed to revoke token");

      const { tokens } = get();
      set({
        tokens: tokens.map((t) => (t.id === id ? { ...t, status: "revoked" as const } : t)),
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to revoke",
      });
    }
  },

  clearError: () => set({ error: null }),
}));
