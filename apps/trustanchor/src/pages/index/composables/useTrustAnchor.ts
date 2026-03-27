import { ref } from "vue";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useWallet } from "@shared/utils/wallet-sdk";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { handleAsync, formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

// ============================================
// Types — simplified trustanchor accounting surface
// ============================================

export interface TrustAnchorStats {
  totalStaked: number;
  rps: string;
}

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER; // 1e8
const APP_ID = "miniapp-trustanchor";

// ============================================
// Composable
// ============================================

export function useTrustAnchor(_t: (key: string) => string) {
  const wallet = useWallet() as WalletSDK;
  const { address, chainType, getContractAddress: resolveContractAddress } = wallet;
  const { read, invokeDirectly } = useContractInteraction({ appId: APP_ID, t: _t, wallet });

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const myStake = ref(0);
  const pendingRewards = ref(0);
  const pendingWithdraw = ref(0);
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
    const addr = await resolveContractAddress();
    if (!addr) throw new Error(_t("contractUnavailable"));
    return addr;
  };

  const readContract = async (operation: string, args?: Parameters<typeof read>[1]) => {
    const contract = await getContractAddress();
    return read(operation, args, contract);
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
    const account = address.value;

    const result = await handleAsync(async () => readContract("stakeOf", [{ type: "Hash160", value: account }]), {
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
    const account = address.value;

    const result = await handleAsync(
      async () => readContract("rewardOf", [{ type: "Hash160", value: account }]),
      { context: "Loading rewards", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success && result.data != null) {
      // rewardOf returns raw GAS in fixed-8
      pendingRewards.value = Number(result.data) / GAS_DECIMALS;
    }
  };

  const loadPendingWithdraw = async () => {
    if (!address.value) {
      pendingWithdraw.value = 0;
      return;
    }
    const account = address.value;

    const result = await handleAsync(
      async () => readContract("pendingWithdrawOf", [{ type: "Hash160", value: account }]),
      { context: "Loading pending withdraw", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success && result.data != null) {
      pendingWithdraw.value = Number(result.data);
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
      await Promise.all([loadMyStake(), loadPendingRewards(), loadPendingWithdraw(), loadStats()]);
    } finally {
      isLoading.value = false;
      clearError();
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
      setError(_t("connectWallet"));
      return { success: false };
    }
    const account = address.value;
    if (amount <= 0 || !Number.isInteger(amount)) {
      setError(_t("invalidAmount"));
      return { success: false };
    }

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        return invokeDirectly(
          "transfer",
          [
            { type: "Hash160", value: account },
            { type: "Hash160", value: contractAddr },
            { type: "Integer", value: amount },
            { type: "Any", value: null },
          ] as unknown as Parameters<typeof invokeDirectly>[1],
          NEO_HASH,
        );
      },
      { context: "Staking NEO", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success) {
      await loadAll();
    }
    return result;
  };

  // ------------------------------------------
  // Write: unstake (withdraw request or immediate payout)
  // ------------------------------------------

  const unstake = async (amount: number) => {
    if (!address.value) {
      setError(_t("connectWallet"));
      return { success: false };
    }
    const account = address.value;
    if (amount <= 0 || !Number.isInteger(amount)) {
      setError(_t("invalidAmount"));
      return { success: false };
    }

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        return invokeDirectly(
          "withdraw",
          [
            { type: "Hash160", value: account },
            { type: "Integer", value: amount },
          ],
          contractAddr,
        );
      },
      { context: "Withdrawing NEO", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
    );

    if (result.success) {
      await loadAll();
    }
    return result;
  };

  const claimPendingWithdraw = async () => {
    if (!address.value) {
      setError(_t("connectWallet"));
      return { success: false };
    }
    const account = address.value;

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        return invokeDirectly("claimWithdraw", [{ type: "Hash160", value: account }], contractAddr);
      },
      { context: "Claiming pending withdraw", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) },
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
      setError(_t("connectWallet"));
      return { success: false };
    }
    const account = address.value;

    const contractAddr = await getContractAddress();

    const result = await handleAsync(
      async () => {
        return invokeDirectly("claimReward", [{ type: "Hash160", value: account }], contractAddr);
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
    pendingWithdraw,
    stats,

    // Actions
    setError,
    clearError,
    loadAll,
    stake,
    unstake,
    claimRewards,
    claimPendingWithdraw,
  };
}
