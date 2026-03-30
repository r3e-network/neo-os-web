/**
 * useGovMercPool — Domain logic for the Gov Merc miniapp (OS Services)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (PaymentProxy, StorageProxy) via edge functions, so this file
 * contains zero contract hashes, parameter encoding, or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("TotalPool")
 *     chain.read("GetCurrentEpochId")
 *     chain.invoke("DepositNeo", [...])
 *     chain.invoke("WithdrawNeo", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("placeBid", [...])
 *     chain.listAllEvents("MercDeposit")
 *     chain.listAllEvents("BidPlaced")
 *
 *   AFTER (OS proxy):
 *     storageService.get("pool-state")          — pool total + epoch
 *     storageService.get("user-deposits")       — user deposit total
 *     storageService.list("bid:")               — current epoch bids
 *     paymentService.deposit(amount, memo)      — deposit NEO / GAS for bids
 *     storageService.set("deposit", data)       — deposit NEO
 *     storageService.set("withdraw", data)      — withdraw NEO
 *     storageService.set("bid", data)           — place bid
 */

import { ref, computed, watch, onUnmounted } from "vue";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatNum } from "@shared/utils/format";
import type { StatsDisplayItem } from "@shared/components";

export interface UseGovMercPoolOptions {
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGovMercPool({
  paymentService,
  storageService,
  t,
}: UseGovMercPoolOptions) {
  const depositAmount = ref("");
  const withdrawAmount = ref("");
  const bidAmount = ref("");
  const totalPool = ref(0);
  const currentEpoch = ref(0);
  const userDeposits = ref(0);
  const bids = ref<{ address: string; amount: number }[]>([]);
  const dataLoading = ref(false);
  const address = ref("");
  const isProcessing = ref(false);

  const isBusy = computed(() => isProcessing.value || dataLoading.value);

  const poolStats = computed<StatsDisplayItem[]>(() => [
    { label: t("totalPool"), value: `${formatNum(totalPool.value, 0)} ${t("tokenNeo")}`, variant: "success" },
    { label: t("currentEpoch"), value: currentEpoch.value, variant: "default" },
    { label: t("yourDeposits"), value: `${formatNum(userDeposits.value, 0)} ${t("tokenNeo")}`, variant: "accent" },
  ]);

  // -- Data loading (via OS services) -----------------------------------------

  /**
   * Load pool state via StorageProxy.
   * The edge function reads TotalPool and GetCurrentEpochId from the contract.
   */
  const loadPoolData = async () => {
    try {
      const raw = await storageService.get("pool-state");
      if (raw && typeof raw === "object") {
        const data = raw as Record<string, unknown>;
        totalPool.value = Number(data.totalPool || 0);
        currentEpoch.value = Number(data.currentEpoch || 0);
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadPoolData failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load user deposits via StorageProxy.
   * The edge function aggregates MercDeposit events for the current user.
   */
  const loadUserDeposits = async () => {
    if (!address.value) return;
    try {
      const raw = await storageService.get("user-deposits");
      userDeposits.value = Number(raw || 0);
    } catch (e) {
      console.warn("[useGovMercPool] loadUserDeposits failed:", e instanceof Error ? e.message : String(e));
      userDeposits.value = 0;
    }
  };

  /**
   * Load current epoch bids via StorageProxy.
   * The edge function aggregates BidPlaced events for the current epoch.
   */
  const loadBids = async () => {
    try {
      const raw = await storageService.list("bid:");
      if (raw && typeof raw === "object") {
        const map = new Map<string, number>();
        for (const [, value] of Object.entries(raw)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          const candidate = String(entry.address || "");
          const amount = Number(entry.amount || 0);
          if (!candidate) continue;
          map.set(candidate, (map.get(candidate) || 0) + amount);
        }
        bids.value = Array.from(map.entries())
          .map(([addr, amount]) => ({ address: addr, amount }))
          .sort((a, b) => b.amount - a.amount);
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadBids failed:", e instanceof Error ? e.message : String(e));
      bids.value = [];
    }
  };

  const isMounted = ref(true);

  const loadData = async () => {
    if (!isMounted.value) return;
    try {
      dataLoading.value = true;
      await loadPoolData();
      if (!isMounted.value) return;
      await loadUserDeposits();
      if (!isMounted.value) return;
      await loadBids();
    } catch (e) {
      console.warn("[useGovMercPool] loadData failed:", e instanceof Error ? e.message : String(e));
    } finally {
      dataLoading.value = false;
    }
  };

  onUnmounted(() => {
    isMounted.value = false;
  });

  // -- Actions (via OS services) ----------------------------------------------

  /**
   * Deposit NEO via StorageProxy.
   * The edge function handles the DepositNeo contract invocation.
   */
  const depositNeo = async () => {
    if (isBusy.value) return;
    const amount = Number(depositAmount.value);
    if (!(amount > 0)) {
      throw new Error(t("enterAmount"));
    }
    try {
      isProcessing.value = true;

      await storageService.set("deposit", {
        depositor: address.value,
        amount,
      });

      depositAmount.value = "";
      await loadData();
    } catch (e) {
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Withdraw NEO via StorageProxy.
   * The edge function handles the WithdrawNeo contract invocation.
   */
  const withdrawNeo = async () => {
    if (isBusy.value) return;
    const amount = Number(withdrawAmount.value);
    if (!(amount > 0)) {
      throw new Error(t("enterAmount"));
    }
    try {
      isProcessing.value = true;

      await storageService.set("withdraw", {
        withdrawer: address.value,
        amount,
      });

      withdrawAmount.value = "";
      await loadData();
    } catch (e) {
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Place a bid via PaymentProxy (deposit GAS) + StorageProxy (place bid).
   * The edge function handles GAS transfer and placeBid contract invocation.
   */
  const placeBid = async () => {
    if (isBusy.value) return;
    const amount = parseFloat(bidAmount.value);
    if (!(amount > 0)) {
      throw new Error(t("enterAmount"));
    }
    try {
      isProcessing.value = true;

      // Step 1: Deposit GAS via PaymentProxy
      await paymentService.deposit(
        bidAmount.value,
        `govmerc:bid:${currentEpoch.value}`,
      );

      // Guard against post-unmount state updates
      if (!isMounted.value) return;

      // Step 2: Place bid via StorageProxy
      await storageService.set("bid", {
        bidder: address.value,
        amount: bidAmount.value,
        epoch: currentEpoch.value,
      });

      bidAmount.value = "";
      await loadData();
    } catch (e) {
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    address,
    depositAmount,
    withdrawAmount,
    bidAmount,
    totalPool,
    currentEpoch,
    userDeposits,
    bids,
    dataLoading,
    isBusy,
    poolStats,
    formatNum,
    depositNeo,
    withdrawNeo,
    placeBid,
    loadData,
    /**
     * Set the wallet address. Called from main.ts to track the
     * connected wallet address from the platform's chain service.
     */
    setAddress: (addr: string) => { address.value = addr; },
  };
}

export type UseGovMercPoolReturn = ReturnType<typeof useGovMercPool>;
