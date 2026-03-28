<template>
  <div class="hero-split-display">
    <!-- Left: Locked NEO -->
    <div class="hero-asset-card locked">
      <div class="asset-icon-ring">
        <span class="asset-icon" aria-hidden="true">&#x1F512;</span>
      </div>
      <span class="asset-amount">{{ collateralDisplay }}</span>
      <span class="asset-token">{{ t("tokenNeo") }}</span>
      <span class="asset-label">{{ t("locked") }}</span>
    </div>

    <!-- Center: Health Gauge -->
    <div class="hero-health-gauge" aria-hidden="true">
      <svg viewBox="0 0 120 120" class="gauge-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6" />
        <circle
          cx="60" cy="60" r="52" fill="none"
          :stroke="healthColor" stroke-width="6" stroke-linecap="round"
          :stroke-dasharray="`${healthArc} 327`"
          transform="rotate(-90 60 60)"
          class="gauge-arc"
        />
      </svg>
      <div class="gauge-center">
        <span class="gauge-value">{{ healthFactorDisplay }}</span>
        <span class="gauge-label">{{ t("healthFactor") }}</span>
      </div>
    </div>

    <!-- Right: Borrowed GAS -->
    <div class="hero-asset-card borrowed">
      <div class="asset-icon-ring">
        <span class="asset-icon" aria-hidden="true">&#x2197;</span>
      </div>
      <span class="asset-amount">{{ borrowedDisplay }}</span>
      <span class="asset-token">{{ t("tokenGas") }}</span>
      <span class="asset-label">{{ t("totalBorrowed") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  collateralDisplay: string;
  borrowedDisplay: string;
  healthFactorDisplay: string;
  healthColor: string;
  healthArc: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-split-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
}

.hero-asset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex: 1;
  max-width: 120px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  &.locked {
    border-color: rgba(251, 191, 36, 0.15);
    &:hover { box-shadow: 0 0 15px rgba(251, 191, 36, 0.1); }
  }
  &.borrowed {
    border-color: rgba(52, 211, 153, 0.15);
    &:hover { box-shadow: 0 0 15px rgba(52, 211, 153, 0.1); }
  }
}

.asset-icon-ring {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;

  .locked & { border-color: rgba(251, 191, 36, 0.3); box-shadow: 0 0 8px rgba(251, 191, 36, 0.15); }
  .borrowed & { border-color: rgba(52, 211, 153, 0.3); box-shadow: 0 0 8px rgba(52, 211, 153, 0.15); }
}

.asset-icon {
  font-size: 16px;
  animation: lock-bounce 4s ease-in-out infinite;
  .locked & { color: var(--checkbook-locked-asset, #fbbf24); }
  .borrowed & { color: var(--checkbook-borrowed-asset, #34d399); }
}

.asset-amount {
  font-size: 18px;
  font-weight: 900;
  font-family: $font-mono;
  .locked & { color: var(--checkbook-locked-asset, #fbbf24); }
  .borrowed & { color: var(--checkbook-borrowed-asset, #34d399); }
}

.asset-token {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: var(--checkbook-asset-token, rgba(255, 255, 255, 0.4));
}

.asset-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.3);
}

/* ── Health Gauge ── */
.hero-health-gauge {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  animation: health-pulse 3s ease-in-out infinite;
}

.gauge-svg { width: 100%; height: 100%; }

.gauge-arc {
  transition: stroke-dasharray 0.8s ease, stroke 0.5s ease;
}

.gauge-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gauge-value {
  font-size: 18px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
}

.gauge-label {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

@keyframes health-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 229, 153, 0.3)); }
  50% { filter: drop-shadow(0 0 20px rgba(0, 229, 153, 0.6)); }
}

@keyframes lock-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@media (max-width: 480px) {
  .hero-split-display { gap: 8px; }
  .hero-asset-card { padding: 12px 8px; }
  .asset-amount { font-size: 15px; }
  .hero-health-gauge { width: 80px; height: 80px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-health-gauge { animation: none; }
  .asset-icon { animation: none; }
}
</style>
