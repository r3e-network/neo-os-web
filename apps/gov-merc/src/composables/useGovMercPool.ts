/**
 * useGovMercPool — Domain logic for the Gov Merc miniapp
 *
 * Receives ChainService + EventBus from PlatformServices instead of
 * instantiating its own useContractInteraction / useEvents / useStatusMessage.
 */

import { ref, computed, watch, onUnmounted } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatNum, parseGas, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StatsDisplayItem } from "@shared/components";

const APP_ID = "miniapp-gov-merc";

export interface UseGovMercPoolOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGovMercPool({ chain, eventBus, t }: UseGovMercPoolOptions) {
  const depositAmount = ref("");
  const withdrawAmount = ref("");
  const bidAmount = ref("");
  const totalPool = ref(0);
  const currentEpoch = ref(0);
  const userDeposits = ref(0);
  const bids = ref<{ address: string; amount: number }[]>([]);
  const dataLoading = ref(false);

  const isBusy = computed(() => chain.isProcessing.value || dataLoading.value);

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, chain.address.value);

  const poolStats = computed<StatsDisplayItem[]>(() => [
    { label: t("totalPool"), value: `${formatNum(totalPool.value, 0)} ${t("tokenNeo")}`, variant: "success" },
    { label: t("currentEpoch"), value: currentEpoch.value, variant: "default" },
    { label: t("yourDeposits"), value: `${formatNum(userDeposits.value, 0)} ${t("tokenNeo")}`, variant: "accent" },
  ]);

  // -- Data loading ---------------------------------------------------------

  const loadPoolData = async () => {
    try {
      const [poolResult, epochResult] = await Promise.all([
        chain.read("TotalPool"),
        chain.read("GetCurrentEpochId"),
      ]);
      totalPool.value = Number(poolResult || 0);
      currentEpoch.value = Number(epochResult || 0);
    } catch (e) {
      eventBus.emit("govmerc:error", { message: e instanceof Error ? e.message : t("loadFailed") });
    }
  };

  const loadUserDeposits = async () => {
    if (!chain.address.value) return;
    const deposits = await chain.listAllEvents("MercDeposit");
    const total = deposits.reduce((sum, evt) => {
      const evtRecord = evt as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      if (!ownerMatches(values[0])) return sum;
      const amount = Number(values[1] || 0);
      return sum + amount;
    }, 0);
    userDeposits.value = total;
  };

  const loadBids = async () => {
    const bidEvents = await chain.listAllEvents("BidPlaced");
    const epoch = currentEpoch.value;
    const map = new Map<string, number>();
    bidEvents.forEach((evt) => {
      const evtRecord = evt as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const eventEpoch = Number(values[0] || 0);
      const candidate = String(values[1] || "");
      const amount = parseGas(values[2]);
      if (eventEpoch !== epoch || !candidate) return;
      map.set(candidate, (map.get(candidate) || 0) + amount);
    });
    bids.value = Array.from(map.entries())
      .map(([addr, amount]) => ({ address: addr, amount }))
      .sort((a, b) => b.amount - a.amount);
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
      eventBus.emit("govmerc:error", { message: e instanceof Error ? e.message : t("loadFailed") });
    } finally {
      dataLoading.value = false;
    }
  };

  const stopAddressWatch = watch(chain.address, () => { void loadData(); }, { immediate: true });

  onUnmounted(() => {
    isMounted.value = false;
    stopAddressWatch();
  });

  // -- Actions --------------------------------------------------------------

  const depositNeo = async () => {
    if (isBusy.value) return;
    const amount = Number(toFixedDecimals(depositAmount.value, 0));
    if (!(amount > 0)) {
      throw new Error(t("enterAmount"));
    }
    try {
      await chain.ensureWallet();
      await chain.invoke("DepositNeo", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: amount },
      ]);
      eventBus.emit("govmerc:deposit", { amount });
      depositAmount.value = "";
      await loadData();
    } catch (e) {
      eventBus.emit("govmerc:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    }
  };

  const withdrawNeo = async () => {
    if (isBusy.value) return;
    const amount = Number(toFixedDecimals(withdrawAmount.value, 0));
    if (!(amount > 0)) {
      throw new Error(t("enterAmount"));
    }
    try {
      await chain.ensureWallet();
      await chain.invoke("WithdrawNeo", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: amount },
      ]);
      eventBus.emit("govmerc:withdraw", { amount });
      withdrawAmount.value = "";
      await loadData();
    } catch (e) {
      eventBus.emit("govmerc:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    }
  };

  const placeBid = async () => {
    if (isBusy.value) return;
    const amount = parseFloat(bidAmount.value);
    if (!(amount > 0)) {
      throw new Error(t("enterAmount"));
    }
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      await chain.ensureWallet();

      // Step 1: Transfer GAS payment
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: toFixed8(bidAmount.value) },
          { type: "String", value: `${APP_ID}:bid:${currentEpoch.value}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Wait for confirmation delay
      await new Promise((resolve) => {
        delayTimer = setTimeout(resolve, 4000);
      });

      // Guard against post-unmount state updates
      if (!isMounted.value) return;

      // Step 2: Place the bid on-chain
      await chain.invoke("placeBid", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: toFixed8(bidAmount.value) },
      ]);

      eventBus.emit("govmerc:bid", { amount });
      bidAmount.value = "";
      await loadData();
    } catch (e) {
      eventBus.emit("govmerc:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      if (delayTimer) clearTimeout(delayTimer);
    }
  };

  return {
    address: chain.address,
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
  };
}

export type UseGovMercPoolReturn = ReturnType<typeof useGovMercPool>;
