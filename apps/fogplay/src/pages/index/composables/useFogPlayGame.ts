import { ref, computed } from "vue";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { formatNum, sleep, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForEventByTransaction } from "@shared/utils/transaction";
import { useEvents } from "@shared/utils/wallet-sdk";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { audioManager } from "../../../utils/audio";
import type { GameResult } from "../components/CoinArena.vue";

const APP_ID = "miniapp-fogplay";
const MAX_BET = 100;
const MIN_BET = 0.05;

export function useFogPlayGame(wallet: WalletSDK, t: (key: string) => string) {
  const { address, ensureWallet, ensureContractAddress } = useContractInteraction({ appId: APP_ID, t, wallet });
  const { handleError, canRetry, clearError } = useErrorHandler();
  const { status: errorStatus, setStatus: setErrorStatus } = useStatusMessage(5000);
  const { list: listEvents } = useEvents();

  const wins = ref(0);
  const losses = ref(0);
  const totalGames = computed(() => wins.value + losses.value);
  const recordWin = () => {
    wins.value += 1;
  };
  const recordLoss = () => {
    losses.value += 1;
  };

  const betAmount = ref("1");
  const choice = ref<"heads" | "tails">("heads");
  const totalWon = ref(0);
  const isFlipping = ref(false);
  const result = ref<GameResult | null>(null);
  const displayOutcome = ref<"heads" | "tails" | null>(null);
  const showWinOverlay = ref(false);
  const winAmount = ref("0");
  const errorMessage = computed(() => errorStatus.value?.msg ?? null);
  const validationError = ref<string | null>(null);
  const canRetryError = ref(false);
  const lastOperation = ref<string | null>(null);

  const validateBetAmount = (amount: string): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num)) return t("invalidAmountNumber");
    if (num < MIN_BET) return t("minBetError", { min: String(MIN_BET), tokenGas: t("tokenGas") });
    if (num > MAX_BET) return t("maxBetError", { max: String(MAX_BET), tokenGas: t("tokenGas") });
    if (!/^\d+(\.\d{1,8})?$/.test(amount)) return t("invalidAmountDecimals");
    return null;
  };

  const canBet = computed(() => {
    const n = parseFloat(betAmount.value);
    return n >= MIN_BET && n <= MAX_BET && !validationError.value;
  });

  const connectWallet = async () => {
    try {
      await ensureWallet();
    } catch (e: unknown) {
      handleError(e, { operation: "connectWallet" });
      setErrorStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const resetGame = () => {
    isFlipping.value = false;
    result.value = null;
    displayOutcome.value = null;
    showWinOverlay.value = false;
    clearError();
  };

  const handleBoundaryError = (error: Error) => {
    handleError(error, { operation: "boundaryError" });
    setErrorStatus(t("gameErrorFallback"), "error");
  };

  const retryOperation = () => {
    if (lastOperation.value === "flip") handleFlip();
  };

  const handleFlip = async () => {
    const validation = validateBetAmount(betAmount.value);
    if (validation) {
      validationError.value = validation;
      setErrorStatus(validation, "error");
      return;
    }
    validationError.value = null;

    try {
      await ensureWallet();
    } catch (e: unknown) {
      handleError(e, { operation: "connectBeforeFlip" });
      setErrorStatus(t("connectWalletToPlay"), "error");
      return;
    }

    if (isFlipping.value || !canBet.value) return;

    isFlipping.value = true;
    result.value = null;
    displayOutcome.value = null;
    showWinOverlay.value = false;
    lastOperation.value = "flip";

    try {
      const amountBase = toFixed8(betAmount.value);
      if (amountBase === "0") throw new Error(t("invalidBetAmount"));

      const contract = await ensureContractAddress();
      await wallet.invokeContract({
        scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: amountBase },
          { type: "String", value: `${APP_ID}:bet` },
        ],
      });

      // Wait briefly for the prepaid GAS transfer to be indexed on-chain before
      // consuming the credit in the bet call.
      await sleep(4000);

      const { txid } = await wallet.invokeContract({
        scriptHash: contract,
        operation: "placeBet",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: amountBase },
          { type: "Boolean", value: choice.value === "heads" },
        ],
      });

      const initiatedEvent = await waitForEventByTransaction(
        { txid },
        "BetPlaced",
        async (txidToFind: string, eventName: string, timeoutMs = 30000) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            const resultEvents = await listEvents({
              app_id: APP_ID,
              event_name: eventName,
              limit: 20,
              tx_hash: txidToFind,
            });
            if (resultEvents.events.length > 0) return resultEvents.events[0] as unknown as Record<string, unknown>;
            await sleep(2500);
          }
          throw new Error(t("betPending"));
        },
      );
      if (!initiatedEvent) throw new Error(t("betPending"));

      const initiatedRecord = initiatedEvent as unknown as Record<string, unknown>;
      const initiatedValues = Array.isArray(initiatedRecord?.state)
        ? (initiatedRecord.state as unknown[]).map(parseStackItem)
        : [];
      const betId = String(initiatedValues[3] ?? "");
      if (!betId) throw new Error(t("betPending"));

      audioManager.play("flip");
      await sleep(600);

      const deadline = Date.now() + 60000;
      let resolvedEvent: Record<string, unknown> | null = null;

      while (Date.now() < deadline) {
        const resultEvents = await listEvents({
          app_id: APP_ID,
          event_name: "BetResolved",
          limit: 20,
        });

        const match = resultEvents.events.find((evt) => {
          const values = Array.isArray(evt.state) ? evt.state.map(parseStackItem) : [];
          return String(values[3] ?? "") === betId;
        });

        if (match) {
          resolvedEvent = match as unknown as Record<string, unknown>;
          break;
        }

        await sleep(2500);
      }

      if (!resolvedEvent) {
        throw new Error(t("betPending"));
      }

      const values = Array.isArray(resolvedEvent.state)
        ? (resolvedEvent.state as unknown[]).map(parseStackItem)
        : [];
      const payoutRaw = values[1];
      const won = Boolean(values[2]);
      const payoutValue = Number(payoutRaw || 0) / 1e8;
      const outcome = won ? choice.value : choice.value === "heads" ? "tails" : "heads";

      displayOutcome.value = outcome;
      isFlipping.value = false;
      result.value = { won, outcome: outcome.toUpperCase() };

      if (won) {
        audioManager.play("win");
        recordWin(payoutValue);
        totalWon.value += payoutValue;
        winAmount.value = payoutValue.toFixed(2);
        showWinOverlay.value = true;
      } else {
        audioManager.play("lose");
        recordLoss();
      }
    } catch (e: unknown) {
      handleError(e, { operation: "flip", metadata: { betAmount: betAmount.value, choice: choice.value } });
      const userMsg = formatErrorMessage(e, t("flipFailed"));
      const retryable = canRetry(e);
      setErrorStatus(userMsg, "error");
      canRetryError.value = retryable;
      isFlipping.value = false;
    }
  };

  return {
    // State
    betAmount,
    choice,
    totalWon,
    isFlipping,
    result,
    displayOutcome,
    showWinOverlay,
    winAmount,
    errorMessage,
    validationError,
    canRetryError,
    canBet,
    wins,
    losses,
    totalGames,
    // Actions
    formatNum,
    connectWallet,
    resetGame,
    handleBoundaryError,
    retryOperation,
    handleFlip,
  };
}
