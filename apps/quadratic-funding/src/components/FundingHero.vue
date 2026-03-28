<template>
  <div class="hero-container">
    <span class="hero-label">{{ t("appName") }}</span>
    <div class="hero-progress-ring">
      <svg viewBox="0 0 120 120" class="ring-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="url(#qfRingGrad)"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringOffset"
          transform="rotate(-90 60 60)"
          class="ring-progress"
        />
        <defs>
          <linearGradient id="qfRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--qf-ring-start, #f472b6)" />
            <stop offset="100%" stop-color="var(--qf-ring-end, #ec4899)" />
          </linearGradient>
        </defs>
      </svg>
      <div class="ring-center">
        <span class="ring-value">{{ progressPct }}%</span>
        <span class="ring-sub">{{ t("tabRounds") }}</span>
      </div>
    </div>
    <div class="hero-stats-row">
      <div class="hero-stat">
        <span class="hero-stat-label">{{ t("sidebarMatchingPool") }}</span>
        <span class="hero-stat-value">{{ matchingPoolDisplay }}</span>
      </div>
      <div class="hero-stat-divider" />
      <div class="hero-stat">
        <span class="hero-stat-label">{{ t("tabProjects") }}</span>
        <span class="hero-stat-value">{{ projectCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const RING_R = 52;
const ringCircumference = 2 * Math.PI * RING_R;

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPct: number;
  matchingPoolDisplay: string;
  projectCount: number;
}>();

const ringOffset = computed(() => ringCircumference - (props.progressPct / 100) * ringCircumference);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/quadratic-funding-theme.scss" as *;

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05), rgba(236, 72, 153, 0.06));
  background-size: 200% 200%;
  animation: qf-emerald-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(16, 185, 129, 0.08),
    inset 0 1px 0 rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.1);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  animation: qf-sprout-grow 4s ease-in-out infinite;
  transform-origin: bottom center;
}

.hero-progress-ring {
  position: relative;
  width: 120px;
  height: 120px;
  animation: qf-funding-circle-pulse 3s ease-in-out infinite;
  border-radius: 50%;
}

.ring-svg {
  width: 100%;
  height: 100%;
  animation: qf-ring-glow 3s ease-in-out infinite;
}

.ring-progress {
  transition: stroke-dashoffset 0.8s ease;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-value {
  font-size: 24px;
  font-weight: 700;
}

.ring-sub {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 24px;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.08);
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
  background: var(--border-subtle, rgba(255, 255, 255, 0.1));
}

@keyframes qf-sprout-grow {
  0% { transform: scaleY(0.7) translateY(4px); opacity: 0.6; }
  50% { transform: scaleY(1.05) translateY(-2px); opacity: 1; }
  100% { transform: scaleY(1) translateY(0); opacity: 0.9; }
}

@keyframes qf-funding-circle-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3); }
  50% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0), 0 0 24px rgba(16, 185, 129, 0.15); }
}

@keyframes qf-emerald-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes qf-ring-glow {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(236, 72, 153, 0.2)); }
  50% { filter: drop-shadow(0 0 16px rgba(236, 72, 153, 0.4)); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-container,
  .hero-label,
  .hero-progress-ring,
  .ring-svg {
    animation: none;
  }
}
</style>
