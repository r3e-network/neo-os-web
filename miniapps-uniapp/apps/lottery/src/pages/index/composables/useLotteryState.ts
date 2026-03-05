import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNum } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const APP_ID = "miniapp-lottery";

interface Winner {
  address: string;
  round: number;
  prize: number;
}

interface PlatformStats {
  totalTickets: string;
  prizePool: string;
}

interface BuyResult {
  ticketId: string;
  round: number;
}

export function useLotteryState(t: (key: string) => string) {
  const { chainType } = useWallet() as WalletSDK;
  const { address, ensureWallet, read, invoke } = useContractInteraction({
    appId: APP_ID,
    t: (key: string) => (key === "contractUnavailable" ? "Contract address not found" : t(key)),
  });
  const { list: listEvents } = useEvents();

  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeTab = ref("game");
  const buyingType = ref<number | null>(null);
  const showFireworks = ref(false);

  const winners = ref<Winner[]>([]);
  const platformStats = ref<PlatformStats | null>(null);

  const totalTickets = computed(() => platformStats.value?.totalTickets ?? "0");
  const prizePool = computed(() => platformStats.value?.prizePool ?? "0");

  const setError = (message: string) => {
    error.value = message;
  };

  const clearError = () => {
    error.value = null;
  };

  const loadPlatformStats = async () => {
    if (!requireNeoChain(chainType.value, t)) return;

    try {
      const parsed = await read("getPlatformStats");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const stats = parsed as Record<string, unknown>;
        platformStats.value = {
          totalTickets: String(stats.totalTickets ?? stats.TotalTickets ?? "0"),
          prizePool: String(stats.prizePool ?? stats.PrizePool ?? "0"),
        };
      }
    } catch (e: unknown) {
      const message = formatErrorMessage(e, "Failed to load platform stats");
      setError(message);
    }
  };

  const loadWinners = async () => {
    try {
      const res = await listEvents({ app_id: APP_ID, event_name: "RoundCompleted", limit: 10 });
      const parsed = (res.events || [])
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
          const round = Number(values[0] ?? 0);
          const address = String(values[1] ?? "");
          const prize = Number(values[2] ?? 0);
          if (!address || prize <= 0) return null;
          return { address, round, prize };
        })
        .filter(Boolean) as Winner[];
      winners.value = parsed;
    } catch (e: unknown) {
      const message = formatErrorMessage(e, "Failed to load winners");
      setError(message);
      winners.value = [];
    }
  };

  const loadAll = async () => {
    isLoading.value = true;
    clearError();

    try {
      await Promise.all([loadPlatformStats(), loadWinners()]);
    } finally {
      isLoading.value = false;
    }
  };

  const buyTicket = async (lotteryType: number): Promise<BuyResult> => {
    await ensureWallet();

    if (!requireNeoChain(chainType.value, t)) {
      throw new Error("Wrong chain");
    }

    buyingType.value = lotteryType;
    clearError();

    try {
      const { txid, waitForEvent } = await invoke("1", `lottery:buy:${lotteryType}`, "BuyTicketsForType", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: lotteryType },
        { type: "Integer", value: "1" },
        { type: "Integer", value: "0" },
      ]);

      if (!txid) {
        throw new Error("Transaction failed");
      }

      const event = await waitForEvent(txid, "TicketPurchased");
      if (!event) {
        throw new Error("Failed to get ticket event");
      }

      const evtRecord = event as unknown as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const ticketId = String(values[0] ?? "");
      const round = Number(values[1] ?? 0);

      if (!ticketId) {
        throw new Error("Failed to get ticket ID");
      }

      await loadPlatformStats();

      return { ticketId, round };
    } finally {
      buyingType.value = null;
    }
  };

  return {
    isLoading,
    error,
    activeTab,
    buyingType,
    showFireworks,
    winners,
    platformStats,
    totalTickets,
    prizePool,
    formatNum,
    setError,
    clearError,
    loadPlatformStats,
    loadWinners,
    loadAll,
    buyTicket,
  };
}
