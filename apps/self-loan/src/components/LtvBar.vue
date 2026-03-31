<template>
  <div class="hero-ltv-bar">
    <div class="ltv-header">
      <span class="ltv-label">{{ t("ltvLabel") }}</span>
      <span :class="['ltv-value', ltvStatus]">{{ currentLTVDisplay }}</span>
    </div>
    <div class="ltv-track">
      <div class="ltv-fill" :class="ltvStatus" :style="{ width: `${Math.min(currentLTV, 100)}%` }" />
      <div class="ltv-zones">
        <div class="zone safe" />
        <div class="zone warn" />
        <div class="zone danger" />
      </div>
      <!-- Threshold markers -->
      <div class="ltv-threshold" style="left: 50%"><span class="threshold-label">50%</span></div>
      <div class="ltv-threshold" style="left: 75%"><span class="threshold-label">75%</span></div>
    </div>
    <div class="ltv-zone-labels">
      <span class="zone-text safe-text">SAFE</span>
      <span class="zone-text warn-text">CAUTION</span>
      <span class="zone-text danger-text">LIQUIDATION</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  currentLTVDisplay: string;
  currentLTV: number;
}>();

const ltvStatus = computed(() => {
  if (props.currentLTV >= 75) return "danger";
  if (props.currentLTV >= 50) return "warn";
  return "safe";
});
</script>

<!-- script is above with template -->

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-ltv-bar {
  width: 100%;
  max-width: 320px;
  box-shadow: 0 0 12px rgba(0, 229, 153, 0.2);
  transition: box-shadow 0.3s ease;
  &:hover { box-shadow: 0 0 20px rgba(0, 229, 153, 0.4); }
}

.ltv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ltv-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

.ltv-value {
  font-size: 15px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
  transition: color 0.3s ease;

  &.safe { color: var(--checkbook-success, #34d399); }
  &.warn { color: var(--checkbook-warning, #fbbf24); }
  &.danger { color: var(--checkbook-danger, #f87171); text-shadow: 0 0 8px rgba(248, 113, 113, 0.4); }
}

.ltv-track {
  height: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 5px;
  position: relative;
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ltv-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease;
  z-index: 2;

  &.safe {
    background: linear-gradient(90deg, var(--checkbook-success, #34d399), #10b981);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.3);
  }
  &.warn {
    background: linear-gradient(90deg, var(--checkbook-success, #34d399), var(--checkbook-warning, #fbbf24));
    box-shadow: 0 0 8px rgba(251, 191, 36, 0.3);
  }
  &.danger {
    background: linear-gradient(90deg, var(--checkbook-success, #34d399), var(--checkbook-warning, #fbbf24), var(--checkbook-danger, #f87171));
    box-shadow: 0 0 12px rgba(248, 113, 113, 0.4);
    animation: danger-flash 1s ease-in-out infinite alternate;
  }
}

.ltv-zones {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 1;
  border-radius: 5px;
  overflow: hidden;
}

.zone {
  flex: 1;
  &.safe { background: rgba(52, 211, 153, 0.06); }
  &.warn { background: rgba(251, 191, 36, 0.06); }
  &.danger { background: rgba(248, 113, 113, 0.06); }
}

/* Threshold markers */
.ltv-threshold {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  z-index: 3;
  background: rgba(255, 255, 255, 0.2);
}

.threshold-label {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 7px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Zone labels below the bar */
.ltv-zone-labels {
  display: flex;
  margin-top: 6px;
}

.zone-text {
  flex: 1;
  text-align: center;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;

  &.safe-text { color: rgba(52, 211, 153, 0.45); }
  &.warn-text { color: rgba(251, 191, 36, 0.45); }
  &.danger-text { color: rgba(248, 113, 113, 0.45); }
}

@keyframes danger-flash {
  0% { box-shadow: 0 0 8px rgba(248, 113, 113, 0.3); }
  100% { box-shadow: 0 0 18px rgba(248, 113, 113, 0.6); }
}
</style>
