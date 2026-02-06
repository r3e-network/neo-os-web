/**
 * useWallet - Wallet composable for uni-app
 * Provides wallet connection, balance, and transaction management
 */
import { ref, onMounted, onUnmounted } from "vue";
import { getSDKSync, waitForSDK, subscribeToWalletState, getWalletState, type HostWalletState } from "../bridge";
import { apiGet } from "../api";

export interface RequireConnectionOptions {
  /** Show prompt instead of throwing error (default: true) */
  showPrompt?: boolean;
  /** Custom error message */
  errorMessage?: string;
}

export interface WalletBalances {
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

// Per-instance fallback state is managed inside onMounted to avoid
// cross-instance race conditions from module-level mutable globals.

export function useWallet() {
  const address = ref<string | null>(null);
  const balances = ref<WalletBalances>({});
  const chainId = ref<string | null>(null);
  const chainType = ref<string | null>(null);
  const appChainId = ref<string | null>(null);
  const supportedChains = ref<string[]>([]);
  const isConnected = ref(false);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const showConnectionPrompt = ref(false);
  const connectionPromptMessage = ref<string | null>(null);

  const normalizeBalances = (state: HostWalletState | null): WalletBalances => {
    if (!state) return {};
    if (state.balances && Object.keys(state.balances).length > 0) {
      return { ...state.balances };
    }
    if (state.balance) {
      const out: WalletBalances = {};
      const nativeSymbol = state.balance.nativeSymbol || (state.chainType === "neo-n3" ? "GAS" : "NATIVE");
      out[nativeSymbol] = state.balance.native || "0";
      if (state.balance.governance || state.balance.governanceSymbol) {
        const governanceSymbol = state.balance.governanceSymbol || (state.chainType === "neo-n3" ? "NEO" : "GOV");
        out[governanceSymbol] = state.balance.governance || "0";
      }
      return out;
    }
    return {};
  };

  const applyHostState = (state: HostWalletState) => {
    if (state.connected && state.address) {
      address.value = state.address;
      isConnected.value = true;
    } else {
      address.value = null;
      isConnected.value = false;
    }
    chainId.value = state.chainId ?? null;
    chainType.value = state.chainType ?? null;
    balances.value = normalizeBalances(state);
  };

  const applyAppConfig = (config?: { chainId?: string | null; supportedChains?: string[] } | null) => {
    if (!config) return;
    appChainId.value = config.chainId ?? null;
    supportedChains.value = Array.isArray(config.supportedChains) ? config.supportedChains : [];
  };

  const getAppConfig = async () => {
    const sdk = await waitForSDK();
    const config = sdk.getConfig?.();
    applyAppConfig(config);
    return config;
  };

  const connect = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      const addr = await sdk.wallet.getAddress();
      if (!addr) {
        throw new Error("wallet returned empty address");
      }
      address.value = addr;
      isConnected.value = true;
      const config = sdk.getConfig?.();
      chainId.value = config?.chainId ?? null;
      chainType.value = config?.chainType ?? null;
      applyAppConfig(config);
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

  const invokeContract = async (params: import("../types").ContractParams & { args: unknown[] }) => {
    const sdk = await waitForSDK();
    const config = sdk.getConfig?.();
    const contractAddress = params.contractAddress || params.scriptHash || params.contractHash;
    const method = params.method || params.operation;
    if (!contractAddress || !method) {
      throw new Error("contract address and method required");
    }
    // Use the generic invoke method path
    return sdk.invoke("invokeFunction", {
      contract: contractAddress,
      method,
      args: params.args,
      chainId: config?.chainId,
      chainType: config?.chainType,
    });
  };

  const invokeRead = async (params: import("../types").ContractParams) => {
    const sdk = await waitForSDK();
    const config = sdk.getConfig?.();
    const contractAddress =
      params.contractAddress || params.scriptHash || params.contractHash || config?.contractAddress;
    const method = params.method || params.operation;
    if (!contractAddress) {
      throw new Error("contract address not configured");
    }
    if (!method) {
      throw new Error("method required");
    }
    return sdk.invoke("invokeRead", {
      contract: contractAddress,
      method,
      args: params.args || [],
      chainId: params.chainId || config?.chainId,
      chainType: params.chainType || config?.chainType,
    });
  };

  const getContractAddress = async () => {
    const sdk = await waitForSDK();
    const local = sdk.getConfig?.();
    if (local?.contractAddress) return local.contractAddress;
    if (local?.chainId && local?.chainContracts?.[local.chainId]?.address) {
      return local.chainContracts[local.chainId].address || null;
    }
    if (sdk.invoke) {
      try {
        const remote = (await sdk.invoke("getConfig")) as
          | {
              contractAddress?: string | null;
              chainId?: string | null;
              chainContracts?: Record<string, { address?: string | null }>;
            }
          | undefined;
        if (remote?.contractAddress) return remote.contractAddress;
        if (remote?.chainId && remote?.chainContracts?.[remote.chainId]?.address) {
          return remote.chainContracts[remote.chainId].address || null;
        }
      } catch {
        // Ignore and fall through to null
      }
    }
    return null;
  };

  const switchChain = async (targetChainId: string) => {
    const sdk = await waitForSDK();
    if (sdk.wallet.switchChain) {
      await sdk.wallet.switchChain(targetChainId);
      // Optimistically update state or wait for event?
      // Event listener will update state.
      chainId.value = targetChainId;
    } else {
      throw new Error("switchChain not supported by SDK");
    }
  };

  const switchToAppChain = async (fallbackChainId?: string) => {
    const config = await getAppConfig();
    const target =
      config?.chainId ||
      (Array.isArray(config?.supportedChains) && config.supportedChains.length > 0
        ? config.supportedChains[0]
        : null) ||
      fallbackChainId ||
      null;
    if (!target) {
      throw new Error("app chain not configured");
    }
    await switchChain(target);
  };

  const getAddress = async () => {
    const sdk = await waitForSDK();
    return sdk.wallet.getAddress();
  };

  const signMessage = async (message: string) => {
    const sdk = await waitForSDK();
    if (!sdk.wallet?.signMessage) {
      throw new Error("signMessage not available");
    }
    return sdk.wallet.signMessage(message);
  };

  const getBalance = async (token?: string): Promise<string | WalletBalances> => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      const config = sdk.getConfig?.();
      const activeChainId = config?.chainId || chainId.value;
      const query = activeChainId ? `?chain_id=${encodeURIComponent(activeChainId)}` : "";
      const data = await apiGet<{ balances: WalletBalances }>(`/wallet-balance${query}`);
      // Safely handle missing or invalid balances
      const safeBalances = data?.balances ?? {};
      balances.value = safeBalances;

      if (token) {
        return safeBalances[token] || "0";
      }
      return safeBalances;
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
      // Validate limit parameter
      const validLimit = Number.isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100);
      const sdk = await waitForSDK();
      const config = sdk.getConfig?.();
      const activeChainId = config?.chainId || chainId.value;
      const params = new URLSearchParams({ limit: String(validLimit) });
      if (activeChainId) params.set("chain_id", activeChainId);
      const data = await apiGet<{ transactions: WalletTransaction[] }>(`/wallet-transactions?${params.toString()}`);
      return data?.transactions ?? [];
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Check if wallet is connected, show prompt if not
   * @returns true if connected, false otherwise
   */
  const requireConnection = (options: RequireConnectionOptions = {}): boolean => {
    const { showPrompt = true, errorMessage } = options;

    if (isConnected.value) {
      return true;
    }

    if (showPrompt) {
      connectionPromptMessage.value = errorMessage || null;
      showConnectionPrompt.value = true;
    }

    return false;
  };

  /**
   * Close the connection prompt
   */
  const closeConnectionPrompt = () => {
    showConnectionPrompt.value = false;
    connectionPromptMessage.value = null;
  };

  /**
   * Clear any wallet errors
   */
  const clearError = () => {
    error.value = null;
  };

  // Track unsubscribe function
  let unsubscribeWalletState: (() => void) | null = null;

  onMounted(() => {
    // First, check host wallet state (from postMessage)
    const hostState = getWalletState();
    applyHostState(hostState);

    // Subscribe to wallet state changes from host
    unsubscribeWalletState = subscribeToWalletState((state) => {
      applyHostState(state);
    });

    // Fallback: try SDK directly (only if not already connected via host state)
    const sdk = getSDKSync();
    if (sdk?.getConfig) {
      applyAppConfig(sdk.getConfig());
    }
    if (sdk && !isConnected.value) {
      sdk.wallet
        .getAddress()
        .then((addr: string) => {
          // Guard: only apply if subscription hasn't already connected us
          if (!isConnected.value && addr) {
            address.value = addr;
            isConnected.value = true;
            const config = sdk.getConfig?.();
            chainId.value = config?.chainId ?? null;
            chainType.value = config?.chainType ?? null;
            applyAppConfig(config);
          }
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          console.debug("[MiniApp SDK] Fallback wallet connection failed:", msg);
        });
    }

    waitForSDK()
      .then((sdkReady) => applyAppConfig(sdkReady.getConfig?.()))
      .catch(() => {
        // Ignore SDK readiness failures; app config may arrive via postMessage.
      });
  });

  onUnmounted(() => {
    if (unsubscribeWalletState) {
      unsubscribeWalletState();
    }
  });

  return {
    // State
    address,
    chainId,
    chainType,
    appChainId,
    supportedChains,
    balances,
    isConnected,
    isLoading,
    error,
    showConnectionPrompt,
    connectionPromptMessage,
    // Actions
    connect,
    invokeIntent,
    invokeContract,
    invokeRead,
    getContractAddress,
    getAppConfig,
    getAddress,
    signMessage,
    switchChain,
    switchToAppChain,
    getBalance,
    getTransactions,
    // Generic invoke helper
    invoke: async (method: string, params: Record<string, unknown>) => {
      const sdk = await waitForSDK();
      return sdk.invoke(method, params);
    },
    // Connection management
    requireConnection,
    closeConnectionPrompt,
    clearError,
  };
}
