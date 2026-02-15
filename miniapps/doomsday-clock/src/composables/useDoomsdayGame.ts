import { ref, computed } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { formatAddress, parseGas } from "@shared/utils/format";
import { normalizeScriptHash, addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { HistoryEvent } from "../pages/index/components/HistoryList.vue";

const APP_ID = "miniapp-doomsday-clock";
const BASE_KEY_PRICE = 10000000n;
const KEY_PRICE_INCREMENT_BPS = 10n;

/** Manages doomsday clock game state, key purchases, and prize pool. */
export function useDoomsdayGame() {
  const { t } = createUseI18n(messages)();
  const { handleError, getUserMessage, canRetry } = useErrorHandler();
  const {
    address,
    ensureWallet,
    read,
    invoke,
    invokeDirectly,
    contractAddress,
    ensureContractAddress,
    isProcessing: isPaying,
  } = useContractInteraction({
    appId: APP_ID,
    t: (key: string) => (key === "contractUnavailable" ? t("error") : t(key)),
  });
  const { list: listEvents } = useEvents();

  const roundId = ref(0);
  const totalPot = ref(0);
  const isRoundActive = ref(false);
  const lastBuyer = ref<string | null>(null);
  const userKeys = ref(0);
  const keyCount = ref("1");
  const keyValidationError = ref<string | null>(null);
  const { status, setStatus } = useStatusMessage();
  const history = ref<HistoryEvent[]>([]);
  const loading = ref(false);
  const isClaiming = ref(false);
  const totalKeysInRound = ref(0n);

  const lastBuyerLabel = computed(() => (lastBuyer.value ? formatAddress(lastBuyer.value) : "--"));

  const lastBuyerHash = computed(() => normalizeScriptHash(String(lastBuyer.value || "")));
  const addressHash = computed(() => (address.value ? addressToScriptHash(address.value) : ""));

  const canClaim = computed(() => {
    return (
      !isRoundActive.value &&
      lastBuyerHash.value &&
      addressHash.value &&
      lastBuyerHash.value === addressHash.value &&
      totalPot.value > 0
    );
  });

  const calculateKeyCostFormula = (keyCount: bigint, currentTotalKeys: bigint): bigint => {
    if (keyCount <= 0n) return 0n;
    const commonDiff = (BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS) / 10000n;
    const firstKeyPrice = BASE_KEY_PRICE + currentTotalKeys * commonDiff;
    const baseCost = keyCount * firstKeyPrice;
    const incrementCost = ((keyCount * (keyCount - 1n)) / 2n) * commonDiff;
    return baseCost + incrementCost;
  };

  const estimatedCostRaw = computed(() => {
    const count = BigInt(Math.max(0, Math.floor(Number(keyCount.value) || 0)));
    return calculateKeyCostFormula(count, totalKeysInRound.value);
  });

  const estimatedCost = computed(() => (Number(estimatedCostRaw.value) / 1e8).toFixed(2));

  const loadRoundData = async () => {
    await ensureContractAddress();
    try {
      const data = await read("getGameStatus");
      if (data && typeof data === "object") {
        const statusMap = data as Record<string, unknown>;
        roundId.value = Number(statusMap.roundId || 0);
        totalPot.value = parseGas(statusMap.pot);
        isRoundActive.value = Boolean(statusMap.active);
        lastBuyer.value = String(statusMap.lastBuyer || "");
        totalKeysInRound.value = BigInt(statusMap.totalKeys || 0);
        return Number(statusMap.remainingTime || 0);
      }
      return 0;
    } catch (e: unknown) {
      handleError(e, { operation: "loadRoundData" });
      throw e;
    }
  };

  const loadUserKeys = async () => {
    if (!address.value || !roundId.value || !contractAddress.value) {
      userKeys.value = 0;
      return;
    }
    try {
      const parsed = await read("getPlayerKeys", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: roundId.value },
      ]);
      userKeys.value = Number(parsed || 0);
    } catch (e: unknown) {
      handleError(e, { operation: "loadUserKeys", metadata: { roundId: roundId.value } });
      userKeys.value = 0;
    }
  };

  const parseEventDate = (raw: unknown) => {
    const date = raw ? new Date(raw) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toLocaleString();
    return date.toLocaleString();
  };

  const loadHistory = async () => {
    try {
      const [keysRes, winnerRes, roundRes] = await Promise.all([
        listEvents({ app_id: APP_ID, event_name: "KeysPurchased", limit: 20 }),
        listEvents({ app_id: APP_ID, event_name: "DoomsdayWinner", limit: 10 }),
        listEvents({ app_id: APP_ID, event_name: "RoundStarted", limit: 10 }),
      ]);

      const items: HistoryEvent[] = [];

      keysRes.events.forEach((evt) => {
        const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
        const player = String(values[0] || "");
        const keys = Number(values[1] || 0);
        const potContribution = parseGas(values[2]);
        items.push({
          id: evt.id,
          title: t("keysPurchased"),
          details: `${formatAddress(player)} • ${keys} keys • +${potContribution.toFixed(2)} GAS`,
          date: parseEventDate(evt.created_at),
        });
      });

      winnerRes.events.forEach((evt) => {
        const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
        const winner = String(values[0] || "");
        const prize = parseGas(values[1]);
        const round = Number(values[2] || 0);
        items.push({
          id: evt.id,
          title: t("winnerDeclared"),
          details: `${formatAddress(winner)} • ${prize.toFixed(2)} GAS • #${round}`,
          date: parseEventDate(evt.created_at),
        });
      });

      roundRes.events.forEach((evt) => {
        const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
        const round = Number(values[0] || 0);
        const end = Number(values[1] || 0) * 1000;
        const endText = end ? new Date(end).toLocaleString() : "--";
        items.push({
          id: evt.id,
          title: t("roundStarted"),
          details: `#${round} • ${endText}`,
          date: parseEventDate(evt.created_at),
        });
      });

      history.value = items.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e: unknown) {
      handleError(e, { operation: "loadHistory" });
      history.value = [];
    }
  };

  const validateKeyCount = (count: string): string | null => {
    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) return t("invalidKeyCount");
    if (num > 1000) return t("maxKeyCountExceeded");
    return null;
  };

  return {
    APP_ID,
    address,
    ensureWallet,
    contractAddress,
    roundId,
    totalPot,
    isRoundActive,
    lastBuyer,
    userKeys,
    keyCount,
    keyValidationError,
    status,
    setStatus,
    history,
    loading,
    isClaiming,
    isPaying,
    lastBuyerLabel,
    canClaim,
    estimatedCost,
    estimatedCostRaw,
    calculateKeyCostFormula,
    ensureContractAddress,
    loadRoundData,
    loadUserKeys,
    loadHistory,
    validateKeyCount,
    invokeDirectly,
    invoke,
    t,
    handleError,
    getUserMessage,
    canRetry,
  };
}
