import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import type { StatsDisplayItem } from "@shared/components";
import { useLotteryTypes } from "../../../shared/composables/useLotteryTypes";
import { useScratchCard } from "../../../shared/composables/useScratchCard";
import { useLotteryState } from "./useLotteryState";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export function useLotteryPage(
  t: (key: string, params?: Record<string, unknown>) => string,
  setErrorStatus: (msg: string, type: string) => void,
  clearErrorStatus: () => void
) {
  const { handleError, canRetry, clearError } = useErrorHandler();
  const { instantTypes, getLotteryType } = useLotteryTypes();
  const { buyTicket, revealTicket, loadPlayerTickets, unscratchedTickets, playerTickets, isLoading } = useScratchCard();
  const { address, connect } = useWallet() as WalletSDK;

  const {
    activeTab,
    buyingType,
    showFireworks,
    winners,
    totalTickets,
    prizePool,
    formatNum,
    loadPlatformStats,
    loadWinners,
  } = useLotteryState(t);

  // Computed display data
  const appState = computed(() => ({
    totalTickets: totalTickets.value,
    prizePool: prizePool.value,
    userTickets: playerTickets.value.length,
  }));

  const userTickets = computed(() => playerTickets.value.length);
  const userWinnings = computed(() => playerTickets.value.reduce((acc, t) => acc + (t.prize || 0), 0));

  const lotteryStats = computed(() => [
    { label: t("totalTickets"), value: totalTickets.value },
    { label: t("ticketsBought"), value: playerTickets.value.length },
    { label: t("totalWinnings"), value: `${formatNum(userWinnings.value)} GAS` },
  ]);

  const statsGridItems = computed<StatsDisplayItem[]>(() => [
    { label: t("totalTickets"), value: totalTickets.value, icon: "🎟️", variant: "erobo-neo" },
    { label: t("totalPaidOut"), value: formatNum(prizePool.value), icon: "💰", variant: "erobo-bitcoin" },
  ]);

  const statsRowItems = computed<StatsDisplayItem[]>(() => [
    { label: t("ticketsBought"), value: userTickets.value },
    { label: t("totalWinnings"), value: `${formatNum(userWinnings.value)} GAS`, variant: "success" },
  ]);

  // Ticket/modal state
  const activeTicket = ref<ScratchTicket | null>(null);
  const activeTicketTypeInfo = computed(() => {
    if (!activeTicket.value) return instantTypes.value[0];
    return getLotteryType(activeTicket.value.type) || instantTypes.value[0];
  });

  const canRetryError = ref(false);

  // Handlers
  const connectWallet = async () => {
    try {
      await connect();
    } catch (e: unknown) {
      handleError(e, { operation: "connectWallet" });
      setErrorStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const resetAndReload = async () => {
    clearError();
    clearErrorStatus();
    canRetryError.value = false;

    try {
      await Promise.all([loadPlatformStats(), loadWinners(), address.value ? loadPlayerTickets() : Promise.resolve()]);
    } catch (e: unknown) {
      handleError(e, { operation: "resetAndReload" });
    }
  };

  const handleBuy = async (gameType: LotteryTypeInfo) => {
    if (!address.value) {
      try {
        await connect();
      } catch (e: unknown) {
        handleError(e, { operation: "connectBeforeBuy" });
        setErrorStatus(formatErrorMessage(e, t("error")), "error");
        return;
      }
    }

    if (!address.value) {
      setErrorStatus(t("connectWalletToPlay"), "error");
      return;
    }

    buyingType.value = gameType.type;

    try {
      const result = await buyTicket(gameType.type);
      const newTicket = playerTickets.value.find((t) => t.id === result.ticketId);
      if (newTicket) {
        activeTicket.value = newTicket;
      }
    } catch (e: unknown) {
      handleError(e, { operation: "buyTicket", metadata: { gameType: gameType.type } });
      const userMsg = formatErrorMessage(e, t("error"));
      const retryable = canRetry(e);
      setErrorStatus(userMsg, "error");
      canRetryError.value = retryable;
    } finally {
      buyingType.value = null;
    }
  };

  const playUnscratched = (ticket: ScratchTicket) => {
    activeTicket.value = ticket;
  };

  let fireworksTimer: ReturnType<typeof setTimeout> | null = null;

  const onReveal = async (ticketId: string) => {
    try {
      const res = await revealTicket(ticketId);
      if (res.isWinner) {
        showFireworks.value = true;
        fireworksTimer = setTimeout(() => {
          fireworksTimer = null;
          showFireworks.value = false;
        }, 3000);
      }

      Promise.all([loadPlatformStats(), loadWinners()]).catch((e) => {
        handleError(e, { operation: "reloadStatsAfterReveal" });
      });

      return res;
    } catch (e: unknown) {
      handleError(e, { operation: "revealTicket", metadata: { ticketId } });
      setErrorStatus(formatErrorMessage(e, t("error")), "error");
      throw e;
    }
  };

  const closeModal = () => {
    activeTicket.value = null;
  };

  // Lifecycle
  onUnmounted(() => {
    if (fireworksTimer) {
      clearTimeout(fireworksTimer);
      fireworksTimer = null;
    }
  });

  onMounted(() => {
    if (address.value) {
      loadPlayerTickets().catch((e) => {
        handleError(e, { operation: "loadPlayerTickets" });
      });
    }

    Promise.all([loadPlatformStats(), loadWinners()]).catch((e) => {
      handleError(e, { operation: "loadInitialStats" });
      setErrorStatus(formatErrorMessage(e, t("error")), "error");
      canRetryError.value = canRetry(e);
    });
  });

  return {
    // External composable state
    address,
    instantTypes,
    unscratchedTickets,
    playerTickets,
    isLoading,
    activeTab,
    buyingType,
    showFireworks,
    winners,
    totalTickets,
    prizePool,
    formatNum,
    // Computed
    appState,
    userWinnings,
    lotteryStats,
    statsGridItems,
    statsRowItems,
    activeTicket,
    activeTicketTypeInfo,
    // Handlers
    connectWallet,
    resetAndReload,
    handleBuy,
    playUnscratched,
    onReveal,
    closeModal,
  };
}
