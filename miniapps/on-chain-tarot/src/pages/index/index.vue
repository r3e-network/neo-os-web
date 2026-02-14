<template>
  <view class="theme-on-chain-tarot">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
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

          <ReadingDisplay v-if="hasDrawn && allFlipped" :reading="getReading()" />
        
      </template>

      <!-- RIGHT panel: Actions -->
      <template #operation>
        <MiniAppOperationStats :stats="tarotStats" stats-position="bottom">
          <view class="action-buttons">
            <NeoButton variant="primary" size="lg" block :loading="isLoading" :disabled="hasDrawn" @click="draw">
              {{ t("drawingCards") }}
            </NeoButton>
            <NeoButton v-if="hasDrawn" variant="secondary" size="lg" block @click="reset">
              {{ t("reset") }}
            </NeoButton>
          </view>
        </MiniAppOperationStats>
      </template>

      <!-- Stats Tab -->
      <template #tab-stats>
        <StatisticsTab :readings-count="readingsCount" :t="t" />
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { parseStackItem } from "@shared/utils/neo";
import { MiniAppShell, MiniAppOperationStats, NeoButton } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createPrimaryStatsTemplateConfig, createSidebarItems } from "@shared/utils";

import GameArea from "./components/GameArea.vue";
import ReadingDisplay from "./components/ReadingDisplay.vue";
import StatisticsTab from "./components/StatisticsTab.vue";
import type { Card } from "./components/TarotCard.vue";
import { TAROT_DECK } from "./components/tarot-data";

const { t } = createUseI18n(messages)();

const templateConfig = createPrimaryStatsTemplateConfig({ key: "game", labelKey: "game", icon: "🎴", default: true });
const activeTab = ref("game");
const appState = computed(() => ({
  readingsCount: readingsCount.value,
  hasDrawn: hasDrawn.value,
}));
const sidebarItems = createSidebarItems(t, [
  { labelKey: "readings", value: () => readingsCount.value },
  { labelKey: "cardsDrawn", value: () => drawn.value.length },
  { labelKey: "allRevealed", value: () => (allFlipped.value ? t("yes") : t("no")) },
]);

const APP_ID = "miniapp-onchaintarot";
const { address, connect, invokeContract } = useWallet() as WalletSDK;
const { processPayment, isLoading } = usePaymentFlow(APP_ID);
const { list: listEvents } = useEvents();
const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);

// Use the imported full deck
const tarotDeck = TAROT_DECK;

const drawn = ref<Card[]>([]);
const { status, setStatus, clearStatus } = useStatusMessage();
const hasDrawn = computed(() => drawn.value.length === 3);
const allFlipped = computed(() => drawn.value.every((c) => c.flipped));
const readingsCount = ref(0);
const question = ref("");

const tarotStats = computed(() => [
  { label: t("readings"), value: readingsCount.value },
  { label: t("cardsDrawn"), value: drawn.value.length },
]);
const pollingTimers: ReturnType<typeof setTimeout>[] = [];

const waitForEvent = async (txid: string, eventName: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
    const match = res.events.find((evt) => evt.tx_hash === txid);
    if (match) return match;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      pollingTimers.push(timer);
    });
  }
  return null;
};

const waitForReading = async (readingId: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const res = await listEvents({ app_id: APP_ID, event_name: "ReadingCompleted", limit: 25 });
    const match = res.events.find((evt) => {
      const evtRecord = evt as unknown as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      return String(values[0] ?? "") === String(readingId);
    });
    if (match) return match;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      pollingTimers.push(timer);
    });
  }
  return null;
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

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || ""
    );
    const requestedEvt = txid ? await waitForEvent(txid, "ReadingRequested") : null;
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

onUnmounted(() => {
  pollingTimers.forEach((timer) => clearTimeout(timer));
  pollingTimers.length = 0;
});

const { handleBoundaryError } = useHandleBoundaryError("on-chain-tarot");
const resetAndReload = async () => {
  await loadReadingCount();
};
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
