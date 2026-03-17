import { ref, computed } from "vue";
import { useEvents } from "@shared/utils/wallet-sdk";
import { parseGas, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForListedEventByTransaction } from "@shared/utils";
import type { LeaderEntry } from "../pages/index/components/LeaderboardList.vue";

const APP_ID = "miniapp-burn-league";

/** Manages GAS burn actions, leaderboard, and stats for the burn league miniapp. */
export function useBurnLeague(t: (key: string) => string) {
  const { address, ensureWallet, read, ensureContractAddress, contractAddress, invokeDirectly } = useContractInteraction({
    appId: APP_ID,
    t,
  });
  const { list: listEvents } = useEvents();
  const { listAllEvents } = useAllEvents(listEvents, APP_ID);

  const totalBurned = ref(0);
  const rewardPool = ref(0);
  const userBurned = ref(0);
  const rank = ref(0);
  const burnCount = ref(0);
  const leaderboard = ref<LeaderEntry[]>([]);
  const isBurning = ref(false);

  const isLoading = computed(() => isBurning.value);

  const loadStats = async () => {
    await ensureContractAddress();
    totalBurned.value = parseGas(await read("TotalBurned"));
    rewardPool.value = parseGas(await read("RewardPool"));
    if (address.value) {
      userBurned.value = parseGas(await read("GetUserTotalBurned", [{ type: "Hash160", value: address.value }]));
    } else {
      userBurned.value = 0;
    }
  };

  const loadLeaderboard = async () => {
    const events = await listAllEvents("GasBurned");
    const totals: Record<string, number> = {};
    let userBurns = 0;
    events.forEach((evt) => {
      const evtRecord = evt as unknown as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const burner = String(values[0] ?? "");
      const amount = Number(values[1] ?? 0);
      if (!burner) return;
      totals[burner] = (totals[burner] || 0) + amount;
      if (address.value && burner === address.value) {
        userBurns += 1;
      }
    });
    const entries = Object.entries(totals)
      .map(([addr, amount]) => ({
        address: addr,
        burned: parseGas(amount),
        isUser: address.value ? addr === address.value : false,
      }))
      .sort((a, b) => b.burned - a.burned)
      .map((entry, idx) => ({ rank: idx + 1, ...entry }));
    leaderboard.value = entries;
    const userEntry = entries.find((entry) => entry.isUser);
    rank.value = userEntry ? userEntry.rank : 0;
    burnCount.value = userBurns;
  };

  const refreshData = async (setStatus?: (msg: string, type: string) => void) => {
    try {
      await Promise.all([loadStats(), loadLeaderboard()]);
    } catch {
      setStatus?.(t("loadFailed"), "error");
    }
  };

  const burnTokens = async (
    burnAmount: string,
    setStatus: (msg: string, type: string) => void,
    onSuccess: () => void
  ) => {
    if (isLoading.value) return;
    const amount = parseFloat(burnAmount);
    const MIN_BURN = 1;
    if (!Number.isFinite(amount) || amount < MIN_BURN) {
      setStatus(t("minBurn", { amount: MIN_BURN }), "error");
      return;
    }
    try {
      await ensureWallet();
      await ensureContractAddress();
      isBurning.value = true;
      setStatus(t("burning"), "loading");

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Hash160", value: contractAddress.value as string },
          { type: "Integer", value: toFixed8(burnAmount) },
          { type: "String", value: `${APP_ID}:burn` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      const result = await invokeDirectly("burnGas", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: toFixed8(burnAmount) },
      ], contractAddress.value as string);

      await waitForListedEventByTransaction<{ tx_hash?: string }>(result.tx, {
        listEvents: async () => {
          const events = await listEvents({ app_id: APP_ID, event_name: "GasBurned", limit: 20 });
          return events.events || [];
        },
        timeoutMs: 30000,
        pollIntervalMs: 1500,
        errorMessage: t("loadFailed"),
      });

      setStatus(`${t("burned")} ${amount} GAS ${t("success")}`, "success");
      onSuccess();
      await refreshData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isBurning.value = false;
    }
  };

  return {
    address,
    totalBurned,
    rewardPool,
    userBurned,
    rank,
    burnCount,
    leaderboard,
    isLoading,
    refreshData,
    burnTokens,
  };
}
