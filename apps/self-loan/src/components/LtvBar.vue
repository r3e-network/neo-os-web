<template>
  <div class="hero-ltv-bar">
    <div class="ltv-header">
      <span class="ltv-label">{{ t("ltvLabel") }}</span>
      <span class="ltv-value">{{ currentLTVDisplay }}</span>
    </div>
    <div class="ltv-track">
      <div class="ltv-fill" :style="{ width: `${Math.min(currentLTV, 100)}%` }" />
      <div class="ltv-zones">
        <div class="zone safe" />
        <div class="zone warn" />
        <div class="zone danger" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  currentLTVDisplay: string;
  currentLTV: number;
}>();
</script>

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
  font-size: 14px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
}

.ltv-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ltv-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--checkbook-success, #34d399), var(--checkbook-warning, #fbbf24), var(--checkbook-danger, #f87171));
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}

.ltv-zones {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 1;
}

.zone {
  flex: 1;
  &.safe { background: rgba(52, 211, 153, 0.06); }
  &.warn { background: rgba(251, 191, 36, 0.06); }
  &.danger { background: rgba(248, 113, 113, 0.06); }
}
</style>
