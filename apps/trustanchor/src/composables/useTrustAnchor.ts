/**
 * useTrustAnchor — Domain logic for the TrustAnchor staking miniapp
 *
 * Reads user stake/reward data via OS StorageProxy instead of direct
 * chain.read() against the own contract. Writes that target the own
 * contract (withdraw, claimReward, claimWithdraw) also go through OS
 * services. The NEO native transfer for staking stays on ChainService
 * since it targets an external contract.
 */

import { ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
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
  storage: StorageProxy;
  payment: PaymentProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useTrustAnchor({ chain, eventBus, storage, payment, t }: UseTrustAnchorOptions) {
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
  // Read: user data (via OS storage)
  // ------------------------------------------

  /** Read user's staked NEO from OS storage */
  const loadMyStake = async () => {
    if (!chain.address.value) {
      myStake.value = 0;
      return;
    }
    try {
      const result = await storage.get(`stake:${chain.address.value}`);
      if (result != null) {
        myStake.value = Number(result);
      }
    } catch (e) {
      console.warn("[useTrustAnchor] loadMyStake failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /** Read user's accrued GAS reward from OS storage */
  const loadPendingRewards = async () => {
    if (!chain.address.value) {
      pendingRewards.value = 0;
      return;
    }
    try {
      const result = await storage.get(`reward:${chain.address.value}`);
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
      const result = await storage.get(`pendingWithdraw:${chain.address.value}`);
      if (result != null) {
        pendingWithdraw.value = Number(result);
      }
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingWithdraw failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /** Load global accounting stats from OS storage */
  const loadStats = async () => {
    try {
      const [totalStake, rps] = await Promise.all([
        storage.get("stats:totalStake"),
        storage.get("stats:rps"),
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
  // Write: stake (NEP-17 transfer of NEO to contract — external)
  // ------------------------------------------

  /**
   * Stake NEO by transferring it to the contract address.
   * Uses chain.invoke on the NEO native contract (external) since
   * staking is a NEP-17 transfer, not an app-contract mutation.
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
  // Write: unstake (via OS payment — own contract)
  // ------------------------------------------

  const unstake = async (amount: number) => {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error(t("invalidAmount"));
    }

    await chain.ensureWallet();

    // Withdraw via OS payment proxy — the edge function invokes
    // the contract's withdraw method
    await payment.withdraw(String(amount));

    eventBus.emit("unstake:completed", { amount });
    await loadAll();
  };

  const claimPendingWithdraw = async () => {
    await chain.ensureWallet();

    // Claim pending withdrawal via OS payment proxy
    await payment.withdraw("0");

    eventBus.emit("withdraw:claimed", {});
    await loadAll();
  };

  // ------------------------------------------
  // Write: claim rewards (via OS payment — own contract)
  // ------------------------------------------

  /** Claim accrued GAS rewards via OS payment proxy */
  const claimRewards = async () => {
    await chain.ensureWallet();

    // Claim via OS payment — the edge function calls claimReward
    const balance = await payment.getBalance();
    if (parseFloat(balance) > 0) {
      await payment.withdraw(balance);
    }

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
