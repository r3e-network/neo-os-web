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

let inMemoryTokens: SecretToken[] = [];

function readTokensFromStorage(): SecretToken[] {
  return inMemoryTokens.slice();
}

function writeTokensToStorage(tokens: SecretToken[]): void {
  inMemoryTokens = tokens.slice();
}

function nowISO(): string {
  return new Date().toISOString();
}

function generateTokenId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sec_${crypto.randomUUID()}`;
  }
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
