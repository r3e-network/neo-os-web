<template>
  <div class="hero-container">
    <div class="hero-bolt" aria-hidden="true">
      <svg viewBox="0 0 64 96" class="bolt-svg">
        <path
          d="M38 2L10 42h18L22 94l32-50H36L38 2z"
          fill="url(#boltGrad)"
          stroke="rgba(255,255,255,0.2)"
          stroke-width="1.5"
        />
        <defs>
          <linearGradient id="boltGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--flash-accent-yellow, #facc15)" />
            <stop offset="100%" stop-color="var(--flash-pending, #f59e0b)" />
          </linearGradient>
        </defs>
      </svg>
      <div class="bolt-glow" />
    </div>
    <span class="hero-label">{{ t("appName") }}</span>
    <div class="hero-stats-row">
      <div class="hero-stat">
        <span class="hero-stat-label">{{ t("sidebarPoolBalance") }}</span>
        <span class="hero-stat-value">{{ poolBalance || poolBalance === 0 ? poolBalance : t("notAvailable") }}</span>
      </div>
      <div class="hero-stat-divider" />
      <div class="hero-stat">
        <span class="hero-stat-label">{{ t("sidebarTotalLoans") }}</span>
        <span class="hero-stat-value">{{ totalLoans }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  poolBalance: number;
  totalLoans: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/flashloan-theme.scss" as *;

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(250, 204, 21, 0.06), rgba(255, 255, 255, 0.02));
  background-size: 200% 200%;
  animation: flash-current-flow 6s ease-in-out infinite;
  border: 1px solid rgba(59, 130, 246, 0.12);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-bolt {
  position: relative;
  width: 72px;
  height: 108px;
}

.bolt-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.5));
  animation: flash-bolt-strike 4s ease-in-out infinite;
}

.bolt-glow {
  position: absolute;
  inset: -20px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(250, 204, 21, 0.1) 40%, transparent 70%);
  border-radius: 50%;
  z-index: -1;
  animation: flash-glow-pulse 3s ease-in-out infinite;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg-card-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 16px 24px;
  box-shadow:
    0 0 20px rgba(59, 130, 246, 0.08),
    inset 0 1px 0 rgba(250, 204, 21, 0.08);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-subtle);
}

@keyframes flash-bolt-strike {
  0%, 100% { filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.5)); opacity: 1; }
  5% { filter: drop-shadow(0 0 40px rgba(255, 255, 255, 0.9)) brightness(2); opacity: 1; }
  10% { filter: drop-shadow(0 0 20px rgba(250, 204, 21, 0.6)); opacity: 0.9; }
  15% { filter: drop-shadow(0 0 35px rgba(255, 255, 255, 0.7)) brightness(1.8); opacity: 1; }
  20% { filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.5)); opacity: 1; }
}

@keyframes flash-current-flow {
  0% { background-position: 0% 50%; box-shadow: 0 0 20px rgba(59, 130, 246, 0.1); }
  50% { background-position: 100% 50%; box-shadow: 0 0 40px rgba(59, 130, 246, 0.2), 0 0 80px rgba(250, 204, 21, 0.1); }
  100% { background-position: 0% 50%; box-shadow: 0 0 20px rgba(59, 130, 246, 0.1); }
}

@keyframes flash-glow-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-container, .bolt-svg, .bolt-glow {
    animation: none;
  }
}

@media (max-width: 480px) {
  .hero-container {
    min-height: 250px;
    padding: 24px 16px;
    gap: 12px;
  }
  .hero-bolt {
    width: 56px;
    height: 84px;
  }
  .hero-label {
    font-size: 18px;
  }
  .hero-stats-row {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
  }
  .hero-stat-value {
    font-size: 16px;
  }
  .hero-stat-divider {
    height: 1px;
    width: 80px;
  }
}
</style>
