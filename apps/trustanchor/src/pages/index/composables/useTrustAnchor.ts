import { ref } from "vue";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useWallet } from "@shared/utils/wallet-sdk";
import { handleAsync, formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { parseInvokeResult } from "@shared/utils/neo";

// ============================================
// Types — matches the real TrustAnchor contract
// ============================================

export interface AgentInfo {
  index: number;
  address: string;
  target: string;
  name: string;
  votingWeight: number;
}

export interface TrustAnchorStats {
  totalStaked: number;
  agentCount: number;
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
  const agents = ref<AgentInfo[]>([]);
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

  // ------------------------------------------
  // Read: global contract state
  // ------------------------------------------

  /** Load agents list via `agentCount` + `agentInfo(i)` */
  const loadAgents = async () => {
    const countResult = await handleAsync(async () => readContract("agentCount"), {
      context: "Loading agent count",
      onError: (e: Error) => setError(formatErrorMessage(e, e.message)),
    });

    if (!countResult.success || countResult.data == null) return;

    const count = Number(countResult.data);
    const agentList: AgentInfo[] = [];

    for (let i = 0; i < count; i++) {
      const infoResult = await handleAsync(async () => readContract("agentInfo", [{ type: "Integer", value: i }]), {
        context: `Loading agent ${i}`,
        onError: () => null,
      });

      if (infoResult.success && infoResult.data) {
        const arr = infoResult.data as unknown[];
        // agentInfo returns: [index, address, target, name, votingWeight]
        agentList.push({
          index: Number(arr[0] ?? i),
          address: String(arr[1] ?? ""),
          target: String(arr[2] ?? ""),
          name: String(arr[3] ?? ""),
          votingWeight: Number(arr[4] ?? 0),
        });
      }
    }

    agents.value = agentList;
  };

  /** Load global stats: totalStake, agentCount, rps */
  const loadStats = async () => {
    const result = await handleAsync(
      async () => {
        const [totalStake, agentCount, rps] = await Promise.all([
          readContract("totalStake"),
          readContract("agentCount"),
          readContract("rps"),
        ]);
        return {
          totalStaked: Number(totalStake ?? 0),
          agentCount: Number(agentCount ?? 0),
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
      await Promise.all([loadMyStake(), loadPendingRewards(), loadAgents(), loadStats()]);
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

    // Contract data
    agents,
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
