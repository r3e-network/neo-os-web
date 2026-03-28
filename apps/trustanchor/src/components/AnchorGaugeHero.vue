<template>
  <div class="hero-container">
    <span class="hero-label">{{ t("appName") }}</span>
    <span class="hero-description">{{ t("heroDescription") }}</span>

    <div class="hero-gauge" aria-hidden="true">
      <svg viewBox="0 0 200 120" class="gauge-svg">
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          stroke-width="12"
          stroke-linecap="round"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGrad)"
          stroke-width="12"
          stroke-linecap="round"
          :stroke-dasharray="gaugeCircumference"
          :stroke-dashoffset="gaugeOffset"
          class="gauge-fill"
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--trustanchor-emerald-light, #34d399)" />
            <stop offset="100%" stop-color="var(--trustanchor-emerald, #10b981)" />
          </linearGradient>
        </defs>
      </svg>
      <div class="gauge-center">
        <span class="gauge-value">{{ formatNum(totalStaked) }}</span>
        <span class="gauge-unit">{{ t("tokenNeo") }}</span>
      </div>
    </div>

    <HeroStatsStrip :items="heroStatsItems" compact />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HeroStatsStrip } from "@shared/components";
import type { HeroStatsStripItem } from "@shared/components";
import { formatNumber } from "@shared/utils/format";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  totalStaked: number;
  agentCount: number;
}>();

const formatNum = (n: number | string) => formatNumber(n, 2);

const GAUGE_ARC = Math.PI * 80;
const gaugeCircumference = GAUGE_ARC;
const MAX_STAKED = 10_000_000;

const gaugePercent = computed(() => Math.min(props.totalStaked / MAX_STAKED, 1));
const gaugeOffset = computed(() => GAUGE_ARC - gaugePercent.value * GAUGE_ARC);

const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { label: props.t("agentAccountsLabel"), value: props.agentCount, icon: "grid" },
  { label: props.t("defaultIngressLabel"), value: 21, icon: "arrow-down" },
  { label: props.t("noAgentContractsLabel"), value: 0, icon: "x" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/trustanchor-theme.scss" as *;

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(135deg, rgba(30, 58, 138, 0.12), rgba(17, 24, 39, 0.08), rgba(16, 185, 129, 0.06));
  background-size: 200% 200%;
  animation: anchor-deep-blue-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(30, 58, 138, 0.1),
    inset 0 1px 0 rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(30, 58, 138, 0.12);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-description {
  max-width: 700px;
  font-size: 14px;
  line-height: 1.7;
  opacity: 0.82;
}

.hero-gauge {
  position: relative;
  width: 200px;
  height: 120px;
  animation: anchor-drop-sway 6s ease-in-out infinite;
}

.gauge-svg {
  width: 100%;
  height: 100%;
  animation: anchor-gauge-glow 4s ease-in-out infinite;
}

.gauge-fill {
  transition: stroke-dashoffset 0.8s ease;
}

.gauge-center {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-value {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(90deg, var(--text-primary, #fff) 40%, rgba(52, 211, 153, 0.9) 50%, var(--text-primary, #fff) 60%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: anchor-chain-shimmer 5s linear infinite;
}

.gauge-unit {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

@keyframes anchor-drop-sway {
  0% { transform: translateY(-8px) rotate(-3deg); opacity: 0.8; }
  30% { transform: translateY(2px) rotate(1deg); opacity: 1; }
  50% { transform: translateY(0) rotate(0deg); opacity: 1; }
  70% { transform: translateY(0) rotate(-1deg); }
  100% { transform: translateY(-8px) rotate(-3deg); opacity: 0.8; }
}

@keyframes anchor-chain-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes anchor-deep-blue-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes anchor-gauge-glow {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.2)); }
  50% { filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.5)); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-container, .hero-gauge, .gauge-svg, .gauge-value {
    animation: none;
  }
}
</style>
