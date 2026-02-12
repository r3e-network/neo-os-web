import { ref, computed } from "vue";
import type { WalletSDK } from "@neo/types";
import { formatNumber, sleep, toFixed8 } from "@shared/utils/format";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { sha256Hex, sha256HexFromHex } from "@shared/utils/hash";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useGameState } from "@shared/composables/useGameState";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { audioManager } from "../../../utils/audio";
import type { GameResult } from "../components/CoinArena.vue";

const APP_ID = "miniapp-coinflip";
const SCRIPT_NAME = "flip-coin";
const MAX_BET = 100;
const MIN_BET = 0.05;

const hexToBigInt = (hex: string): bigint => {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + cleanHex);
};

const hashSeed = async (seed: string): Promise<string> => {
  const raw = String(seed ?? "").trim();
  const cleaned = raw.replace(/^0x/i, "");
  const isHex = cleaned.length > 0 && /^[0-9a-fA-F]+$/.test(cleaned);
  return isHex ? sha256HexFromHex(cleaned) : sha256Hex(raw);
};

const simulateCoinFlip = async (
  seed: string,
  playerChoice: boolean
): Promise<{ won: boolean; outcome: "heads" | "tails" }> => {
  const hashHex = await hashSeed(seed);
  const rand = hexToBigInt(hashHex);
  const resultFlip = rand % BigInt(2) === BigInt(0);
  const won = resultFlip === playerChoice;
  const outcome = resultFlip ? "heads" : "tails";
  return { won, outcome };
};

export function useCoinFlipGame(
  wallet: WalletSDK,
  t: (key: string) => string,
) {
  const { address, connect, invokeContract, invokeRead, chainType } = wallet;
  const { processPayment, waitForEvent } = usePaymentFlow(APP_ID);
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
  const { handleError, canRetry, clearError, lastCategory } = useErrorHandler();
  const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
  const { wins, losses, winRate, totalGames, recordWin, recordLoss } = useGameState();

  const betAmount = ref("1");
  const choice = ref<"heads" | "tails">("heads");
  const totalWon = ref(0);
  const isFlipping = ref(false);
  const result = ref<GameResult | null>(null);
  const displayOutcome = ref<"heads" | "tails" | null>(null);
  const showWinOverlay = ref(false);
  const winAmount = ref("0");
  const flipScriptHash = ref<string | null>(null);
  const errorMessage = computed(() => errorStatus.value?.msg ?? null);
  const validationError = ref<string | null>(null);
  const canRetryError = ref(false);
  const lastOperation = ref<string | null>(null);

  const formatNum = (n: number) => formatNumber(n, 2);

  const validateBetAmount = (amount: string): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num)) return t("invalidAmountNumber");
    if (num < MIN_BET) return t("minBetError").replace("{min}", String(MIN_BET));
    if (num > MAX_BET) return t("maxBetError").replace("{max}", String(MAX_BET));
    if (!/^\d+(\.\d{1,8})?$/.test(amount)) return t("invalidAmountDecimals");
    return null;
  };

  const canBet = computed(() => {
    const n = parseFloat(betAmount.value);
    return n >= MIN_BET && n <= MAX_BET && !validationError.value;
  });

  const ensureScriptHash = async () => {
    if (flipScriptHash.value) return flipScriptHash.value;
    const contract = await ensureContractAddress();

    try {
      const info = await invokeRead({ scriptHash: contract, operation: "getFlipScriptInfo" });
      const parsed = parseInvokeResult(info);
      let hash = "";
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        hash = String((parsed as Record<string, unknown>).hash ?? "");
      }
      if (!hash) {
        const direct = await invokeRead({
          scriptHash: contract,
          operation: "getScriptHash",
          args: [{ type: "String", value: SCRIPT_NAME }],
        });
        const parsedDirect = parseInvokeResult(direct);
        hash = Array.isArray(parsedDirect) ? String(parsedDirect[0] ?? "") : String(parsedDirect ?? "");
      }
      if (!hash) throw new Error(t("scriptHashMissing"));
      flipScriptHash.value = hash.replace(/^0x/i, "");
      return flipScriptHash.value;
    } catch (e: unknown) {
      handleError(e, { operation: "ensureScriptHash", metadata: { contract } });
      throw e;
    }
  };

  const connectWallet = async () => {
    try {
      await connect();
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

    if (!address.value) {
      try {
        await connect();
      } catch (e: unknown) {
        handleError(e, { operation: "connectBeforeFlip" });
        setErrorStatus(t("connectWalletToPlay"), "error");
        return;
      }
    }

    if (!address.value) {
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
      const contract = await ensureContractAddress();
      const amountBase = toFixed8(betAmount.value);
      if (amountBase === "0") throw new Error(t("invalidBetAmount"));

      const { receiptId, invoke: invokeWithReceipt } = await processPayment(
        betAmount.value,
        `coinflip:${choice.value}:${betAmount.value}`
      );

      const initiateResult = (await invokeWithReceipt("initiateBet", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: amountBase },
        { type: "Boolean", value: choice.value === "heads" },
        { type: "Integer", value: String(receiptId) },
      ])) as { txid: string; receiptId: string };

      const initiateTxid = initiateResult.txid;
      const initiatedEvent = initiateTxid ? await waitForEvent(initiateTxid, "BetInitiated") : null;
      if (!initiatedEvent) throw new Error(t("betPending"));

      const initiatedRecord = initiatedEvent as unknown as Record<string, unknown>;
      const initiatedValues = Array.isArray(initiatedRecord?.state)
        ? (initiatedRecord.state as unknown[]).map(parseStackItem)
        : [];
      const betId = String(initiatedValues[1] ?? "");
      const seed = String(initiatedValues[4] ?? "");
      if (!betId || !seed) throw new Error(t("betMissing"));

      audioManager.play("flip");
      const playerChoice = choice.value === "heads";
      const simulated = await simulateCoinFlip(seed, playerChoice);

      displayOutcome.value = simulated.outcome;
      await sleep(400);
      isFlipping.value = false;
      result.value = { won: simulated.won, outcome: simulated.outcome.toUpperCase() };

      if (simulated.won) audioManager.play("win");
      else audioManager.play("lose");

      const scriptHash = await ensureScriptHash();

      try {
        const settleTx = await invokeContract({
          scriptHash: contract,
          operation: "settleBet",
          args: [
            { type: "Hash160", value: address.value as string },
            { type: "Integer", value: betId },
            { type: "Boolean", value: simulated.won },
            { type: "ByteArray", value: scriptHash },
          ],
        });

        const settleResult = settleTx as unknown as Record<string, unknown> | undefined;
        const settleTxid = String(settleResult?.txid || settleResult?.txHash || "");
        if (settleTxid) {
          const resolvedEvent = await waitForEvent(settleTxid, "BetResolved");
          if (resolvedEvent) {
            const resolvedRecord = resolvedEvent as unknown as Record<string, unknown>;
            const values = Array.isArray(resolvedRecord?.state)
              ? (resolvedRecord.state as unknown[]).map(parseStackItem)
              : [];
            const payoutRaw = values[3];
            const payoutValue = Number(payoutRaw || 0) / 1e8;

            if (simulated.won) {
              recordWin(payoutValue);
              totalWon.value += payoutValue;
              winAmount.value = payoutValue.toFixed(2);
              showWinOverlay.value = true;
            } else {
              recordLoss();
            }
          }
        }
      } catch (settleError: unknown) {
        handleError(settleError, { operation: "settleBet", metadata: { betId, won: simulated.won } });
        if (simulated.won) recordWin(0);
        else recordLoss();
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
