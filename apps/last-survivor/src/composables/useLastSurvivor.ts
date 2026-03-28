/**
 * useLastSurvivor — Domain logic for the Last Survivor (doomsday clock) miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Contains ONLY game domain logic: load round data, buy keys, claim prize, timer.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatNumber, parseGas, toFixed8 } from "@shared/utils/format";
import { formatAddress, normalizeScriptHash, addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { HistoryEvent } from "../pages/index/components/HistoryList.vue";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-last-survivor";
const BASE_KEY_PRICE = 10000000n;
const KEY_PRICE_INCREMENT_BPS = 10n;
const WAIT_AFTER_TRANSFER_MS = 4000;

// ============================================================================
// Types
// ============================================================================

export interface UseLastSurvivorOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useLastSurvivor({ chain, eventBus, t }: UseLastSurvivorOptions) {
  // ── Game State ──────────────────────────────────────────────────────
  const roundId = ref(0);
  const totalPot = ref(0);
  const isRoundActive = ref(false);
  const lastBuyer = ref<string | null>(null);
  const userKeys = ref(0);
  const keyCount = ref("1");
  const keyValidationError = ref<string | null>(null);
  const history = ref<HistoryEvent[]>([]);
  const isBuyingKeys = ref(false);
  const isClaiming = ref(false);
  const isLoading = ref(false);
  const totalKeysInRound = ref(0n);

  // ── Timer State ─────────────────────────────────────────────────────
  const endTime = ref(0);
  const now = ref(Date.now());
  const MAX_DURATION_SECONDS = 86400;

  const timeRemainingSeconds = computed(() => {
    if (!endTime.value) return 0;
    return Math.max(0, Math.floor((endTime.value - now.value) / 1000));
  });

  const countdown = computed(() => {
    const total = timeRemainingSeconds.value;
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  });

  const dangerLevel = computed(() => {
    const seconds = timeRemainingSeconds.value;
    if (seconds > 7200) return "low";
    if (seconds > 3600) return "medium";
    if (seconds > 600) return "high";
    return "critical";
  });

  const dangerLevelText = computed(() => {
    switch (dangerLevel.value) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  });

  const dangerProgress = computed(() => {
    if (!timeRemainingSeconds.value) return 0;
    return Math.min(100, (timeRemainingSeconds.value / MAX_DURATION_SECONDS) * 100);
  });

  const shouldPulse = computed(() => timeRemainingSeconds.value <= 600);

  const updateNow = () => { now.value = Date.now(); };

  // ── Formatted display values ──────────────────────────────────────
  const lastBuyerLabel = computed(() => lastBuyer.value ? formatAddress(lastBuyer.value) : t("notAvailable"));
  const formattedRound = computed(() => `#${roundId.value}`);
  const totalPotDisplay = computed(() => `${formatNumber(totalPot.value, 2)} ${t("tokenGas")}`);
  const roundStatusDisplay = computed(() => isRoundActive.value ? t("activeRound") : t("inactiveRound"));

  const lastBuyerHash = computed(() => normalizeScriptHash(String(lastBuyer.value || "")));
  const addressHash = computed(() => chain.address.value ? addressToScriptHash(chain.address.value) : "");

  const canClaim = computed(() => {
    return (
      !isRoundActive.value &&
      lastBuyerHash.value &&
      addressHash.value &&
      lastBuyerHash.value === addressHash.value &&
      totalPot.value > 0
    );
  });

  const calculateKeyCostFormula = (count: bigint, currentTotalKeys: bigint): bigint => {
    if (count <= 0n) return 0n;
    const commonDiff = (BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS) / 10000n;
    const firstKeyPrice = BASE_KEY_PRICE + currentTotalKeys * commonDiff;
    const baseCost = count * firstKeyPrice;
    const incrementCost = ((count * (count - 1n)) / 2n) * commonDiff;
    return baseCost + incrementCost;
  };

  const estimatedCostRaw = computed(() => {
    const count = BigInt(Math.max(0, Math.floor(Number(keyCount.value) || 0)));
    return calculateKeyCostFormula(count, totalKeysInRound.value);
  });

  const estimatedCost = computed(() => (Number(estimatedCostRaw.value) / 1e8).toFixed(2));

  // ── Data Loading ──────────────────────────────────────────────────
  const loadRoundData = async () => {
    try {
      const data = await chain.read("getGameStatus");
      if (data && typeof data === "object") {
        const statusMap = data as Record<string, unknown>;
        roundId.value = Number(statusMap.roundId || 0);
        totalPot.value = parseGas(statusMap.pot);
        isRoundActive.value = Boolean(statusMap.active);
        lastBuyer.value = String(statusMap.lastBuyer || "");
        totalKeysInRound.value = BigInt(Number(statusMap.totalKeys) || 0);
        return Number(statusMap.remainingTime || 0);
      }
      return 0;
    } catch (e) {
      console.warn("[useLastSurvivor] loadRoundData failed:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  const loadUserKeys = async () => {
    if (!chain.address.value || !roundId.value) {
      userKeys.value = 0;
      return;
    }
    try {
      const parsed = await chain.read("getPlayerKeys", [
        { type: "Hash160", value: chain.address.value },
        { type: "Integer", value: roundId.value },
      ]);
      userKeys.value = Number(parsed || 0);
    } catch (e) {
      console.warn("[useLastSurvivor] loadUserKeys failed:", e instanceof Error ? e.message : String(e));
      userKeys.value = 0;
    }
  };

  const parseEventDate = (raw: unknown) => {
    const date = raw ? new Date(raw as string | number | Date) : new Date();
    if (Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(undefined).format(new Date());
    return new Intl.DateTimeFormat(undefined).format(date);
  };

  const loadHistory = async () => {
    try {
      const [keysRes, winnerRes, roundRes] = await Promise.all([
        chain.listEvents("KeysPurchased", { limit: 20 }),
        chain.listEvents("DoomsdayWinner", { limit: 10 }),
        chain.listEvents("RoundStarted", { limit: 10 }),
      ]);

      const items: HistoryEvent[] = [];

      keysRes.forEach((evt: unknown) => {
        const evtRecord = evt as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const player = String(values[0] || "");
        const keys = Number(values[1] || 0);
        const potContribution = parseGas(values[2]);
        items.push({
          id: evtRecord.id as string | number,
          title: t("keysPurchased"),
          details: `${formatAddress(player)} • ${keys} keys • +${potContribution.toFixed(2)} ${t("tokenGas")}`,
          date: parseEventDate(evtRecord.created_at),
        });
      });

      winnerRes.forEach((evt: unknown) => {
        const evtRecord = evt as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const winner = String(values[0] || "");
        const prize = parseGas(values[1]);
        const round = Number(values[2] || 0);
        items.push({
          id: evtRecord.id as string | number,
          title: t("winnerDeclared"),
          details: `${formatAddress(winner)} • ${prize.toFixed(2)} ${t("tokenGas")} • #${round}`,
          date: parseEventDate(evtRecord.created_at),
        });
      });

      roundRes.forEach((evt: unknown) => {
        const evtRecord = evt as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const round = Number(values[0] || 0);
        const end = Number(values[1] || 0) * 1000;
        const endText = end ? new Intl.DateTimeFormat(undefined).format(new Date(end)) : t("notAvailable");
        items.push({
          id: evtRecord.id as string | number,
          title: t("roundStarted"),
          details: `#${round} • ${endText}`,
          date: parseEventDate(evtRecord.created_at),
        });
      });

      history.value = items.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e) {
      console.warn("[useLastSurvivor] loadHistory failed:", e instanceof Error ? e.message : String(e));
      history.value = [];
    }
  };

  const validateKeyCount = (count: string): string | null => {
    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) return t("invalidKeyCount");
    if (num > 1000) return t("maxKeyCountExceeded");
    return null;
  };

  const loadAll = async () => {
    isLoading.value = true;
    try {
      const remainingSeconds = await loadRoundData();
      const endTimeMs = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
      endTime.value = endTimeMs;
      await loadUserKeys();
      await loadHistory();
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions ────────────────────────────────────────────────────────

  const buyKeys = async (count: string) => {
    if (isBuyingKeys.value) return;
    const validation = validateKeyCount(count);
    if (validation) {
      keyValidationError.value = validation;
      throw new Error(validation);
    }
    keyValidationError.value = null;
    const numKeys = Math.max(0, Math.floor(Number(count) || 0));
    if (numKeys <= 0) throw new Error(t("error"));

    isBuyingKeys.value = true;
    try {
      await chain.ensureWallet();
      const costRaw = calculateKeyCostFormula(BigInt(numKeys), totalKeysInRound.value);

      // Step 1: Transfer GAS to the contract
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: costRaw.toString() },
          { type: "String", value: `${APP_ID}:buy:${roundId.value}:${numKeys}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_TRANSFER_MS));

      // Step 2: Call buyKeysWithCost
      await chain.invoke("buyKeysWithCost", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: numKeys },
        { type: "Integer", value: costRaw.toString() },
      ]);

      eventBus.emit("keys:purchased", { action: t("keysPurchased") });
      await loadAll();
      return numKeys;
    } catch (e) {
      eventBus.emit("keys:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isBuyingKeys.value = false;
    }
  };

  const claimPrize = async () => {
    if (isClaiming.value) return;
    isClaiming.value = true;
    try {
      await chain.ensureWallet();
      await chain.invoke("checkAndEndRound", []);

      eventBus.emit("prize:claimed", { action: t("prizeClaimed") });
      await loadAll();
    } catch (e) {
      eventBus.emit("prize:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isClaiming.value = false;
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    roundId,
    totalPot,
    isRoundActive,
    lastBuyer,
    userKeys,
    keyCount,
    keyValidationError,
    history,
    isBuyingKeys,
    isClaiming,
    isLoading,

    // ── Timer State ─────────────────────────────────────────────────
    countdown,
    dangerLevel,
    dangerLevelText,
    dangerProgress,
    shouldPulse,
    timeRemainingSeconds,
    updateNow,

    // ── Formatted values ────────────────────────────────────────────
    lastBuyerLabel,
    formattedRound,
    totalPotDisplay,
    roundStatusDisplay,
    canClaim,
    estimatedCost,
    estimatedCostRaw,

    // ── Actions ─────────────────────────────────────────────────────
    buyKeys,
    claimPrize,
    loadAll,
    loadUserKeys,
  };
}

export type UseLastSurvivorReturn = ReturnType<typeof useLastSurvivor>;
