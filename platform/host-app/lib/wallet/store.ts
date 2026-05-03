import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  WalletAdapter,
  Nep21Adapter,
  NeoLineAdapter,
  O3Adapter,
  OneGateAdapter,
  WifAdapter,
  WalletBalance,
  WalletConnectionError,
  WalletNotInstalledError,
} from "./adapters";

export type WalletProvider = "nep21" | "neoline" | "o3" | "onegate" | "wif";

interface WalletState {
  connected: boolean;
  address: string;
  publicKey: string;
  provider: WalletProvider | null;
  balance: WalletBalance | null;
  loading: boolean;
  error: string | null;
}

interface WalletActions {
  connect: (provider: WalletProvider) => Promise<void>;
  connectWif: (wif: string) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

type WalletStore = WalletState & WalletActions;

const adapters: Record<WalletProvider, WalletAdapter> = {
  nep21: new Nep21Adapter(),
  neoline: new NeoLineAdapter(),
  o3: new O3Adapter(),
  onegate: new OneGateAdapter(),
  wif: new WifAdapter(),
};

let walletEventCleanup: (() => void) | null = null;

function clearWalletEventCleanup() {
  walletEventCleanup?.();
  walletEventCleanup = null;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // State
      connected: false,
      address: "",
      publicKey: "",
      provider: null,
      balance: null,
      loading: false,
      error: null,

      // Actions
      connect: async (provider: WalletProvider) => {
        set({ loading: true, error: null });

        const adapter = adapters[provider];
        clearWalletEventCleanup();

        try {
          if (provider === "wif") {
            throw new WalletConnectionError("Use connectWif() for direct WIF wallets");
          }
          const account = await adapter.connect();
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
            publicKey: account.publicKey,
            provider,
            balance,
            loading: false,
          });

          const cleanups: Array<() => void> = [];
          if (adapter.onAccountChanged) {
            cleanups.push(adapter.onAccountChanged(async () => {
              try {
                const nextAccount = await adapter.connect();
                const nextBalance = await adapter.getBalance(nextAccount.address);
                set({
                  connected: true,
                  address: nextAccount.address,
                  publicKey: nextAccount.publicKey,
                  provider,
                  balance: nextBalance,
                  loading: false,
                  error: null,
                });
              } catch (_e: unknown) {
                set({
                  connected: false,
                  address: "",
                  publicKey: "",
                  provider: null,
                  balance: null,
                  loading: false,
                  error: "Wallet account changed. Please reconnect.",
                });
              }
            }));
          }
          if (adapter.onNetworkChanged) {
            cleanups.push(adapter.onNetworkChanged(async () => {
              await get().refreshBalance();
            }));
          }
          walletEventCleanup = cleanups.length
            ? () => cleanups.forEach((cleanup) => cleanup())
            : null;
        } catch (err) {
          const message =
            err instanceof WalletNotInstalledError
              ? `Please install ${adapter.name} wallet`
              : "Wallet connection failed";

          set({ loading: false, error: message });
        }
      },

      connectWif: async (wif: string) => {
        set({ loading: true, error: null });
        clearWalletEventCleanup();

        const adapter = adapters.wif as WifAdapter;

        try {
          const account = await adapter.connectWithWif(wif);
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
            publicKey: account.publicKey,
            provider: "wif",
            balance,
            loading: false,
          });
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err);
          const message = raw.toLowerCase().includes("invalid wif")
            ? "Invalid WIF. Use a funded test wallet WIF and never paste production keys."
            : "Direct WIF connection failed";

          set({
            connected: false,
            address: "",
            publicKey: "",
            provider: null,
            balance: null,
            loading: false,
            error: message,
          });
        }
      },

      disconnect: () => {
        const { provider } = get();
        clearWalletEventCleanup();
        if (provider) {
          adapters[provider].disconnect();
        }

        set({
          connected: false,
          address: "",
          publicKey: "",
          provider: null,
          balance: null,
          error: null,
        });
      },

      refreshBalance: async () => {
        const { connected, address, provider } = get();
        if (!connected || !provider) return;

        try {
          const balance = await adapters[provider].getBalance(address);
          set({ balance });
        } catch (_e: unknown) {
          console.warn("[wallet-store] refreshBalance failed:", _e instanceof Error ? _e.message : String(_e));
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "neo-wallet",
      partialize: (state) => ({
        provider: state.provider === "wif" ? null : state.provider,
      }),
    },
  ),
);

/** Get adapter for current provider */
export function getWalletAdapter(): WalletAdapter | null {
  const provider = useWalletStore.getState().provider;
  return provider ? adapters[provider] : null;
}

const walletIcon = (label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><rect width="64" height="64" rx="16" fill="#00e599"/><text x="32" y="39" text-anchor="middle" font-size="20" font-weight="700" font-family="Arial, sans-serif" fill="#07111a">${label}</text></svg>`,
  )}`;

/** Available wallet options */
export const walletOptions = [
  { id: "nep21" as const, name: "NEP-21", icon: walletIcon("21") },
  { id: "neoline" as const, name: "NeoLine", icon: walletIcon("NL") },
  { id: "o3" as const, name: "O3", icon: walletIcon("O3") },
  { id: "onegate" as const, name: "OneGate", icon: walletIcon("OG") },
];
