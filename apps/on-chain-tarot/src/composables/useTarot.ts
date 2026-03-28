/**
 * useTarot -- Domain logic for On-Chain Tarot
 *
 * Receives ChainService + EventBus from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { parseStackItem } from "@shared/utils/neo";
import { toFixed8 } from "@shared/utils/format";
import { pollForEvent } from "@shared/utils/errorHandling";
import { waitForListedEventByTransaction } from "@shared/utils";
import type { Card } from "../pages/index/components/TarotCard.vue";
import { TAROT_DECK } from "../pages/index/components/tarot-data";

export interface UseTarotOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const APP_ID = "miniapp-onchaintarot";

export function useTarot({ chain, eventBus, t }: UseTarotOptions) {
  const tarotDeck = TAROT_DECK;
  const drawn = ref<Card[]>([]);
  const hasDrawn = computed(() => drawn.value.length === 3);
  const allFlipped = computed(() => drawn.value.every((c) => c.flipped));
  const readingsCount = ref(0);
  const question = ref("");
  const isLoading = ref(false);

  const listEventRecords = async (eventName: string) => {
    return (await chain.listAllEvents(eventName)) as Record<string, unknown>[];
  };

  const waitForEventByTx = async (tx: unknown, eventName: string) => {
    return waitForListedEventByTransaction(tx, {
      listEvents: async () => listEventRecords(eventName),
      timeoutMs: 30000,
      pollIntervalMs: 1500,
      errorMessage: t("readingPending"),
    });
  };

  const waitForReading = async (readingId: string) => {
    return pollForEvent(
      async () => listEventRecords("ReadingCompleted"),
      (evt: Record<string, unknown>) => {
        const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
        return String(values[0] ?? "") === String(readingId);
      },
      {
        timeoutMs: 45000,
        pollIntervalMs: 1500,
        errorMessage: t("readingPending"),
      },
    );
  };

  const draw = async () => {
    if (isLoading.value) return;
    isLoading.value = true;

    const walletAddress = await chain.ensureWallet();

    const prompt = question.value.trim() || t("defaultQuestion");
    // Contract signature: RequestReading(user, question, spreadType, category)
    const result = await chain.invokeWithPayment(
      toFixed8("0.1"),
      `${APP_ID}:reading:${Date.now()}`,
      "requestReading",
      [
        { type: "Hash160", value: walletAddress },
        { type: "String", value: prompt.slice(0, 200) },
        { type: "Integer", value: "2" }, // spreadType: 2 = three-card
        { type: "Integer", value: "1" }, // category: 1 = general/default
      ],
    );
    const requestedEvt = await waitForEventByTx(result.txid, "ReadingRequested");
    if (!requestedEvt) throw new Error(t("readingPending"));
    const requestedRecord = requestedEvt as unknown as Record<string, unknown>;
    const requestedValues = Array.isArray(requestedRecord?.state)
      ? (requestedRecord.state as unknown[]).map(parseStackItem)
      : [];
    const readingId = String(requestedValues[0] ?? "");
    if (!readingId) throw new Error(t("readingPending"));

    const completedEvt = await waitForReading(readingId);
    if (!completedEvt) throw new Error(t("readingPending"));
    const completedRecord = completedEvt as unknown as Record<string, unknown>;
    const values = Array.isArray(completedRecord?.state)
      ? (completedRecord.state as unknown[]).map(parseStackItem)
      : [];
    const cards = Array.isArray(values[2]) ? values[2].map((v) => Number(v)) : [];
    drawn.value = cards.map((cardId: number) => {
      const card = tarotDeck.find((item) => item.id === cardId);
      if (!card) {
        return { id: cardId, name: `Card ${cardId}`, icon: "\uD83C\uDCA0", flipped: false };
      }
      return { ...card, flipped: false };
    });
    readingsCount.value += 1;
    question.value = "";
    isLoading.value = false;
    return { success: true };
  };

  const flipCard = (index: number) => {
    if (drawn.value[index]) {
      drawn.value[index].flipped = true;
    }
  };

  const reset = () => {
    drawn.value = [];
  };

  const getReading = () => {
    if (drawn.value.length !== 3) return t("readingText");
    const [past, present, future] = drawn.value;
    return `${t("past")}: ${past.name} \u00B7 ${t("present")}: ${present.name} \u00B7 ${t("future")}: ${future.name}`;
  };

  const loadReadingCount = async () => {
    try {
      readingsCount.value = (await listEventRecords("ReadingCompleted")).length;
    } catch (_e: unknown) {
      console.warn("[on-chain-tarot] reading count load failed:", _e instanceof Error ? _e.message : String(_e));
      readingsCount.value = Math.max(readingsCount.value, 0);
    }
  };

  const loadAll = async () => {
    await loadReadingCount();
  };

  return {
    // State
    drawn,
    hasDrawn,
    allFlipped,
    readingsCount,
    question,
    isLoading,

    // Actions
    draw,
    flipCard,
    reset,
    getReading,
    loadReadingCount,
    loadAll,
  };
}

export type UseTarotReturn = ReturnType<typeof useTarot>;
