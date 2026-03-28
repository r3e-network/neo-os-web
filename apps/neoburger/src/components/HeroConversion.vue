<template>
  <div class="hero-conversion">
    <div class="hero-convert-token">
      <span class="convert-icon" aria-hidden="true">N</span>
      <span class="convert-label">{{ t("tokenNeo") }}</span>
    </div>
    <span class="convert-arrow">&rarr;</span>
    <div class="hero-convert-token">
      <span class="convert-icon convert-icon--bneo" aria-hidden="true">b</span>
      <span class="convert-label">{{ t("tokenBneo") }}</span>
    </div>
  </div>
  <div class="hero-stats-row">
    <div class="hero-stat">
      <span class="hero-stat-label">{{ t("sidebarNeoBalance") }}</span>
      <span class="hero-stat-value">{{ neoBalance ?? t("notAvailable") }}</span>
    </div>
    <div class="hero-stat-divider" />
    <div class="hero-stat">
      <span class="hero-stat-label">{{ t("sidebarBneoBalance") }}</span>
      <span class="hero-stat-value">{{ bNeoBalance ?? t("notAvailable") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  neoBalance: number | null;
  bNeoBalance: number | null;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/neoburger-theme.scss" as *;

.hero-conversion {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  animation: burger-stack-bounce 3s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.1);
}

.hero-convert-token {
  display: flex;
  align-items: center;
  gap: 8px;
}

.convert-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--burger-accent), var(--burger-accent-deep));
  color: var(--burger-hero-text);
  box-shadow: 0 0 12px rgba(0, 230, 118, 0.3);

  &--bneo {
    background: linear-gradient(135deg, var(--burger-gold, #fbbf24), var(--burger-gold-dark, #f59e0b));
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
  }
}

.convert-label {
  font-size: 14px;
  font-weight: 600;
}

.convert-arrow {
  font-size: 20px;
  opacity: 0.5;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  padding: 16px 24px;
  animation: burger-cheese-melt 4s ease-in-out infinite;
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
  background: var(--border-color, rgba(255, 255, 255, 0.1));
}

@keyframes burger-stack-bounce {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-6px); }
  40% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
  60% { transform: translateY(0); }
}

@keyframes burger-cheese-melt {
  0%, 100% {
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.15);
  }
  50% {
    box-shadow: 0 0 32px rgba(245, 158, 11, 0.3), 0 4px 16px rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-conversion, .hero-stats-row {
    animation: none;
  }
}

@media (max-width: 480px) {
  .hero-conversion {
    gap: 12px;
    padding: 10px 16px;
  }
  .hero-stats-row {
    gap: 14px;
    padding: 12px 16px;
  }
  .hero-stat-value {
    font-size: 16px;
  }
  .convert-icon {
    width: 30px;
    height: 30px;
    font-size: 14px;
  }
  .convert-arrow {
    font-size: 16px;
  }
}
</style>
