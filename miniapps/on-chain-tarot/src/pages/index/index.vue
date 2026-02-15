<template>
  <MiniAppPage
    name="on-chain-tarot"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadReadingCount"
  >
    <!-- Game Tab (default) — LEFT panel -->
    <template #content>
      <GameArea
        v-model:question="question"
        :drawn="drawn"
        :has-drawn="hasDrawn"
        :is-loading="isLoading"
        :t="t"
        @draw="draw"
        @reset="reset"
        @flip="flipCard"
      />

      <ReadingDisplay v-if="hasDrawn && allFlipped" :reading="getReading()" role="status" aria-live="polite" />
    </template>

    <!-- RIGHT panel: Actions -->
    <template #operation>
      <NeoCard>
        <view class="action-buttons">
          <NeoButton variant="primary" size="lg" block :loading="isLoading" :disabled="hasDrawn" @click="draw">
            {{ t("drawingCards") }}
          </NeoButton>
          <NeoButton v-if="hasDrawn" variant="secondary" size="lg" block @click="reset">
            {{ t("reset") }}
          </NeoButton>
        </view>
        <StatsDisplay :items="tarotStats" layout="rows" />
      </NeoCard>
    </template>

    <!-- Stats Tab -->
    <template #tab-stats>
      <StatisticsTab :readings-count="readingsCount" :t="t" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { messages } from "@/locale/messages";
import { parseStackItem } from "@shared/utils/neo";
import { MiniAppPage } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { formatErrorMessage, pollForEvent } from "@shared/utils/errorHandling";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { waitForListedEventByTransaction } from "@shared/utils";

import GameArea from "./components/GameArea.vue";
import ReadingDisplay from "./components/ReadingDisplay.vue";
import type { Card } from "./components/TarotCard.vue";
import { TAROT_DECK } from "./components/tarot-data";

const APP_ID = "miniapp-onchaintarot";
const { address, connect } = useWallet() as WalletSDK;
const { processPayment, isLoading } = usePaymentFlow(APP_ID);
const { list: listEvents } = useEvents();

// Use the imported full deck
const tarotDeck = TAROT_DECK;

const drawn = ref<Card[]>([]);
const hasDrawn = computed(() => drawn.value.length === 3);
const allFlipped = computed(() => drawn.value.every((c) => c.flipped));
const readingsCount = ref(0);
const question = ref("");

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "on-chain-tarot",
  messages,
  template: {
    tabs: [
      { key: "game", labelKey: "game", icon: "🎴", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
  },
  sidebarItems: [
    { labelKey: "readings", value: () => readingsCount.value },
    { labelKey: "cardsDrawnCount", value: () => drawn.value.length },
    { labelKey: "allRevealed", value: () => (allFlipped.value ? t("yes") : t("no")) },
  ],
});

const { ensure: ensureContractAddress } = useContractAddress(t);

const appState = computed(() => ({
  readingsCount: readingsCount.value,
  hasDrawn: hasDrawn.value,
}));
const waitForEventByTx = async (tx: unknown, eventName: string) => {
  return waitForListedEventByTransaction(tx, {
    listEvents: async () => {
      const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
      return res.events || [];
    },
    timeoutMs: 30000,
    pollIntervalMs: 1500,
    errorMessage: t("readingPending"),
  });
};

const waitForReading = async (readingId: string) => {
  return pollForEvent(
    async () => {
      const res = await listEvents({ app_id: APP_ID, event_name: "ReadingCompleted", limit: 25 });
      return res.events || [];
    },
    (evt: Record<string, unknown>) => {
      const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
      return String(values[0] ?? "") === String(readingId);
    },
    {
      timeoutMs: 45000,
      pollIntervalMs: 1500,
      errorMessage: t("readingPending"),
    }
  );
};

const draw = async () => {
  if (isLoading.value) return;
  try {
    setStatus(t("drawingCards"), "loading");
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    const contract = await ensureContractAddress();

    const { receiptId, invoke } = await processPayment("0.05", `tarot:${Date.now()}`);

    const prompt = question.value.trim() || t("defaultQuestion");
    // Contract signature: RequestReading(user, question, spreadType, category, receiptId)
    const tx = await invoke(
      "requestReading",
      [
        { type: "Hash160", value: address.value },
        { type: "String", value: prompt.slice(0, 200) },
        { type: "Integer", value: "0" }, // spreadType: 0 = single card
        { type: "Integer", value: "0" }, // category: 0 = general
        { type: "Integer", value: receiptId },
      ],
      contract
    );
    const requestedEvt = await waitForEventByTx(tx, "ReadingRequested");
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
        return { id: cardId, name: `Card ${cardId}`, icon: "🂠", flipped: false };
      }
      return { ...card, flipped: false };
    });
    readingsCount.value += 1;
    question.value = "";
    setStatus(t("cardsDrawn"), "success");
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const flipCard = (index: number) => {
  if (drawn.value[index]) {
    drawn.value[index].flipped = true;
  }
};

const reset = () => {
  drawn.value = [];
  clearStatus();
};

const getReading = () => {
  if (drawn.value.length !== 3) return t("readingText");
  const [past, present, future] = drawn.value;
  return `${t("past")}: ${past.name} · ${t("present")}: ${present.name} · ${t("future")}: ${future.name}`;
};

const loadReadingCount = async () => {
  try {
    const res = await listEvents({ app_id: APP_ID, event_name: "ReadingCompleted", limit: 50 });
    readingsCount.value = res.events.length;
  } catch (e: unknown) {
    /* non-critical: reading count is cosmetic */
    readingsCount.value = Math.max(readingsCount.value, 0);
  }
};

onMounted(async () => {
  await loadReadingCount();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./on-chain-tarot-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
