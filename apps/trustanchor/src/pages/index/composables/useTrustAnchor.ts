import { ref } from "vue";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useWallet } from "@shared/utils/wallet-sdk";
import { handleAsync, formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { parseInvokeResult } from "@shared/utils/neo";

// ============================================
// Types — simplified trustanchor accounting surface
// ============================================

export interface TrustAnchorStats {
  totalStaked: number;
  rps: string;
}

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER; // 1e8

// ============================================
// Composable
// ============================================

export function useTrustAnchor(_t: (key: string) => string) {
  const { address, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const myStake = ref(0);
  const pendingRewards = ref(0);
  const totalRewards = ref(0);
  const stats = ref<TrustAnchorStats | null>(null);

  const setError = (message: string) => {
    error.value = message;
  };

  const clearError = () => {
    error.value = null;
  };

  // ------------------------------------------
  // Helpers
  // ------------------------------------------

  const getContractAddress = async (): Promise<string> => {
    const { getContractAddress: resolve } = useWallet() as WalletSDK;
    const addr = await resolve();
    if (!addr) throw new Error(_t("contractUnavailable") || "Contract address unavailable");
    return addr;
  };

  const readContract = async (operation: string, args?: { type: string; value: unknown }[]) => {
    const contract = await getContractAddress();
    const result = await invokeRead({
      scriptHash: contract,
      operation,
      ...(args && { args }),
    });
    return parseInvokeResult(result);
  };

  // ------------------------------------------
  // Read: user data
  // ------------------------------------------

  /** Read user's staked NEO via `stakeOf(account)` */
  const loadMyStake = async () => {
    if (!address.value) {
      myStake.value = 0;
      return;
    }

    const result = await handleAsync(async () => readContract("stakeOf", [{ type: "Hash160", value: address.value }]), {
      context: "Loading stake",
      onError: (e: Error) => setError(formatErrorMessage(e, e.message)),
    });

    if (result.success && result.data != null) {
      myStake.value = Number(result.data);
    }
  };

  /** Read user's accrued GAS reward via `rewardOf(account)` */
  const loadPendingRewards = async () => {
    if (!address.value) {
      pendingRewards.value = 0;
      return;
    }

    const result = await handleAsync(
      async () => readContract("rewardOf", [{ type: "Hash160", value: address.value }]),
      { context: "Loading rewards", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success && result.data != null) {
      // rewardOf returns raw GAS in fixed-8
      pendingRewards.value = Number(result.data) / GAS_DECIMALS;
    }
  };

  /** Load global accounting stats: totalStake and reward-per-stake accumulator. */
  const loadStats = async () => {
    const result = await handleAsync(
      async () => {
        const [totalStake, rps] = await Promise.all([readContract("totalStake"), readContract("rps")]);
        return {
          totalStaked: Number(totalStake ?? 0),
          rps: String(rps ?? "0"),
        };
      },
      { context: "Loading stats", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success && result.data) {
      stats.value = result.data;
    }
  };

  // ------------------------------------------
  // Load all
  // ------------------------------------------

  const loadAll = async () => {
    isLoading.value = true;
    clearError();

    try {
      await Promise.all([loadMyStake(), loadPendingRewards(), loadStats()]);
    } finally {
      isLoading.value = false;
    }
  };

  // ------------------------------------------
  // Write: stake (NEP-17 transfer of NEO to contract)
  // ------------------------------------------

  /**
   * Stake NEO by transferring it to the contract address.
   * The contract's OnNEP17Payment handler processes the deposit.
   */
  const stake = async (amount: number) => {
    if (!address.value) {
      setError(_t("connectWallet") || "Connect wallet first");
      return { success: false };
    }
    if (amount <= 0 || !Number.isInteger(amount)) {
      setError(_t("invalidAmount") || "NEO is indivisible — enter a whole number");
      return { success: false };
    }

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: NEO_HASH,
          operation: "transfer",
          args: [
            { type: "Hash160", value: address.value },
            { type: "Hash160", value: contractAddr },
            { type: "Integer", value: amount },
            { type: "Any", value: null },
          ],
        });
        return res;
      },
      { context: "Staking NEO", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success) {
      await loadAll();
    }
    return result;
  };

  // ------------------------------------------
  // Write: unstake (withdraw)
  // ------------------------------------------

  /** Call `withdraw(account, neoAmount)` to unstake NEO */
  const unstake = async (amount: number) => {
    if (!address.value) {
      setError(_t("connectWallet") || "Connect wallet first");
      return { success: false };
    }
    if (amount <= 0 || !Number.isInteger(amount)) {
      setError(_t("invalidAmount") || "NEO is indivisible — enter a whole number");
      return { success: false };
    }

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: contractAddr,
          operation: "withdraw",
          args: [
            { type: "Hash160", value: address.value },
            { type: "Integer", value: amount },
          ],
        });
        return res;
      },
      { context: "Withdrawing NEO", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success) {
      await loadAll();
    }
    return result;
  };

  // ------------------------------------------
  // Write: claim rewards
  // ------------------------------------------

  /** Call `claimReward(account)` to claim accrued GAS */
  const claimRewards = async () => {
    if (!address.value) {
      setError(_t("connectWallet") || "Connect wallet first");
      return { success: false };
    }

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: contractAddr,
          operation: "claimReward",
          args: [{ type: "Hash160", value: address.value }],
        });
        return res;
      },
      { context: "Claiming rewards", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success) {
      await loadAll();
    }
    return result;
  };

  return {
    // State
    address,
    chainType,
    isLoading,
    error,

    // User data
    myStake,
    pendingRewards,
    totalRewards,
    stats,

    // Actions
    setError,
    clearError,
    loadAll,
    stake,
    unstake,
    claimRewards,
  };
}
