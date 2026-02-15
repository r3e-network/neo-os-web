import { ref, computed, watch } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { formatNum, parseGas, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { StatsDisplayItem } from "@shared/components";

const APP_ID = "miniapp-gov-merc";

export function useGovMercPool(t: (key: string) => string) {
  const {
    address,
    ensureWallet,
    read,
    invoke,
    invokeDirectly,
    ensureContractAddress,
    isProcessing: isLoading,
  } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();
  const { listAllEvents } = useAllEvents(listEvents, APP_ID);
  const { status, setStatus } = useStatusMessage();

  const depositAmount = ref("");
  const withdrawAmount = ref("");
  const bidAmount = ref("");
  const totalPool = ref(0);
  const currentEpoch = ref(0);
  const userDeposits = ref(0);
  const bids = ref<{ address: string; amount: number }[]>([]);
  const dataLoading = ref(false);

  const isBusy = computed(() => isLoading.value || dataLoading.value);

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);
  const ensureConnectedAddress = async () => {
    await ensureWallet();
    return address.value as string;
  };

  const poolStats = computed<StatsDisplayItem[]>(() => [
    { label: t("totalPool"), value: `${formatNum(totalPool.value, 0)} NEO`, variant: "success" },
    { label: t("currentEpoch"), value: currentEpoch.value, variant: "default" },
    { label: t("yourDeposits"), value: `${formatNum(userDeposits.value, 0)} NEO`, variant: "accent" },
  ]);

  const loadPoolData = async () => {
    await ensureContractAddress();
    const [poolResult, epochResult] = await Promise.all([read("TotalPool"), read("GetCurrentEpochId")]);
    totalPool.value = Number(poolResult || 0);
    currentEpoch.value = Number(epochResult || 0);
  };

  const loadUserDeposits = async () => {
    if (!address.value) return;
    const deposits = await listAllEvents("MercDeposit");
    const total = deposits.reduce((sum, evt) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
      if (!ownerMatches(values[0])) return sum;
      const amount = Number(values[1] || 0);
      return sum + amount;
    }, 0);
    userDeposits.value = total;
  };

  const loadBids = async () => {
    const bidEvents = await listAllEvents("BidPlaced");
    const epoch = currentEpoch.value;
    const map = new Map<string, number>();
    bidEvents.forEach((evt) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
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

  const loadData = async () => {
    try {
      dataLoading.value = true;
      await loadPoolData();
      await loadUserDeposits();
      await loadBids();
    } catch {
    } finally {
      dataLoading.value = false;
    }
  };

  const depositNeo = async () => {
    if (isBusy.value) return;
    const amount = Number(toFixedDecimals(depositAmount.value, 0));
    if (!(amount > 0)) {
      setStatus(t("enterAmount"), "error");
      return;
    }
    try {
      const walletAddress = await ensureConnectedAddress();
      await invokeDirectly("DepositNeo", [
        { type: "Hash160", value: walletAddress },
        { type: "Integer", value: amount },
      ]);
      setStatus(t("depositSuccess"), "success");
      depositAmount.value = "";
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const withdrawNeo = async () => {
    if (isBusy.value) return;
    const amount = Number(toFixedDecimals(withdrawAmount.value, 0));
    if (!(amount > 0)) {
      setStatus(t("enterAmount"), "error");
      return;
    }
    try {
      const walletAddress = await ensureConnectedAddress();
      await invokeDirectly("WithdrawNeo", [
        { type: "Hash160", value: walletAddress },
        { type: "Integer", value: amount },
      ]);
      setStatus(t("withdrawSuccess"), "success");
      withdrawAmount.value = "";
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const placeBid = async () => {
    if (isBusy.value) return;
    const amount = parseFloat(bidAmount.value);
    if (!(amount > 0)) {
      setStatus(t("enterAmount"), "error");
      return;
    }
    try {
      await ensureConnectedAddress();
      await invoke(bidAmount.value, `bid:${currentEpoch.value}`, "placeBid", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: toFixed8(bidAmount.value) },
      ]);
      setStatus(t("bidSuccess"), "success");
      bidAmount.value = "";
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  watch(address, () => loadData(), { immediate: true });

  return {
    address,
    depositAmount,
    withdrawAmount,
    bidAmount,
    totalPool,
    currentEpoch,
    userDeposits,
    bids,
    status,
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
