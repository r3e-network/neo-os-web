<template>
  <div class="hero-container">
    <div class="tarot-scene" aria-hidden="true">
      <div class="tarot-card-back" :class="{ 'tarot-card-back--drawn': hasDrawn }">
        <div class="tarot-card-inner">
          <span class="tarot-symbol">&#10022;</span>
        </div>
      </div>
    </div>
    <div class="hero-stats">
      <div class="hero-stat">
        <span class="hero-stat-value">{{ readingsCount }}</span>
        <span class="hero-stat-label">{{ t("readings") }}</span>
      </div>
      <div class="hero-stat">
        <span class="hero-stat-value">{{ cardsDrawnCount }}</span>
        <span class="hero-stat-label">{{ t("cardsDrawnCount") }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  readingsCount: number;
  cardsDrawnCount: number;
  hasDrawn: boolean;
}>();
</script>

<style lang="scss" scoped>
.hero-container {
  margin-bottom: 20px;
  width: 100%;
  background: radial-gradient(ellipse at 50% 30%, rgba(159, 157, 243, 0.1) 0%, transparent 55%);
}

.tarot-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  background: linear-gradient(180deg, rgba(42, 31, 94, 0.3), transparent);
}

.tarot-card-back {
  width: 55px;
  height: 80px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--tarot-card-back-backdrop, #2a1f5e), var(--tarot-card-back-backdrop-end, #4a2f8e));
  border: 2px solid rgba(159, 157, 243, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.6s;
  box-shadow:
    0 0 20px rgba(159, 157, 243, 0.25),
    0 0 40px rgba(159, 157, 243, 0.08);
  animation: card-hover-float 5s ease-in-out infinite;
}

.tarot-card-back--drawn {
  transform: rotateY(180deg);
}

.tarot-card-inner {
  background: repeating-conic-gradient(rgba(159, 157, 243, 0.1) 0% 25%, transparent 0% 50%) 50% / 10px 10px;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tarot-symbol {
  font-size: 20px;
  color: rgba(159, 157, 243, 0.6);
  animation: starfield-twinkle 3s ease-in-out infinite;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(159, 157, 243, 0.12);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(159, 157, 243, 0.3);
    transform: translateY(-2px);
  }
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: linear-gradient(180deg, rgba(159, 157, 243, 0.06), transparent);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
  box-shadow: inset 0 1px 0 rgba(159, 157, 243, 0.08);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

@keyframes card-hover-float {
  0%,
  100% {
    transform: rotateY(0deg) translateY(0);
  }
  25% {
    transform: rotateY(5deg) translateY(-4px);
  }
  75% {
    transform: rotateY(-5deg) translateY(-4px);
  }
}

@keyframes starfield-twinkle {
  0%,
  100% {
    opacity: 0.3;
    box-shadow: 0 0 4px rgba(159, 157, 243, 0.3);
  }
  50% {
    opacity: 1;
    box-shadow:
      0 0 12px rgba(159, 157, 243, 0.7),
      0 0 24px rgba(159, 157, 243, 0.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tarot-card-back,
  .tarot-symbol {
    animation: none;
  }
}
</style>
