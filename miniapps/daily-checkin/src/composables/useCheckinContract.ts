import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { formatGas } from "@shared/utils/format";
import { createSidebarItems, extractTxid } from "@shared/utils";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { StatItem } from "@shared/components";

const APP_ID = "miniapp-dailycheckin";
const CHECK_IN_FEE = 0.001;

export function useCheckinContract(t: (key: string, params?: Record<string, string>) => string) {
  const { address, connect, invokeRead } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);
  const { ensure: ensureContractAddress } = useContractAddress(t);

  // User state
  const currentStreak = ref(0);
  const highestStreak = ref(0);
  const lastCheckInDay = ref(0);
  const unclaimedRewards = ref(0);
  const totalClaimed = ref(0);
  const totalUserCheckins = ref(0);
  const { status, setStatus, clearStatus } = useStatusMessage();
  const isClaiming = ref(false);

  // Global stats
  const globalStats = ref({
    totalUsers: 0,
    totalCheckins: 0,
    totalRewarded: 0,
  });

  // History
  const checkinHistory = ref<{ streak: number; time: string; reward: number }[]>([]);

  const sidebarItems = createSidebarItems(t, [
    { labelKey: "currentStreak", value: () => `${currentStreak.value} ${t("days")}` },
    { labelKey: "highestStreak", value: () => `${highestStreak.value} ${t("days")}` },
    { labelKey: "totalUserCheckins", value: () => totalUserCheckins.value },
    { labelKey: "unclaimed", value: () => `${formatGas(unclaimedRewards.value)} GAS` },
    { labelKey: "totalClaimed", value: () => `${formatGas(totalClaimed.value)} GAS` },
  ]);

  const userStats = computed<StatItem[]>(() => [
    { label: t("currentStreak"), value: `${currentStreak.value} ${t("days")}`, variant: "accent" },
    { label: t("highestStreak"), value: `${highestStreak.value} ${t("days")}`, variant: "success" },
    { label: t("totalUserCheckins"), value: totalUserCheckins.value },
    { label: t("totalClaimed"), value: `${formatGas(totalClaimed.value)} GAS` },
    { label: t("unclaimed"), value: `${formatGas(unclaimedRewards.value)} GAS` },
  ]);

  const waitForPendingOrConfirm = async (
    txid: string,
    eventName: string,
    waitForEvent: (txid: string, eventName: string, timeoutMs?: number) => Promise<unknown>,
  ): Promise<{ pending: boolean }> => {
    try {
      await waitForEvent(txid, eventName);
      return { pending: false };
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes(`Event "${eventName}" not found`)) {
        return { pending: true };
      }
      throw e;
    }
  };

  const loadUserStats = async () => {
    if (!address.value) return;
    try {
      const contract = await ensureContractAddress();
      const res = await invokeRead({
        scriptHash: contract,
        operation: "GetUserStats",
        args: [{ type: "Hash160", value: address.value }],
      });
      const data = parseInvokeResult(res);
      if (Array.isArray(data)) {
        currentStreak.value = Number(data[0] ?? 0);
        highestStreak.value = Number(data[1] ?? 0);
        lastCheckInDay.value = Number(data[2] ?? 0);
        unclaimedRewards.value = Number(data[3] ?? 0);
        totalClaimed.value = Number(data[4] ?? 0);
        totalUserCheckins.value = Number(data[5] ?? 0);
      }
    } catch (_e: unknown) {
      // User stats load failure handled silently
    }
  };

  const loadGlobalStats = async () => {
    try {
      const contract = await ensureContractAddress();
      const res = await invokeRead({
        scriptHash: contract,
        operation: "GetPlatformStats",
        args: [],
      });
      const data = parseInvokeResult(res);
      if (Array.isArray(data)) {
        globalStats.value = {
          totalUsers: Number(data[0] ?? 0),
          totalCheckins: Number(data[1] ?? 0),
          totalRewarded: Number(data[2] ?? 0),
        };
      }
    } catch (_e: unknown) {
      // Global stats load failure handled silently
    }
  };

  const loadHistory = async () => {
    if (!address.value) return;
    try {
      const res = await listEvents({ app_id: APP_ID, event_name: "CheckedIn", limit: 10 });
      const currentAddress = address.value;
      checkinHistory.value = res.events
        .filter((evt) => {
          const evtRecord = evt as unknown as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          return String(values[0] ?? "") === currentAddress;
        })
        .map((evt) => {
          const evtRecord = evt as unknown as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          return {
            streak: Number(values[1] ?? 0),
            time: new Date(evt.created_at || Date.now()).toLocaleString(),
            reward: Number(values[2] ?? 0),
          };
        });
    } catch (_e: unknown) {
      // History load failure handled silently
    }
  };

  const doCheckIn = async (canCheckIn: boolean) => {
    if (!canCheckIn || isLoading.value) return;
    clearStatus();

    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) throw new Error(t("connectWallet"));

      const contract = await ensureContractAddress();
      const { receiptId, invoke, waitForEvent } = await processPayment(String(CHECK_IN_FEE), "checkin");
      if (!receiptId) throw new Error(t("receiptMissing"));

      const tx = await invoke(
        "checkIn",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      const txid = extractTxid(tx);
      const result = txid
        ? await waitForPendingOrConfirm(txid, "CheckedIn", waitForEvent)
        : { pending: true };

      if (result.pending) {
        setStatus(t("pendingConfirmation", { action: t("checkinSuccess") }), "success");
      } else {
        setStatus(t("checkinSuccess"), "success");
      }

      await loadUserStats();
      await loadGlobalStats();
      await loadHistory();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const claimRewards = async () => {
    if (unclaimedRewards.value <= 0 || isClaiming.value) return;
    isClaiming.value = true;
    clearStatus();

    try {
      if (!address.value) throw new Error(t("connectWallet"));

      const contract = await ensureContractAddress();
      const { invoke, waitForEvent } = await processPayment("0", "claim");
      const tx = await invoke("claimRewards", [{ type: "Hash160", value: address.value }], contract);

      const txid = extractTxid(tx);
      const result = txid
        ? await waitForPendingOrConfirm(txid, "RewardsClaimed", waitForEvent)
        : { pending: true };

      if (result.pending) {
        setStatus(t("pendingConfirmation", { action: t("claimSuccess") }), "success");
      } else {
        setStatus(t("claimSuccess"), "success");
      }

      await loadUserStats();
      await loadGlobalStats();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isClaiming.value = false;
    }
  };

  const loadAll = async () => {
    await loadUserStats();
    await loadGlobalStats();
    await loadHistory();
  };

  return {
    currentStreak,
    highestStreak,
    lastCheckInDay,
    unclaimedRewards,
    totalClaimed,
    totalUserCheckins,
    status,
    isClaiming,
    isLoading,
    globalStats,
    checkinHistory,
    sidebarItems,
    userStats,
    doCheckIn,
    claimRewards,
    loadAll,
  };
}
