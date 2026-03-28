<template>
  <div class="hero-container">
    <HeroSection variant="erobo" compact>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ activeCount }}</span>
            <span class="hero-stat-label">{{ t("active") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ votingPower }}</span>
            <span class="hero-stat-label">{{ t("votingPower") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ totalProposals }}</span>
            <span class="hero-stat-label">{{ t("totalProposals") }}</span>
          </div>
        </div>
      </template>
    </HeroSection>
  </div>
</template>

<script setup lang="ts">
import { HeroSection } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  activeCount: number;
  votingPower: number;
  totalProposals: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/council-governance-theme.scss" as *;

.hero-container {
  margin-bottom: 20px;
  background: radial-gradient(ellipse at center, rgba(100, 80, 220, 0.12) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(100, 80, 220, 0.1) 0%, rgba(159, 157, 243, 0.06) 100%);
  box-shadow: 0 0 12px rgba(159, 157, 243, 0.08);
  animation: vote-count-glow 4s ease-in-out infinite;
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 22px rgba(100, 80, 220, 0.3);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.5s;
}

.hero-stat:nth-child(3) {
  animation-delay: 1s;
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  text-shadow: 0 0 8px rgba(100, 80, 220, 0.3);
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

:deep(.hero-icon) {
  animation: gavel-swing 5s ease-in-out infinite;
  transform-origin: 70% 90%;
}

@keyframes vote-count-glow {
  0%,
  100% {
    box-shadow:
      0 0 12px rgba(100, 80, 220, 0.12),
      0 0 24px rgba(100, 80, 220, 0.05);
  }
  50% {
    box-shadow:
      0 0 20px rgba(100, 80, 220, 0.25),
      0 0 40px rgba(100, 80, 220, 0.1);
  }
}

@keyframes gavel-swing {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 0.85;
  }
  15% {
    transform: rotate(12deg) scale(1.05);
    opacity: 1;
  }
  30% {
    transform: rotate(-3deg) scale(1);
    opacity: 0.9;
  }
  45% {
    transform: rotate(6deg) scale(1.02);
    opacity: 0.95;
  }
  60% {
    transform: rotate(0deg) scale(1);
    opacity: 0.85;
  }
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
