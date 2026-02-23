import { create } from "zustand";
import { getMiniApp } from "./miniapp-registry";

export type SecretStatus = "active" | "expired" | "revoked";

export type SecretToken = {
  id: string;
  name: string;
  appId: string;
  appName?: string;
  secretType: string;
  status: SecretStatus;
  createdAt: string;
  lastUsed?: string;
};

type SecretsState = {
  tokens: SecretToken[];
  loading: boolean;
  error: string | null;
  fetchTokens: (appId?: string) => Promise<void>;
  createToken: (
    name: string,
    appId: string,
    secretType: string,
    secretValue: string,
  ) => Promise<void>;
  revokeToken: (id: string) => Promise<void>;
  clearError: () => void;
};

const STORAGE_KEY = "neo_miniapp_secrets_tokens_v1";

function readTokensFromStorage(): SecretToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object") as SecretToken[];
  } catch {
    return [];
  }
}

function writeTokensToStorage(tokens: SecretToken[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Ignore storage errors and keep in-memory state.
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function generateTokenId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useSecretsStore = create<SecretsState>((set) => ({
  tokens: [],
  loading: false,
  error: null,

  fetchTokens: async () => {
    set({ loading: true, error: null });
    const tokens = readTokensFromStorage();
    set({ tokens, loading: false });
  },

  createToken: async (name, appId, secretType, secretValue) => {
    const trimmedName = String(name || "").trim();
    const trimmedValue = String(secretValue || "").trim();
    const scopedAppId = String(appId || "").trim() || "global";

    if (!trimmedName || !trimmedValue) {
      set({ error: "Name and secret value are required" });
      throw new Error("invalid secret token input");
    }

    const existing = readTokensFromStorage();
    const app = scopedAppId === "global" ? undefined : getMiniApp(scopedAppId);
    const token: SecretToken = {
      id: generateTokenId(),
      name: trimmedName,
      appId: scopedAppId,
      appName: app?.name,
      secretType: String(secretType || "custom"),
      status: "active",
      createdAt: nowISO(),
    };
    const tokens = [token, ...existing];
    writeTokensToStorage(tokens);
    set({ tokens, error: null });
  },

  revokeToken: async (id) => {
    const tokenID = String(id || "").trim();
    if (!tokenID) return;
    const existing = readTokensFromStorage();
    const tokens = existing.map((token) =>
      token.id === tokenID
        ? {
            ...token,
            status: "revoked" as const,
            lastUsed: token.lastUsed || nowISO(),
          }
        : token,
    );
    writeTokensToStorage(tokens);
    set({ tokens, error: null });
  },

  clearError: () => set({ error: null }),
}));
