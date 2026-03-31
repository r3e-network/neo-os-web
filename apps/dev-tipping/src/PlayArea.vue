<template>
  <div class="dev-tipping-play-area">
    <!-- Hero -->
    <div class="hero-container">
      <HeroSection variant="erobo" icon="coffee" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStatsItems" />
        </template>
      </HeroSection>
    </div>

    <!-- Tip List -->
    <TipList :developers="developers" :formatNum="formatNum" @select="handleSelectDev" />

    <!-- Operation Panel Inline: Tip Form -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, HeroStatsStrip } from "@shared/components";
import type { HeroStatsStripItem } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import TipList from "./components/TipList.vue";
import TipForm from "./components/TipForm.vue";
import type { Developer } from "./composables/useDevTippingStats";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const formatNum = (n: number | string) => formatNumber(n, 2);

const developers = computed(() => (props.state.developers?.value ?? []) as Developer[]);
const totalDonated = computed(() => Number(props.state.totalDonated?.value ?? 0));
const recentTips = computed(() => (props.state.recentTips?.value ?? []) as Array<Record<string, unknown>>);
const isLoading = computed(() => Boolean(props.state.isLoading?.value ?? false));

const selectedDevId = ref<number | null>(null);
const tipAmount = ref("");
const tipMessage = ref("");
const tipperName = ref("");
const anonymous = ref(false);

const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { label: t("totalDonated"), value: formatNum(totalDonated.value) },
  { label: t("recentTips"), value: recentTips.value.length },
]);

const handleSelectDev = (dev: Developer) => {
  selectedDevId.value = dev.id;
  const handler = actions.get("selectDev");
  if (handler) handler(dev);
};

const handleSendTip = async () => {
  if (!selectedDevId.value) return;
  const handler = actions.get("sendTip");
  if (handler) {
    await handler(selectedDevId.value, tipAmount.value, tipMessage.value, tipperName.value, anonymous.value);
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./pages/index/dev-tipping-theme.scss" as *;

@include page-background(var(--bg-primary));

.dev-tipping-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.hero-container {
  background: radial-gradient(ellipse at center, rgba(210, 160, 60, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

:deep(.hero-stats-strip__item) {
  --hero-stat-bg: rgba(159, 157, 243, 0.08);
  --hero-stat-border: rgba(159, 157, 243, 0.15);
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

@keyframes steam-rise {
  0% { transform: translateY(0) scale(1); opacity: 0.6; }
  50% { transform: translateY(-6px) scale(1.1); opacity: 0.9; }
  100% { transform: translateY(-12px) scale(0.8); opacity: 0; }
}

@keyframes coin-sparkle {
  0%, 100% {
    box-shadow: 0 0 10px rgba(210, 160, 60, 0.1), 0 0 20px rgba(210, 160, 60, 0.05);
  }
  50% {
    box-shadow: 0 0 18px rgba(210, 160, 60, 0.25), 0 0 35px rgba(210, 160, 60, 0.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.hero-icon)::before,
  :deep(.hero-icon)::after {
    animation: none;
  }
}
</style>
