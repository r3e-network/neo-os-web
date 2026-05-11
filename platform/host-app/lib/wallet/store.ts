import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  WalletAdapter,
  WalletAccount,
  NeoWalletNetwork,
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
export type ConnectableWalletProvider = Exclude<WalletProvider, "wif">;

export type WalletOption = {
  id: ConnectableWalletProvider;
  name: string;
  icon: string;
  description: string;
  protocol: "NEP-21" | "Legacy dAPI";
  recommended?: boolean;
};

interface WalletState {
  connected: boolean;
  address: string;
  publicKey: string;
  network: NeoWalletNetwork | null;
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

async function readWalletNetwork(
  adapter: WalletAdapter,
  account?: WalletAccount,
): Promise<NeoWalletNetwork | null> {
  if (account?.network) return account.network;
  if (!adapter.getNetwork) return null;
  try {
    return await adapter.getNetwork();
  } catch (_e: unknown) {
    return null;
  }
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // State
      connected: false,
      address: "",
      publicKey: "",
      network: null,
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
          const network = await readWalletNetwork(adapter, account);
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
            publicKey: account.publicKey,
            network,
            provider,
            balance,
            loading: false,
          });

          const cleanups: Array<() => void> = [];
          if (adapter.onAccountChanged) {
            cleanups.push(adapter.onAccountChanged(async () => {
              try {
                const nextAccount = await adapter.connect();
                const nextNetwork = await readWalletNetwork(adapter, nextAccount);
                const nextBalance = await adapter.getBalance(nextAccount.address);
                set({
                  connected: true,
                  address: nextAccount.address,
                  publicKey: nextAccount.publicKey,
                  network: nextNetwork,
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
                  network: null,
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
              set({ network: await readWalletNetwork(adapter) });
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
          const network = await readWalletNetwork(adapter, account);
          const balance = await adapter.getBalance(account.address);

          set({
            connected: true,
            address: account.address,
            publicKey: account.publicKey,
            network,
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
            network: null,
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
          network: null,
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
          const network = await readWalletNetwork(adapters[provider]);
          set({ balance, network });
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

const nep21Icon =
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="NEP-21"><rect width="64" height="64" rx="16" fill="#07111a"/><path d="M17 20.5 32 12l15 8.5v23L32 52l-15-8.5v-23Z" fill="#00e599"/><path d="M25 24h14v4H29v4h8v4h-8v4h10v4H25V24Z" fill="#07111a"/></svg>`,
  )}`;

/** Available wallet options */
export const walletOptions: WalletOption[] = [
  {
    id: "nep21",
    name: "NEP-21 Wallet",
    icon: nep21Icon,
    description: "Standard Neo dAPI provider exposed by OneGate and compatible wallets.",
    protocol: "NEP-21",
    recommended: true,
  },
  {
    id: "onegate",
    name: "OneGate",
    icon: "/miniapps/gas-lucky-pool/onegate-logo.png",
    description: "OneGate host wallet fallback. Prefer NEP-21 when it is injected.",
    protocol: "NEP-21",
  },
  {
    id: "neoline",
    name: "NeoLine",
    icon: "https://neoline.io/assets/images/home/neoline.svg",
    description: "NeoLine extension for Neo N3 accounts and contract invokes.",
    protocol: "Legacy dAPI",
  },
  {
    id: "o3",
    name: "O3 Wallet",
    icon: "https://docs.o3.app/~gitbook/icon?size=large&theme=light",
    description: "O3 wallet fallback when its browser provider is injected.",
    protocol: "Legacy dAPI",
  },
];

export const walletOptionsById: Partial<Record<WalletProvider, WalletOption>> =
  Object.fromEntries(walletOptions.map((option) => [option.id, option]));
