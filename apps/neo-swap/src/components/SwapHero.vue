<template>
  <div class="hero-container">
    <div class="hero-swap-display">
      <div class="hero-token">
        <div class="token-icon token-icon--from">N</div>
        <span class="token-name">{{ t("tokenNeo") }}</span>
      </div>
      <div class="hero-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
          <path
            d="M5 12h14m-4-4l4 4-4 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="hero-token">
        <div class="token-icon token-icon--to">G</div>
        <span class="token-name">{{ t("tokenGas") }}</span>
      </div>
    </div>
    <div class="hero-price-quote">
      <span class="price-label">{{ t("sidebarRate") }}</span>
      <span class="price-value">{{ currentRate }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  currentRate: string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/neo-swap-theme.scss" as *;

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(180deg, var(--swap-accent-soft) 0%, transparent 100%);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-swap-display {
  display: flex;
  align-items: center;
  gap: 24px;
}

.hero-token {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.token-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
  color: var(--swap-text);

  &--from {
    background: linear-gradient(135deg, var(--swap-accent) 0%, var(--swap-accent-strong) 100%);
    box-shadow: 0 0 16px var(--swap-accent-glow);
  }

  &--to {
    background: linear-gradient(135deg, var(--swap-accent-strong) 0%, var(--swap-accent-secondary) 100%);
    box-shadow: 0 0 16px var(--swap-accent-glow-strong);
  }
}

.token-name {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
}

.hero-arrow {
  color: var(--swap-accent);
  opacity: 0.7;
}

.hero-price-quote {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-card-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 32px;
}

.price-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.price-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--swap-accent);
}

/* -- Neo Swap Hero Enhancements: Token Exchange -- */
@keyframes swap-rotate {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(15deg) scale(1.1);
  }
  50% {
    transform: rotate(0deg);
  }
  75% {
    transform: rotate(-15deg) scale(1.1);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes flow-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.hero-container {
  background: linear-gradient(135deg, var(--swap-accent-glow-green-light), var(--swap-accent-glow-blue-light), var(--swap-accent-soft));
  background-size: 200% 200%;
  animation: flow-gradient 6s ease-in-out infinite;
}

.hero-arrow {
  animation: swap-rotate 4s ease-in-out infinite;
}

.hero-price-quote {
  box-shadow: 0 4px 20px var(--swap-accent-glow-green-light);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;

  &:hover {
    box-shadow: 0 6px 28px var(--swap-accent-glow-green);
    transform: translateY(-2px);
  }
}

.token-icon--from {
  box-shadow:
    0 0 20px var(--swap-accent-glow-green),
    0 0 40px var(--swap-accent-glow-green-light);
}

.token-icon--to {
  box-shadow:
    0 0 20px var(--swap-accent-glow-blue),
    0 0 40px var(--swap-accent-glow-blue-light);
}

.hero-swap-display {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
}

@media (prefers-reduced-motion: reduce) {
  .hero-container,
  .hero-arrow {
    animation: none;
  }
}
</style>
