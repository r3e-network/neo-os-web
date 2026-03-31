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

.gas-sponsor-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.hero-container {
  background: radial-gradient(ellipse at center, rgba(0, 229, 153, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

:deep(.hero-stats-strip__item) {
  --hero-stat-bg: rgba(0, 229, 153, 0.08);
  --hero-stat-border: rgba(0, 229, 153, 0.15);
}

@keyframes fuel-gauge-fill {
  0% {
    background-size: 0% 100%;
  }
  50% {
    background-size: 100% 100%;
  }
  100% {
    background-size: 0% 100%;
  }
}

@keyframes tank-glow {
  0%,
  100% {
    box-shadow:
      0 0 12px rgba(0, 229, 153, 0.1),
      0 0 24px rgba(0, 229, 153, 0.05);
  }
  50% {
    box-shadow:
      0 0 22px rgba(0, 229, 153, 0.25),
      0 0 44px rgba(0, 229, 153, 0.1);
  }
}

@keyframes gauge-needle {
  0%,
  100% {
    transform: rotate(-20deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-stat,
  .hero-stat-icon {
    animation: none;
  }
}

.hero-stat {
  animation: tank-glow 4s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(0, 180, 120, 0.06) 100%);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 24px rgba(0, 229, 153, 0.3);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.6s;
}

.hero-stat-icon {
  animation: gauge-needle 5s ease-in-out infinite;
  display: inline-block;
  transform-origin: center bottom;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(0, 229, 153, 0.3);
}
</style>
