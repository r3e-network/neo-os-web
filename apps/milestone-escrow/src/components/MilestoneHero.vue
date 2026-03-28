<template>
  <div class="hero-container">
    <span class="hero-label">{{ t("appName") }}</span>
    <div class="hero-progress-track">
      <div class="hero-progress-fill" :style="{ width: progressPercent + '%' }" />
      <div
        v-for="cp in checkpoints"
        :key="cp.label"
        class="hero-checkpoint"
        :class="{ 'hero-checkpoint--done': cp.done }"
        :style="{ left: cp.position + '%' }"
      >
        <div class="checkpoint-dot" />
        <span class="checkpoint-label">{{ cp.label }}</span>
      </div>
    </div>
    <div class="hero-stats-row">
      <div class="hero-stat">
        <span class="hero-stat-label">{{ t("statusActive") }}</span>
        <span class="hero-stat-value">{{ activeCount }}</span>
      </div>
      <div class="hero-stat-divider" />
      <div class="hero-stat">
        <span class="hero-stat-label">{{ t("statusCompleted") }}</span>
        <span class="hero-stat-value">{{ completedCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Checkpoint {
  position: number;
  done: boolean;
  label: string;
}

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPercent: number;
  checkpoints: Checkpoint[];
  activeCount: number;
  completedCount: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  border-radius: 20px;
  margin-bottom: 20px;
  background: radial-gradient(ellipse at 50% 30%, rgb(from var(--escrow-indigo, #6366f1) r g b / 0.1) 0%, transparent 55%);
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 0 16px var(--escrow-hero-label-glow);
}

.hero-progress-track {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 6px;
  background: var(--escrow-border-light, rgba(255, 255, 255, 0.1));
  border-radius: 3px;
  margin: 24px 0 32px;
}

.hero-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--escrow-indigo, #6366f1), var(--escrow-purple, #8b5cf6), var(--escrow-indigo, #6366f1), var(--escrow-purple, #8b5cf6));
  background-size: 200% 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
  animation: progress-shimmer 3s linear infinite;
}

.hero-checkpoint {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.checkpoint-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--escrow-border-light-mid, rgba(255, 255, 255, 0.15));
  border: 2px solid var(--escrow-border-light, rgba(255, 255, 255, 0.1));
  transition: all 0.3s ease;
}

.hero-checkpoint--done .checkpoint-dot {
  background: var(--escrow-purple, #8b5cf6);
  border-color: var(--escrow-indigo, #6366f1);
  box-shadow: 0 0 8px rgb(from var(--escrow-purple, #8b5cf6) r g b / 0.4);
  animation: checkpoint-pulse 2.5s ease-in-out infinite;
}

.checkpoint-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin-top: 10px;
}

.hero-checkpoint--done .checkpoint-label {
  opacity: 0.9;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--escrow-overlay-light, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--escrow-overlay-light-hover, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 24px;
  box-shadow: 0 4px 20px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.12);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.25);
    transform: translateY(-2px);
  }
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
  box-shadow: none;
  background: var(--escrow-hero-stat-gradient);
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--escrow-border-light, rgba(255, 255, 255, 0.1));
}

@keyframes checkpoint-pulse {
  0%, 100% {
    box-shadow: 0 0 6px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.3);
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    box-shadow: 0 0 18px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.6), 0 0 36px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.15);
    transform: translate(-50%, -50%) scale(1.15);
  }
}

@keyframes progress-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-progress-fill, .hero-checkpoint--done .checkpoint-dot { animation: none; }
}
</style>
