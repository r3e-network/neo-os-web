import { ref, computed, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber, parseGas, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { parseInvokeResult } from "@shared/utils/neo";
import type { StatItem } from "@shared/components/NeoStats.vue";

const APP_ID = "miniapp-gov-merc";

export function useGovMercPool(t: (key: string) => string) {
  const { address, connect, invokeContract, invokeRead } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
  const { listAllEvents } = useAllEvents(listEvents, APP_ID);
  const { status, setStatus, clearStatus } = useStatusMessage();

  const depositAmount = ref("");
  const withdrawAmount = ref("");
  const bidAmount = ref("");
  const totalPool = ref(0);
  const currentEpoch = ref(0);
  const userDeposits = ref(0);
  const bids = ref<{ address: string; amount: number }[]>([]);
  const dataLoading = ref(false);

  const isBusy = computed(() => isLoading.value || dataLoading.value);
  const formatNum = (n: number, d = 2) => formatNumber(n, d);

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  const poolStats = computed<StatItem[]>(() => [
    { label: t("totalPool"), value: `${formatNum(totalPool.value, 0)} NEO`, variant: "success" },
    { label: t("currentEpoch"), value: currentEpoch.value, variant: "default" },
    { label: t("yourDeposits"), value: `${formatNum(userDeposits.value, 0)} NEO`, variant: "accent" },
  ]);

  const fetchPoolData = async () => {
    const contract = await ensureContractAddress();
    const [poolRes, epochRes] = await Promise.all([
      invokeRead({ scriptHash: contract, operation: "TotalPool" }),
      invokeRead({ scriptHash: contract, operation: "GetCurrentEpochId" }),
    ]);
    totalPool.value = Number(parseInvokeResult(poolRes) || 0);
    currentEpoch.value = Number(parseInvokeResult(epochRes) || 0);
  };

  const fetchUserDeposits = async () => {
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

  const fetchBids = async () => {
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

  const fetchData = async () => {
    try {
      dataLoading.value = true;
      await fetchPoolData();
      await fetchUserDeposits();
      await fetchBids();
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
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("error"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "DepositNeo",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: amount },
        ],
      });
      setStatus(t("depositSuccess"), "success");
      depositAmount.value = "";
      await fetchData();
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
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("error"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "WithdrawNeo",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: amount },
        ],
      });
      setStatus(t("withdrawSuccess"), "success");
      withdrawAmount.value = "";
      await fetchData();
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
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("error"));
      const contract = await ensureContractAddress();
      const { receiptId, invoke } = await processPayment(bidAmount.value, `bid:${currentEpoch.value}`);
      if (!receiptId) throw new Error(t("receiptMissing"));
      await invoke(
        "placeBid",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: toFixed8(bidAmount.value) },
          { type: "Integer", value: receiptId },
        ],
        contract
      );
      setStatus(t("bidSuccess"), "success");
      bidAmount.value = "";
      await fetchData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  watch(address, () => fetchData(), { immediate: true });

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
    fetchData,
  };
}
