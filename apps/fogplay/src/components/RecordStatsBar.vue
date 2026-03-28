<template>
  <div class="record-bar">
    <div class="record-item win">
      <span class="record-count">{{ wins }}</span>
      <span class="record-label">{{ t("wins") }}</span>
    </div>
    <div class="record-divider" />
    <div class="record-item total">
      <span class="record-count">{{ totalGames }}</span>
      <span class="record-label">{{ t("totalGames") }}</span>
    </div>
    <div class="record-divider" />
    <div class="record-item loss">
      <span class="record-count">{{ losses }}</span>
      <span class="record-label">{{ t("losses") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  wins: number;
  losses: number;
  totalGames: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/fogplay-theme.scss" as *;

.record-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--coin-record-bg);
  border: 1px solid var(--coin-record-border);
  border-radius: 12px;
  z-index: 2;
  animation: glow-pulse 4s ease-in-out infinite;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--coin-hover-glow);
  }
}

.record-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.record-count {
  font-size: 20px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--coin-text-light);

  .win & {
    color: var(--coin-win);
  }
  .loss & {
    color: var(--coin-loss);
  }
  .total & {
    color: var(--coin-text-muted-light);
  }
}

.record-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--coin-text-muted-light);
}

.record-divider {
  width: 1px;
  height: 28px;
  background: var(--coin-record-divider);
}

@keyframes glow-pulse {
  0%,
  100% {
    box-shadow: 0 0 15px var(--coin-glow-pulse);
  }
  50% {
    box-shadow: 0 0 30px var(--coin-glow-pulse-strong);
  }
}

/* -- Responsive -- */
@media (max-width: 480px) {
  .record-bar {
    gap: 12px;
    padding: 10px 18px;
  }
}

/* -- Reduced motion -- */
@media (prefers-reduced-motion: reduce) {
  .record-bar {
    animation: none;
    transition: none;
  }
}
</style>
