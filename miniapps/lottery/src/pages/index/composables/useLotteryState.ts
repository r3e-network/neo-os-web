import { ref, computed } from "vue";
import type { WalletSDK } from "@neo/types";
import { formatNumber } from "@shared/utils/format";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
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
  const { address, connect, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const { processPayment } = usePaymentFlow(APP_ID);
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? "Contract address not found" : t(key),
  );

  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeTab = ref("game");
  const buyingType = ref<number | null>(null);
  const showFireworks = ref(false);

  const winners = ref<Winner[]>([]);
  const platformStats = ref<PlatformStats | null>(null);

  const formatNum = (n: number | string) => formatNumber(n, 2);

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
      const contract = await ensureContractAddress({ silentChainCheck: true });

      const res = await invokeRead({
        scriptHash: contract,
        operation: "getPlatformStats",
        args: [],
      });

      const parsed = parseInvokeResult(res);
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
        .map((evt: Record<string, unknown>) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
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
    if (!address.value) {
      await connect();
      if (!address.value) {
        throw new Error("Wallet not connected");
      }
    }

    if (!requireNeoChain(chainType.value, t)) {
      throw new Error("Wrong chain");
    }

    const contract = await ensureContractAddress({ silentChainCheck: true });

    buyingType.value = lotteryType;
    clearError();

    try {
      const { invoke, waitForEvent } = await processPayment("1", `lottery:buy:${lotteryType}`);

      const result = await invoke(contract, "BuyTicketsForType", [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: lotteryType },
        { type: "Integer", value: "1" },
        { type: "Integer", value: "0" },
      ]);

      if (!result?.txid) {
        throw new Error("Transaction failed");
      }

      const event = await waitForEvent(result.txid, "TicketPurchased");
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
