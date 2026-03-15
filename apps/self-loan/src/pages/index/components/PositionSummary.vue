<template>
  <NeoCard variant="erobo" class="position-summary">
    <div class="health-section">
      <span class="section-label">{{ t("healthFactor") }}</span>
      <div class="health-gauge-glass">
        <div class="gauge-ring" :class="healthGradientClass"></div>
        <div class="gauge-inner">
          <span class="gauge-value">{{ healthFactor.toFixed(2) }}</span>
          <span class="gauge-label" :class="healthStatusClass">{{ healthStatus }}</span>
        </div>
        <div class="gauge-glow" :class="healthGradientClass"></div>
      </div>

      <div class="health-legend">
        <div class="legend-item">
          <div class="legend-dot safe"></div>
          <span class="legend-text">{{ t("safe") }} (>2.0)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot warning"></div>
          <span class="legend-text">{{ t("warning") }} (1.5-2.0)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot danger"></div>
          <span class="legend-text">{{ t("danger") }} (<1.5)</span>
        </div>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card-glass">
        <span class="metric-label">{{ t("totalBorrowed") }}</span>
        <span class="metric-value borrowed">{{ fmt(loan.borrowed, 2) }}</span>
        <span class="metric-unit">GAS</span>
      </div>
      <div class="metric-card-glass">
        <span class="metric-label">{{ t("collateralLocked") }}</span>
        <span class="metric-value collateral">{{ fmt(loan.collateralLocked, 2) }}</span>
        <span class="metric-unit">NEO</span>
      </div>
      <div class="metric-card-glass">
        <span class="metric-label">{{ t("currentLTV") }}</span>
        <span class="metric-value ltv">{{ currentLTV }}%</span>
        <span class="metric-unit">{{ t("maxLTV") }}: {{ terms.ltvPercent }}%</span>
      </div>
      <div class="metric-card-glass">
        <span class="metric-label">{{ t("minDuration") }}</span>
        <span class="metric-value rate">{{ terms.minDurationHours }}</span>
        <span class="metric-unit">{{ t("hours") }}</span>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";

const props = defineProps<{
  loan: Record<string, unknown>;
  terms: Record<string, unknown>;
  healthFactor: number;
  currentLTV: number;
  t: (key: string, ...args: unknown[]) => string;
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

const healthGradientClass = computed(() => {
  const hf = props.healthFactor;
  if (hf >= 2.0) return "health-safe";
  if (hf >= 1.5) return "health-warning";
  return "health-danger";
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.health-section {
  margin-bottom: $spacing-6;
  text-align: center;
}

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

  &.health-safe {
    background: conic-gradient(var(--checkbook-success) 0% 75%, rgba(255, 255, 255, 0.1) 75% 100%);
  }
  &.health-warning {
    background: conic-gradient(var(--checkbook-warning) 0% 50%, rgba(255, 255, 255, 0.1) 50% 100%);
  }
  &.health-danger {
    background: conic-gradient(var(--checkbook-danger) 0% 25%, rgba(255, 255, 255, 0.1) 25% 100%);
  }
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

  &.text-safe {
    color: var(--checkbook-success);
    text-shadow: 0 0 10px rgba(0, 229, 153, 0.4);
  }
  &.text-warning {
    color: var(--checkbook-warning);
    text-shadow: 0 0 10px rgba(253, 224, 71, 0.4);
  }
  &.text-danger {
    color: var(--checkbook-danger);
    text-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
  }
}

.gauge-glow {
  position: absolute;
  inset: 20%;
  border-radius: 50%;
  filter: blur(20px);
  opacity: 0.2;
  z-index: 0;

  &.health-safe {
    background: var(--checkbook-success);
  }
  &.health-warning {
    background: var(--checkbook-warning);
  }
  &.health-danger {
    background: var(--checkbook-danger);
  }
}

.health-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  &.safe {
    background: var(--checkbook-success);
    box-shadow: 0 0 5px var(--checkbook-success);
  }
  &.warning {
    background: var(--checkbook-warning);
    box-shadow: 0 0 5px var(--checkbook-warning);
  }
  &.danger {
    background: var(--checkbook-danger);
    box-shadow: 0 0 5px var(--checkbook-danger);
  }
}

.legend-text {
  font-size: 10px;
  color: var(--text-secondary);
}

.metrics-grid {
  @include grid-layout(2, 12px);
}

.metric-card-glass {
  @include card-base(12px, 16px);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  @include stat-label;
  font-size: 10px;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.metric-value {
  @include mono-number(18px);
  font-weight: 800;
  line-height: 1.2;

  &.borrowed {
    color: var(--checkbook-warning);
  }
  &.collateral {
    color: var(--checkbook-success);
  }
  &.ltv {
    color: var(--checkbook-info);
  }
  &.rate {
    color: var(--text-primary);
  }
}

.metric-unit {
  font-size: 9px;
  color: var(--text-secondary);
}
</style>
