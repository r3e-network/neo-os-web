<template>
  <div class="gas-sponsor-play-area">
    <!-- ── Hero Section ── -->
    <div class="hero-container">
      <HeroSection variant="erobo-neo" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStatsItems" />
        </template>
      </HeroSection>
    </div>

    <!-- ── Gas Tank Visualization ── -->
    <GasTank :fuel-level-percent="fuelLevelPercent" :gas-balance="gasBalance" :is-eligible="isEligible" />

    <!-- ── Request Sponsored Gas ── -->
    <RequestGasCard
      :is-eligible="isEligible"
      :remaining-quota="remainingQuota"
      v-model:requestAmount="requestAmount"
      :max-request-amount="maxRequestAmount"
      :is-requesting="isRequesting"
      :quick-amounts="quickAmounts"
      @request="handleRequestSponsorship"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The custom play area for Gas Sponsor
 *
 * Renders the hero stats, gas tank visualization, and request form.
 * Everything else (sidebar, stats, donate/send/stats tabs, docs, shell chrome)
 * is rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, HeroStatsStrip } from "@shared/components";
import type { HeroStatsStripItem } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import GasTank from "./pages/index/components/GasTank.vue";
import RequestGasCard from "./pages/index/components/RequestGasCard.vue";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const gasBalance = computed(() => String(props.state.gasBalance?.value ?? "0"));
const isEligible = computed(() => Boolean(props.state.isEligible?.value ?? false));
const fuelLevelPercent = computed(() => Number(props.state.fuelLevelPercent?.value ?? 0));
const remainingQuota = computed(() => Number(props.state.remainingQuota?.value ?? 0));
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));
const requestAmount = computed({
  get: () => String(props.state.requestAmount?.value ?? "0.01"),
  set: (val: string) => {
    if (props.state.requestAmount) {
      (props.state.requestAmount as Ref<string>).value = val;
    }
  },
});
const maxRequestAmount = computed(() => Number(props.state.maxRequestAmount?.value ?? 0.1));
const quickAmounts = computed(() => {
  const raw = props.state.quickAmounts?.value;
  return Array.isArray(raw) ? raw as number[] : [0.005, 0.01, 0.02, 0.05];
});

const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { icon: "\u26FD", value: `${Math.round(fuelLevelPercent.value)}%`, label: t("sidebarTankLevel") },
  { icon: "\uD83D\uDCB0", value: gasBalance.value, label: t("gasBalance") },
]);

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleRequestSponsorship = async () => {
  const handler = actions.get("requestSponsorship");
  if (handler) await handler(requestAmount.value);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./pages/index/gas-sponsor-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,500;0,600;0,700;0,800;1,400&display=swap');

.gas-sponsor-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Inter Tight', 'Inter', sans-serif;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(148, 163, 184, 0.04) 50%, rgba(37, 99, 235, 0.06) 100%);
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 20px;
  padding: 4px;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.4s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #2563EB, transparent);
    opacity: 0.5;
  }

  &::after {
    content: '';
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 120px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%);
    pointer-events: none;
  }
}

:deep(.hero-stats-strip__item) {
  --hero-stat-bg: rgba(37, 99, 235, 0.08);
  --hero-stat-border: rgba(37, 99, 235, 0.18);
  font-family: 'Inter Tight', 'Inter', sans-serif;
  border-radius: 14px;
  transition: all 0.3s ease;

  &:hover {
    --hero-stat-bg: rgba(37, 99, 235, 0.12);
    --hero-stat-border: rgba(37, 99, 235, 0.28);
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.12);
    transform: translateY(-1px);
  }
}

:deep(.neo-card) {
  font-family: 'Inter Tight', 'Inter', sans-serif;
  border-radius: 16px;
  border: 1px solid rgba(37, 99, 235, 0.15);
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(37, 99, 235, 0.25);
    box-shadow: 0 12px 40px rgba(37, 99, 235, 0.08);
  }
}

:deep(.neo-btn--primary) {
  font-family: 'Inter Tight', 'Inter', sans-serif;
  background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%);
  color: #fff;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.3);
  letter-spacing: 0.02em;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 8px 28px rgba(37, 99, 235, 0.4);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--secondary) {
  font-family: 'Inter Tight', 'Inter', sans-serif;
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94A3B8;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.1);
    border-color: rgba(37, 99, 235, 0.3);
    color: #3B82F6;
  }
}

@keyframes shield-shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-container::before,
  .hero-container::after {
    animation: none;
  }
  :deep(.hero-stats-strip__item):hover,
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
