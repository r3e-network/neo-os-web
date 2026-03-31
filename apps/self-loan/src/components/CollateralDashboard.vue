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
      <div class="vault-lock-indicator" aria-hidden="true">
        <span class="lock-dot" />
        <span class="lock-text">SECURED</span>
      </div>
    </div>

    <!-- Center: Semicircular Health Gauge (speedometer style) -->
    <div class="hero-health-gauge" aria-hidden="true">
      <svg viewBox="0 0 200 120" class="gauge-svg-semi">
        <!-- Background semicircle arc -->
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          stroke-width="10"
          stroke-linecap="round"
        />
        <!-- Colored zone segments -->
        <path d="M 20 110 A 80 80 0 0 1 66 30" fill="none" stroke="rgba(239, 68, 68, 0.15)" stroke-width="10" />
        <path d="M 66 30 A 80 80 0 0 1 134 30" fill="none" stroke="rgba(251, 191, 36, 0.15)" stroke-width="10" />
        <path d="M 134 30 A 80 80 0 0 1 180 110" fill="none" stroke="rgba(52, 211, 153, 0.15)" stroke-width="10" />
        <!-- Active arc (health factor) -->
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          :stroke="healthColor"
          stroke-width="10"
          stroke-linecap="round"
          :stroke-dasharray="`${healthArc * 2.51} 251`"
          class="gauge-arc-semi"
        />
      </svg>
      <!-- Gauge zone labels -->
      <span class="gauge-zone-label danger-zone">DANGER</span>
      <span class="gauge-zone-label warn-zone">WARN</span>
      <span class="gauge-zone-label safe-zone">SAFE</span>
      <div class="gauge-center-semi">
        <span class="gauge-shield" aria-hidden="true">&#x1F6E1;</span>
        <span class="gauge-value-semi">{{ healthFactorDisplay }}</span>
        <span class="gauge-label-semi">{{ t("healthFactor") }}</span>
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

/* ── Health Gauge (Semicircular Speedometer) ── */
.hero-health-gauge {
  position: relative;
  width: 200px;
  height: 130px;
  flex-shrink: 0;
  animation: health-pulse 3s ease-in-out infinite;
}

.gauge-svg-semi { width: 100%; height: 100%; }

.gauge-arc-semi {
  transition: stroke-dasharray 0.8s ease, stroke 0.5s ease;
  filter: drop-shadow(0 0 6px var(--vault-gold, rgba(212, 168, 83, 0.5)));
}

.gauge-zone-label {
  position: absolute;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;

  &.danger-zone { bottom: 8px; left: 8px; color: rgba(239, 68, 68, 0.5); }
  &.warn-zone { top: 4px; left: 50%; transform: translateX(-50%); color: rgba(251, 191, 36, 0.5); }
  &.safe-zone { bottom: 8px; right: 8px; color: rgba(52, 211, 153, 0.5); }
}

.gauge-center-semi {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-shield {
  font-size: 18px;
  margin-bottom: 2px;
  filter: drop-shadow(0 0 6px rgba(212, 168, 83, 0.4));
}

.gauge-value-semi {
  font-size: 24px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
  text-shadow: 0 0 12px rgba(212, 168, 83, 0.3);
}

.gauge-label-semi {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

/* Vault lock indicator */
.vault-lock-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.lock-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 4px rgba(52, 211, 153, 0.6);
  animation: lock-blink 2s ease-in-out infinite;
}

.lock-text {
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: rgba(52, 211, 153, 0.6);
}

@keyframes lock-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes health-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(212, 168, 83, 0.2)); }
  50% { filter: drop-shadow(0 0 20px rgba(212, 168, 83, 0.5)); }
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
