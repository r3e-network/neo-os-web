<template>
  <view class="theme-on-chain-tarot">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Game Tab (default) -->
      <template #content>
        <view class="mystical-bg">
          <!-- Mystical Background Decorations -->
          <view class="cosmic-stars">
            <text class="star star-1">✨</text>
            <text class="star star-2">⭐</text>
            <text class="star star-3">✨</text>
            <text class="star star-4">⭐</text>
            <text class="moon-decoration">🌙</text>
          </view>

          <AppStatus :status="status" />

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
        </view>
      </template>

      <!-- Stats Tab -->
      <template #tab-stats>
        <StatisticsTab :readings-count="readingsCount" :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseStackItem } from "@shared/utils/neo";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

import AppStatus from "./components/AppStatus.vue";
import GameArea from "./components/GameArea.vue";
import ReadingDisplay from "./components/ReadingDisplay.vue";
import StatisticsTab from "./components/StatisticsTab.vue";
import type { Card } from "./components/TarotCard.vue";
import { TAROT_DECK } from "./components/tarot-data";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "game-board",
  tabs: [
    { key: "game", labelKey: "game", icon: "🎴", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};
const activeTab = ref("game");
const appState = computed(() => ({
  readingsCount: readingsCount.value,
  hasDrawn: hasDrawn.value,
}));
const sidebarItems = computed(() => [
  { label: t("readings"), value: readingsCount.value },
  { label: t("cardsDrawn"), value: drawn.value.length },
  { label: t("allRevealed"), value: allFlipped.value ? t("yes") : t("no") },
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./on-chain-tarot-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.tab-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: transparent;
}

.mystical-bg {
  min-height: 100vh;
  position: relative;
  background: radial-gradient(circle at 50% 20%, var(--tarot-bg-top) 0%, var(--tarot-bg-bottom) 100%);
  background-attachment: fixed;
}

.cosmic-stars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  opacity: 0.6;
  overflow: hidden;
  z-index: 0;
}

.star {
  position: absolute;
  font-size: 20px; /* Smaller, more subtle stars */
  color: var(--tarot-star-text);
  text-shadow:
    0 0 5px var(--tarot-star-glow),
    0 0 10px var(--tarot-accent);
  animation: twinkle 4s infinite ease-in-out;
}
.star-1 {
  top: 10%;
  left: 15%;
  animation-delay: 0s;
  font-size: 16px;
}
.star-2 {
  top: 25%;
  right: 20%;
  animation-delay: 1.2s;
  font-size: 12px;
}
.star-3 {
  bottom: 15%;
  left: 10%;
  animation-delay: 2.5s;
  font-size: 14px;
}
.star-4 {
  bottom: 30%;
  right: 10%;
  animation-delay: 3.8s;
  font-size: 18px;
}

.moon-decoration {
  position: absolute;
  top: 40px;
  right: 20px;
  font-size: 80px;
  filter: drop-shadow(0 0 30px var(--tarot-moon-glow));
  opacity: 0.8;
  animation: float 6s ease-in-out infinite;
  z-index: 0;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}


/* Enhancing components for Mystical Feel */
:deep(.neo-card) {
  background: var(--tarot-card-bg) !important;
  border: 1px solid var(--tarot-card-border) !important;
  backdrop-filter: blur(12px) !important;
  box-shadow: var(--tarot-card-shadow) !important;
  color: var(--tarot-card-text) !important;
}

:deep(.neo-card .text-white) {
  color: var(--tarot-card-text) !important;
}

:deep(.neo-button) {
  background: var(--tarot-button-bg) !important;
  border: 1px solid var(--tarot-button-border) !important;
  color: var(--tarot-button-text) !important;
  box-shadow: 0 0 15px var(--tarot-moon-glow) !important;

  &:active {
    transform: scale(0.98);
  }
}

// Desktop sidebar
</style>
