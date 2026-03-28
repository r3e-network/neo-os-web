<template>
  <div class="hero-container">
    <HeroSection variant="erobo-neo" compact>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ formatNum(totalPool, 0) }}</span>
            <span class="hero-stat-label">{{ t("totalPool") }} {{ t("tokenNeo") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ bidCount }}</span>
            <span class="hero-stat-label">{{ t("activeBids") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ currentEpoch }}</span>
            <span class="hero-stat-label">{{ t("currentEpoch") }}</span>
          </div>
        </div>
      </template>
    </HeroSection>
  </div>
</template>

<script setup lang="ts">
import { HeroSection } from "@shared/components";
import { formatNum } from "@shared/utils/format";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  totalPool: number;
  bidCount: number;
  currentEpoch: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/gov-merc-theme.scss" as *;

.hero-container {
  margin-bottom: 20px;
  background: radial-gradient(ellipse at center, rgba(120, 40, 200, 0.12) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

.hero-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-stat {
  text-align: center;
  padding: 8px 14px;
  background: linear-gradient(135deg, rgba(120, 40, 200, 0.12) 0%, rgba(0, 229, 153, 0.06) 100%);
  background-size: 200% 200%;
  animation:
    power-aura 4s ease-in-out infinite,
    merc-gradient-shift 8s ease infinite;
  border-radius: 8px;
  border: 1px solid rgba(120, 40, 200, 0.15);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 28px rgba(120, 40, 200, 0.35);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.4s;
}

.hero-stat:nth-child(3) {
  animation-delay: 0.8s;
}

.hero-stat-value {
  display: block;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: var(--font-family-mono, "Courier New", monospace);
  text-shadow: 0 0 8px rgba(120, 40, 200, 0.35);
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

@keyframes power-aura {
  0%,
  100% {
    box-shadow:
      0 0 15px rgba(120, 40, 200, 0.1),
      0 0 30px rgba(120, 40, 200, 0.05);
  }
  50% {
    box-shadow:
      0 0 25px rgba(120, 40, 200, 0.25),
      0 0 50px rgba(120, 40, 200, 0.1),
      0 0 80px rgba(120, 40, 200, 0.05);
  }
}

@keyframes merc-gradient-shift {
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

@keyframes sword-cross {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 0.85;
  }
  25% {
    transform: rotate(8deg) scale(1.06);
    opacity: 1;
  }
  50% {
    transform: rotate(-5deg) scale(0.98);
    opacity: 0.8;
  }
  75% {
    transform: rotate(3deg) scale(1.03);
    opacity: 0.95;
  }
}

:deep(.hero-icon) {
  animation: sword-cross 4s ease-in-out infinite;
  transform-origin: center center;
}

@media (prefers-reduced-motion: reduce) {
  .hero-stat {
    animation: none;
  }
  :deep(.hero-icon) {
    animation: none;
  }
}
</style>
