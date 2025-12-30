/**
 * useWallet - Wallet composable for uni-app
 */
import { ref, onMounted } from "vue";
import { getSDKSync, waitForSDK } from "../bridge";

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.neo-service-layer.io";

export interface WalletBalances {
  GAS: string;
  NEO: string;
  [key: string]: string;
}

export interface WalletTransaction {
  tx_hash: string;
  block: number;
  timestamp: string;
  asset: string;
  amount: string;
  direction: "in" | "out";
  counterparty: string;
}

export function useWallet() {
  const address = ref<string | null>(null);
  const balances = ref<WalletBalances>({ GAS: "0", NEO: "0" });
  const isConnected = ref(false);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const connect = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      address.value = await sdk.wallet.getAddress();
      isConnected.value = true;
    } catch (e) {
      error.value = e as Error;
    } finally {
      isLoading.value = false;
    }
  };

  const invokeIntent = async (requestId: string) => {
    const sdk = getSDKSync();
    if (!sdk?.wallet?.invokeIntent) {
      throw new Error("invokeIntent not available");
    }
    return sdk.wallet.invokeIntent(requestId);
  };

  const getBalance = async (): Promise<WalletBalances> => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${API_BASE}/wallet-balance`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to get balance");
      }
      const data = await res.json();
      balances.value = data.balances;
      return data.balances;
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const getTransactions = async (limit = 20): Promise<WalletTransaction[]> => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${API_BASE}/wallet-transactions?limit=${limit}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to get transactions");
      }
      const data = await res.json();
      return data.transactions;
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    const sdk = getSDKSync();
    if (sdk) {
      sdk.wallet
        .getAddress()
        .then((addr) => {
          address.value = addr;
          isConnected.value = true;
        })
        .catch(() => {});
    }
  });

  return { address, balances, isConnected, isLoading, error, connect, invokeIntent, getBalance, getTransactions };
}
