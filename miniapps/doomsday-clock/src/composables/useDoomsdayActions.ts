import { ref, computed } from "vue";
import { formatNumber } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useDoomsdayGame } from "@/composables/useDoomsdayGame";
import { useDoomsdayTimer } from "@/composables/useDoomsdayTimer";

export function useDoomsdayActions() {
  const { t } = useI18n();
  const { handleError, canRetry, clearError } = useErrorHandler();
  const game = useDoomsdayGame();
  const timer = useDoomsdayTimer();

  const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
  const errorMessage = computed(() => errorStatus.value?.msg ?? null);
  const canRetryError = ref(false);
  const lastOperation = ref<string | null>(null);

  const currentEventDescription = computed(() => {
    if (!game.isRoundActive.value) return t("inactiveRound");
    return game.lastBuyer.value ? `${game.lastBuyerLabel.value} ${t("winnerDeclared")}` : t("roundStarted");
  });

  const { status: statusMsg, setStatus: showStatus, clearStatus } = useStatusMessage();

  const connectWallet = async () => {
    try {
      await game.connect();
    } catch (e: unknown) {
      handleError(e, { operation: "connectWallet" });
      setErrorStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const handleBoundaryError = (error: Error) => {
    handleError(error, { operation: "doomsdayBoundaryError" });
    setErrorStatus(t("doomsdayErrorFallback"), "error");
  };

  const resetAndReload = async () => {
    clearError();
    clearErrorStatus();
    canRetryError.value = false;
    await refreshData();
  };

  const retryLastOperation = () => {
    if (lastOperation.value === "buyKeys") handleBuyKeys();
    else if (lastOperation.value === "claimPrize") handleClaimPrize();
  };

  const handleBuyKeys = async () => {
    if (game.isPaying.value) return;
    const validation = game.validateKeyCount(game.keyCount.value);
    if (validation) {
      game.keyValidationError.value = validation;
      showStatus(validation, "error");
      return;
    }
    game.keyValidationError.value = null;
    const count = Math.max(0, Math.floor(Number(game.keyCount.value) || 0));
    if (count <= 0) {
      showStatus(t("error"), "error");
      return;
    }
    if (!game.address.value) {
      try {
        await game.connect();
      } catch (e: unknown) {
        handleError(e, { operation: "connectBeforeBuyKeys" });
        setErrorStatus(formatErrorMessage(e, t("error")), "error");
        return;
      }
    }
    if (!game.address.value) {
      setErrorStatus(t("connectWalletToPlay"), "error");
      return;
    }
    lastOperation.value = "buyKeys";
    try {
      await game.ensureContractAddress();
      const costRaw = game.calculateKeyCostFormula(BigInt(count), game.totalKeysInRound.value);
      const costGas = Number(costRaw) / 1e8;
      const { receiptId, invoke } = await game.processPayment(costGas.toString(), `keys:${game.roundId.value}:${count}`);
      if (!receiptId) throw new Error(t("receiptMissing"));
      await invoke(
        "buyKeysWithCost",
        [
          { type: "Hash160", value: game.address.value as string },
          { type: "Integer", value: count },
          { type: "Integer", value: costRaw.toString() },
          { type: "Integer", value: String(receiptId) },
        ],
        game.contractAddress.value as string
      );
      game.keyCount.value = "1";
      showStatus(t("keysPurchased"), "success");
      await refreshData();
    } catch (e: unknown) {
      handleError(e, { operation: "buyKeys", metadata: { count, roundId: game.roundId.value } });
      const userMsg = formatErrorMessage(e, t("error"));
      const retryable = canRetry(e);
      showStatus(userMsg, "error");
      if (retryable) {
        setErrorStatus(userMsg, "error");
        canRetryError.value = true;
      }
    }
  };

  const handleClaimPrize = async () => {
    if (game.isClaiming.value) return;
    if (!game.address.value) {
      try {
        await game.connect();
      } catch (e: unknown) {
        handleError(e, { operation: "connectBeforeClaim" });
        setErrorStatus(formatErrorMessage(e, t("error")), "error");
        return;
      }
    }
    if (!game.address.value) {
      setErrorStatus(t("connectWalletToPlay"), "error");
      return;
    }
    lastOperation.value = "claimPrize";
    try {
      game.isClaiming.value = true;
      await game.ensureContractAddress();
      await game.invokeContract({
        scriptHash: game.contractAddress.value as string,
        operation: "checkAndEndRound",
        args: [],
      });
      showStatus(t("prizeClaimed"), "success");
      await refreshData();
    } catch (e: unknown) {
      handleError(e, { operation: "claimPrize" });
      const userMsg = formatErrorMessage(e, t("error"));
      const retryable = canRetry(e);
      showStatus(userMsg, "error");
      if (retryable) {
        setErrorStatus(userMsg, "error");
        canRetryError.value = true;
      }
    } finally {
      game.isClaiming.value = false;
    }
  };

  const refreshData = async () => {
    try {
      game.loading.value = true;
      const remainingSeconds = await game.loadRoundData();
      const endTime = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
      timer.setEndTime(endTime);
      timer.isRoundActive.value = game.isRoundActive.value;
      await game.loadUserKeys();
      await game.loadHistory();
    } catch (e: unknown) {
      handleError(e, { operation: "refreshData" });
      showStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      game.loading.value = false;
    }
  };

  return {
    // Delegated state
    game,
    timer,
    // Local state
    errorMessage,
    canRetryError,
    statusMsg,
    currentEventDescription,
    // Actions
    connectWallet,
    handleBoundaryError,
    resetAndReload,
    retryLastOperation,
    handleBuyKeys,
    handleClaimPrize,
    refreshData,
  };
}
