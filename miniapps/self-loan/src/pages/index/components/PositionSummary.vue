<template>
  <NeoCard variant="erobo" class="position-summary">
    <view class="health-section">
      <text class="section-label">{{ t("healthFactor") }}</text>
      <view class="health-gauge-glass">
        <view class="gauge-ring" :style="{ background: healthGradient }"></view>
        <view class="gauge-inner">
          <text class="gauge-value">{{ healthFactor.toFixed(2) }}</text>
          <text class="gauge-label" :class="healthStatusClass">{{ healthStatus }}</text>
        </view>
        <view class="gauge-glow" :style="{ background: healthGlowColor }"></view>
      </view>
      
      <view class="health-legend">
        <view class="legend-item">
          <view class="legend-dot safe"></view>
          <text class="legend-text">{{ t("safe") }} (>2.0)</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot warning"></view>
          <text class="legend-text">{{ t("warning") }} (1.5-2.0)</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot danger"></view>
          <text class="legend-text">{{ t("danger") }} (<1.5)</text>
        </view>
      </view>
    </view>

    <view class="metrics-grid">
      <view class="metric-card-glass">
        <text class="metric-label">{{ t("totalBorrowed") }}</text>
        <text class="metric-value borrowed">{{ fmt(loan.borrowed, 2) }}</text>
        <text class="metric-unit">GAS</text>
      </view>
      <view class="metric-card-glass">
        <text class="metric-label">{{ t("collateralLocked") }}</text>
        <text class="metric-value collateral">{{ fmt(loan.collateralLocked, 2) }}</text>
        <text class="metric-unit">NEO</text>
      </view>
      <view class="metric-card-glass">
        <text class="metric-label">{{ t("currentLTV") }}</text>
        <text class="metric-value ltv">{{ currentLTV }}%</text>
        <text class="metric-unit">{{ t("maxLTV") }}: {{ terms.ltvPercent }}%</text>
      </view>
      <view class="metric-card-glass">
        <text class="metric-label">{{ t("minDuration") }}</text>
        <text class="metric-value rate">{{ terms.minDurationHours }}</text>
        <text class="metric-unit">{{ t("hours") }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";

const props = defineProps<{
  loan: any;
  terms: any;
  healthFactor: number;
  currentLTV: number;
  t: (key: string) => string;
}>();

const fmt = (n: number, d = 2) => formatNumber(n, d);

const healthStatus = computed(() => {
  const hf = props.healthFactor;
  if (hf >= 2.0) return props.t("safe");
  if (hf >= 1.5) return props.t("warning");
  return props.t("danger");
});

const healthStatusClass = computed(() => {
  const hf = props.healthFactor;
  if (hf >= 2.0) return "text-safe";
  if (hf >= 1.5) return "text-warning";
  return "text-danger";
});

const healthGradient = computed(() => {
  const hf = props.healthFactor;
  if (hf >= 2.0) return "conic-gradient(#00e599 0% 75%, rgba(255,255,255,0.1) 75% 100%)";
  if (hf >= 1.5) return "conic-gradient(#fde047 0% 50%, rgba(255,255,255,0.1) 50% 100%)";
  return "conic-gradient(#ef4444 0% 25%, rgba(255,255,255,0.1) 25% 100%)";
});

const healthGlowColor = computed(() => {
  const hf = props.healthFactor;
  if (hf >= 2.0) return "#00e599";
  if (hf >= 1.5) return "#fde047";
  return "#ef4444";
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.health-section { margin-bottom: $spacing-6; text-align: center; }

.section-label {
  display: block;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: $spacing-4;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.health-gauge-glass {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  margin: 0 auto $spacing-4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
}

.gauge-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  mask: radial-gradient(transparent 60%, black 61%);
  -webkit-mask: radial-gradient(transparent 60%, black 61%);
}

.gauge-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-value {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.gauge-label {
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
  margin-top: 4px;
  letter-spacing: 0.05em;
  
  &.text-safe { color: #00e599; text-shadow: 0 0 10px rgba(0, 229, 153, 0.4); }
  &.text-warning { color: #fde047; text-shadow: 0 0 10px rgba(253, 224, 71, 0.4); }
  &.text-danger { color: #ef4444; text-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
}

.gauge-glow {
  position: absolute;
  inset: 20%;
  border-radius: 50%;
  filter: blur(20px);
  opacity: 0.2;
  z-index: 0;
}

.health-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
}

.legend-item { display: flex; align-items: center; gap: 6px; }

.legend-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  &.safe { background: #00e599; box-shadow: 0 0 5px #00e599; }
  &.warning { background: #fde047; box-shadow: 0 0 5px #fde047; }
  &.danger { background: #ef4444; box-shadow: 0 0 5px #ef4444; }
}

.legend-text { font-size: 10px; color: var(--text-secondary); }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.metric-card-glass {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }

.metric-value {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  font-family: $font-mono;
  
  &.borrowed { color: #fde047; }
  &.collateral { color: #00e599; }
  &.ltv { color: #3b82f6; }
  &.rate { color: var(--text-primary); }
}

.metric-unit { font-size: 9px; color: var(--text-secondary); }
</style>
