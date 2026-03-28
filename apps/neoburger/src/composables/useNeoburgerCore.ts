/**
 * useNeoburgerCore — Core staking logic for the NeoBurger miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Manages wallet connection, balance loading, stake/unstake/claim.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus, BalanceService } from "@shared/services";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const BNEO_DECIMALS = TOKEN_CONSTANTS.GAS_DECIMALS;

// ============================================================================
// Types
// ============================================================================

export interface UseNeoburgerCoreOptions {
  chain: ChainService;
  eventBus: EventBus;
  balance: BalanceService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useNeoburgerCore({ chain, eventBus, balance, t }: UseNeoburgerCoreOptions) {
  const neoBalance = ref(0);
  const bNeoBalance = ref(0);
  const walletAddress = ref<string | null>(null);
  const BNEO_CONTRACT = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const walletConnected = computed(() => !!walletAddress.value);

  async function ensureBneoContract(): Promise<string | null> {
    if (BNEO_CONTRACT.value) return BNEO_CONTRACT.value;
    try {
      // contractAddress is resolved by ChainService from the appId
      // Wait for it to be available
      const addr = chain.contractAddress.value;
      if (addr) {
        BNEO_CONTRACT.value = addr;
        return addr;
      }
      // If not yet resolved, try ensureWallet which may trigger resolution
      BNEO_CONTRACT.value = chain.contractAddress.value;
      return BNEO_CONTRACT.value;
    } catch (e) {
      console.warn("[useNeoburgerCore] ensureBneoContract failed:", e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  async function loadBalances(connectIfNeeded = false) {
    try {
      if (connectIfNeeded) {
        await chain.ensureWallet();
      }
      walletAddress.value = chain.address.value || null;
      if (!chain.address.value) {
        neoBalance.value = 0;
        bNeoBalance.value = 0;
        return;
      }
      const bneoContract = await ensureBneoContract();
      if (!bneoContract) return;
      neoBalance.value = await balance.getNeoBalance();
      bNeoBalance.value = await balance.getBalance(bneoContract);
    } catch (e) {
      console.warn("[useNeoburgerCore] loadBalances failed:", e instanceof Error ? e.message : String(e));
    }
  }

  async function connectWallet() {
    try {
      await chain.ensureWallet();
      await loadBalances(false);
      return Boolean(chain.address.value);
    } catch (e) {
      console.warn("[useNeoburgerCore] connectWallet failed:", e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function handleStake(amount: string) {
    const stakeAmount = Number(toFixedDecimals(amount, 0));
    if (stakeAmount <= 0 || stakeAmount > neoBalance.value) return false;
    const bneoContract = await ensureBneoContract();
    if (!bneoContract) return false;
    try {
      const addr = await chain.ensureWallet();
      await chain.invoke("transfer", [
        { type: "Hash160", value: addr },
        { type: "Hash160", value: bneoContract },
        { type: "Integer", value: Math.floor(stakeAmount) },
      ], { scriptHash: NEO_CONTRACT });
      eventBus.emit("stake:completed", { amount: stakeAmount });
      return true;
    } catch (e) {
      console.warn("[useNeoburgerCore] handleStake failed:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async function handleUnstake(amount: string) {
    const unstakeAmount = parseFloat(amount) || 0;
    if (unstakeAmount <= 0 || unstakeAmount > bNeoBalance.value) return false;
    const bneoContract = await ensureBneoContract();
    if (!bneoContract) return false;
    const integerAmount = toFixed8(amount);
    try {
      const addr = await chain.ensureWallet();
      await chain.invoke("transfer", [
        { type: "Hash160", value: addr },
        { type: "Hash160", value: bneoContract },
        { type: "Integer", value: integerAmount },
      ], { scriptHash: bneoContract });
      eventBus.emit("unstake:completed", { amount: unstakeAmount });
      return true;
    } catch (e) {
      console.warn("[useNeoburgerCore] handleUnstake failed:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async function handleClaimRewards() {
    try {
      const bneoContract = await ensureBneoContract();
      if (!bneoContract) return false;
      await chain.invoke("claim", [], { scriptHash: bneoContract });
      eventBus.emit("rewards:claimed", {});
      return true;
    } catch (e) {
      console.warn("[useNeoburgerCore] handleClaimRewards failed:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  return {
    neoBalance,
    bNeoBalance,
    walletAddress,
    walletConnected,
    BNEO_CONTRACT,
    loading,
    error,
    ensureBneoContract,
    connectWallet,
    loadBalances,
    handleStake,
    handleUnstake,
    handleClaimRewards,
  };
}

export type UseNeoburgerCoreReturn = ReturnType<typeof useNeoburgerCore>;
