/**
 * useTrustAnchor — Domain logic for the TrustAnchor staking miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Contains ONLY staking domain logic: load stakes, rewards, stats, stake/unstake/claim.
 */

import { ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER; // 1e8

// ============================================================================
// Types
// ============================================================================

export interface TrustAnchorStats {
  totalStaked: number;
  rps: string;
}

export interface UseTrustAnchorOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useTrustAnchor({ chain, eventBus, t }: UseTrustAnchorOptions) {
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
  // Read: user data
  // ------------------------------------------

  /** Read user's staked NEO via `stakeOf(account)` */
  const loadMyStake = async () => {
    if (!chain.address.value) {
      myStake.value = 0;
      return;
    }
    try {
      const result = await chain.read("stakeOf", [
        { type: "Hash160", value: chain.address.value },
      ]);
      if (result != null) {
        myStake.value = Number(result);
      }
    } catch (e) {
      console.warn("[useTrustAnchor] loadMyStake failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /** Read user's accrued GAS reward via `rewardOf(account)` */
  const loadPendingRewards = async () => {
    if (!chain.address.value) {
      pendingRewards.value = 0;
      return;
    }
    try {
      const result = await chain.read("rewardOf", [
        { type: "Hash160", value: chain.address.value },
      ]);
      if (result != null) {
        // rewardOf returns raw GAS in fixed-8
        pendingRewards.value = Number(result) / GAS_DECIMALS;
      }
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingRewards failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadPendingWithdraw = async () => {
    if (!chain.address.value) {
      pendingWithdraw.value = 0;
      return;
    }
    try {
      const result = await chain.read("pendingWithdrawOf", [
        { type: "Hash160", value: chain.address.value },
      ]);
      if (result != null) {
        pendingWithdraw.value = Number(result);
      }
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingWithdraw failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /** Load global accounting stats: totalStake and reward-per-stake accumulator. */
  const loadStats = async () => {
    try {
      const [totalStake, rps] = await Promise.all([
        chain.read("totalStake"),
        chain.read("rps"),
      ]);
      stats.value = {
        totalStaked: Number(totalStake ?? 0),
        rps: String(rps ?? "0"),
      };
    } catch (e) {
      console.warn("[useTrustAnchor] loadStats failed:", e instanceof Error ? e.message : String(e));
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
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error(t("invalidAmount"));
    }

    const addr = await chain.ensureWallet();
    const contractAddr = chain.contractAddress.value;
    if (!contractAddr) throw new Error(t("contractUnavailable"));

    await chain.invoke(
      "transfer",
      [
        { type: "Hash160", value: addr },
        { type: "Hash160", value: contractAddr },
        { type: "Integer", value: amount },
      ],
      { scriptHash: NEO_HASH },
    );

    eventBus.emit("stake:completed", { amount });
    await loadAll();
  };

  // ------------------------------------------
  // Write: unstake
  // ------------------------------------------

  const unstake = async (amount: number) => {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error(t("invalidAmount"));
    }

    const addr = await chain.ensureWallet();

    await chain.invoke("withdraw", [
      { type: "Hash160", value: addr },
      { type: "Integer", value: amount },
    ]);

    eventBus.emit("unstake:completed", { amount });
    await loadAll();
  };

  const claimPendingWithdraw = async () => {
    const addr = await chain.ensureWallet();

    await chain.invoke("claimWithdraw", [
      { type: "Hash160", value: addr },
    ]);

    eventBus.emit("withdraw:claimed", {});
    await loadAll();
  };

  // ------------------------------------------
  // Write: claim rewards
  // ------------------------------------------

  /** Call `claimReward(account)` to claim accrued GAS */
  const claimRewards = async () => {
    const addr = await chain.ensureWallet();

    await chain.invoke("claimReward", [
      { type: "Hash160", value: addr },
    ]);

    eventBus.emit("rewards:claimed", {});
    await loadAll();
  };

  return {
    // State
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

export type UseTrustAnchorReturn = ReturnType<typeof useTrustAnchor>;
