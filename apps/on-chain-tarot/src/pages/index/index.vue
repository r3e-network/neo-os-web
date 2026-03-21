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
      <div class="hero-container">
        <HeroSection variant="erobo" compact>
          <template #background>
            <div class="tarot-scene" aria-hidden="true">
              <div class="tarot-card-back" :class="{ 'tarot-card-back--drawn': hasDrawn }">
                <div class="tarot-card-inner">
                  <span class="tarot-symbol">✦</span>
                </div>
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ readingsCount }}</span>
                <span class="hero-stat-label">{{ t("readings") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ drawn.length }}</span>
                <span class="hero-stat-label">{{ t("cardsDrawnCount") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

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
      <NeoCard variant="erobo" :title="t('drawYourCards')">
        <div class="action-buttons">
          <NeoButton variant="primary" size="lg" block :loading="isLoading" :disabled="hasDrawn" @click="draw">
            {{ t("drawingCards") }}
          </NeoButton>
          <NeoButton v-if="hasDrawn" variant="secondary" size="lg" block @click="reset">
            {{ t("reset") }}
          </NeoButton>
        </div>
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
import { useWallet, useEvents } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { messages } from "@/locale/messages";
import { parseStackItem } from "@shared/utils/neo";
import { MiniAppPage, HeroSection } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { pollForEvent } from "@shared/utils/errorHandling";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { waitForListedEventByTransaction } from "@shared/utils";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

import GameArea from "./components/GameArea.vue";
import ReadingDisplay from "./components/ReadingDisplay.vue";
import type { Card } from "./components/TarotCard.vue";
import { TAROT_DECK } from "./components/tarot-data";

const APP_ID = "miniapp-onchaintarot";
const { address, connect, invokeContract } = useWallet() as WalletSDK;
const { list: listEvents } = useEvents();
const isLoading = ref(false);

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
    },
  );
};

const draw = async () => {
  if (isLoading.value) return;
  try {
    isLoading.value = true;
    setStatus(t("drawingCards"), "loading");
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    const contract = await ensureContractAddress();
    const readingFee = "0.1";
    const readingFeeFixed8 = String(Math.round(Number.parseFloat(readingFee) * 1e8));

    await invokeContract({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: contract },
        { type: "Integer", value: readingFeeFixed8 },
        { type: "String", value: `${APP_ID}:reading:${Date.now()}` },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 4000));

    const prompt = question.value.trim() || t("defaultQuestion");
    // Contract signature: RequestReading(user, question, spreadType, category)
    const tx = await invokeContract({
      scriptHash: contract,
      operation: "requestReading",
      args: [
        { type: "Hash160", value: address.value },
        { type: "String", value: prompt.slice(0, 200) },
        { type: "Integer", value: "2" }, // spreadType: 2 = three-card
        { type: "Integer", value: "1" }, // category: 1 = general/default
      ],
    });
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
  } finally {
    isLoading.value = false;
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
  } catch (_e: unknown) {
    // non-critical: reading count is cosmetic
    readingsCount.value = Math.max(readingsCount.value, 0);
  }
};

onMounted(async () => {
  try {
    await loadReadingCount();
  } catch (_e: unknown) {
    /* non-critical: initial data load */
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./on-chain-tarot-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.hero-container {
  margin-bottom: 20px;
}

.tarot-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}

.tarot-card-back {
  width: 55px;
  height: 80px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2a1f5e, #4a2f8e);
  border: 2px solid rgba(159, 157, 243, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.6s;
  box-shadow: 0 0 20px rgba(159, 157, 243, 0.2);
}

.tarot-card-back--drawn {
  transform: rotateY(180deg);
}

.tarot-card-inner {
  background: repeating-conic-gradient(rgba(159, 157, 243, 0.1) 0% 25%, transparent 0% 50%) 50% / 10px 10px;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tarot-symbol {
  font-size: 20px;
  color: rgba(159, 157, 243, 0.6);
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── On-Chain Tarot Hero Enhancements: Mystical Cards ── */
@keyframes card-hover-float {
  0%,
  100% {
    transform: rotateY(0deg) translateY(0);
  }
  25% {
    transform: rotateY(5deg) translateY(-4px);
  }
  75% {
    transform: rotateY(-5deg) translateY(-4px);
  }
}
@keyframes starfield-twinkle {
  0%,
  100% {
    opacity: 0.3;
    box-shadow: 0 0 4px rgba(159, 157, 243, 0.3);
  }
  50% {
    opacity: 1;
    box-shadow:
      0 0 12px rgba(159, 157, 243, 0.7),
      0 0 24px rgba(159, 157, 243, 0.2);
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 30%, rgba(159, 157, 243, 0.1) 0%, transparent 55%);
}
.tarot-card-back {
  animation: card-hover-float 5s ease-in-out infinite;
  box-shadow:
    0 0 20px rgba(159, 157, 243, 0.25),
    0 0 40px rgba(159, 157, 243, 0.08);
}
.tarot-symbol {
  animation: starfield-twinkle 3s ease-in-out infinite;
}
.hero-stats {
  box-shadow: 0 4px 20px rgba(159, 157, 243, 0.12);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(159, 157, 243, 0.3);
    transform: translateY(-2px);
  }
}
.hero-stat {
  box-shadow: inset 0 1px 0 rgba(159, 157, 243, 0.08);
  background: linear-gradient(180deg, rgba(159, 157, 243, 0.06), transparent);
}
.tarot-scene {
  background: linear-gradient(180deg, rgba(42, 31, 94, 0.3), transparent);
}
</style>
