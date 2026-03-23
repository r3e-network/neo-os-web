<template>
  <MiniAppPage
    name="dev-tipping"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="refreshData"
  >
    <!-- Main Tab — LEFT panel -->
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo" icon="coffee" compact>
          <template #stats>
            <HeroStatsStrip :items="heroStatsItems" />
          </template>
        </HeroSection>
      </div>

      <TipList :developers="developers" :formatNum="formatNum" @select="handleSelectDev" />
    </template>

    <!-- Main Tab — RIGHT panel -->
    <template #operation>
      <TipForm
        :developers="developers"
        v-model="selectedDevId"
        v-model:amount="tipAmount"
        v-model:message="tipMessage"
        v-model:tipperName="tipperName"
        v-model:anonymous="anonymous"
        :isLoading="isLoading"
        @submit="handleSendTip"
      />
    </template>

    <template #tab-stats>
      <WalletInfo :totalDonated="totalDonated" :recentTips="recentTips" :formatNum="formatNum" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppPage, HeroSection, HeroStatsStrip } from "@shared/components";
import type { HeroStatsStripItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useDevTippingStats } from "@/composables/useDevTippingStats";
import type { Developer } from "@/composables/useDevTippingStats";
import { useDevTippingWallet } from "@/composables/useDevTippingWallet";
import TipList from "@/components/TipList.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "dev-tipping",
  messages,
  template: {
    tabs: [
      { key: "send", labelKey: "sendTip", icon: "💰", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "developers", value: () => developers.value.length },
    { labelKey: "totalDonated", value: () => formatNum(totalDonated.value) },
    { labelKey: "recentTips", value: () => recentTips.value.length },
  ],
});
const APP_ID = "miniapp-dev-tipping";

const { developers, recentTips, totalDonated, formatNum, loadDevelopers, loadRecentTips } = useDevTippingStats();
const { address, isLoading, status, setStatus, sendTip } = useDevTippingWallet(APP_ID);

const appState = computed(() => ({
  totalDonated: totalDonated.value,
  developerCount: developers.value.length,
}));
const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { label: t("totalDonated"), value: formatNum(totalDonated.value) },
  { label: t("recentTips"), value: recentTips.value.length },
]);

const selectedDevId = ref<number | null>(null);
const tipAmount = ref("");
const tipMessage = ref("");
const tipperName = ref("");
const anonymous = ref(false);

const refreshData = async () => {
  await loadDevelopers();
  await loadRecentTips(APP_ID);
};

const handleSelectDev = (dev: Developer) => {
  selectedDevId.value = dev.id;
  setStatus(`${t("selected")} ${dev.name}`, "success");
};

const handleSendTip = async () => {
  if (!selectedDevId.value) return;
  await sendTip(selectedDevId.value, tipAmount.value, tipMessage.value, tipperName.value, anonymous.value);
};

onMounted(() => {
  refreshData().catch((e: unknown) => { console.warn("[dev-tipping] refreshData failed:", e instanceof Error ? e.message : String(e)); });
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./dev-tipping-theme.scss" as *;

@include page-background(var(--bg-primary));

.hero-container {
  margin-bottom: 20px;
}

:deep(.hero-stats-strip__item) {
  --hero-stat-bg: rgba(159, 157, 243, 0.08);
  --hero-stat-border: rgba(159, 157, 243, 0.15);
}

/* ── Dev Tipping Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(210, 160, 60, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes steam-rise {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-6px) scale(1.1);
    opacity: 0.9;
  }
  100% {
    transform: translateY(-12px) scale(0.8);
    opacity: 0;
  }
}

@keyframes coin-sparkle {
  0%,
  100% {
    box-shadow:
      0 0 10px rgba(210, 160, 60, 0.1),
      0 0 20px rgba(210, 160, 60, 0.05);
  }
  50% {
    box-shadow:
      0 0 18px rgba(210, 160, 60, 0.25),
      0 0 35px rgba(210, 160, 60, 0.1);
  }
}

@keyframes warm-breathe {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-stat {
    animation: none;
  }
  :deep(.hero-icon)::before,
  :deep(.hero-icon)::after {
    animation: none;
  }
}

:deep(.hero-icon) {
  position: relative;

  &::before,
  &::after {
    content: "~";
    position: absolute;
    font-size: 10px;
    color: rgba(210, 160, 60, 0.5);
    animation: steam-rise 2s ease-out infinite;
  }

  &::before {
    top: -4px;
    left: 30%;
    animation-delay: 0s;
  }

  &::after {
    top: -4px;
    left: 60%;
    animation-delay: 0.7s;
  }
}

.hero-stat {
  background: linear-gradient(135deg, rgba(210, 160, 60, 0.1) 0%, rgba(180, 120, 30, 0.06) 100%);
  border: 1px solid rgba(210, 160, 60, 0.15);
  animation: coin-sparkle 3.5s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 22px rgba(210, 160, 60, 0.3);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.6s;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(210, 160, 60, 0.3);
}
</style>
