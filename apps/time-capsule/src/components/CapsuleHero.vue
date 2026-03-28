<template>
  <div class="hero-container">
    <HeroSection variant="erobo-neo" icon="locked" compact>
      <template #background>
        <div class="capsule-scene" aria-hidden="true">
          <div class="capsule-graphic">
            <div class="capsule-top" />
            <div class="capsule-body">
              <div class="capsule-band" />
            </div>
            <div class="capsule-glow" />
          </div>
        </div>
      </template>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ totalCapsules }}</span>
            <span class="hero-stat-label">{{ t("sidebarTotalCapsules") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ lockedCount }}</span>
            <span class="hero-stat-label">{{ t("sidebarLocked") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ revealedCount }}</span>
            <span class="hero-stat-label">{{ t("sidebarRevealed") }}</span>
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
  totalCapsules: number;
  lockedCount: number;
  revealedCount: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-container {
  margin-bottom: 20px;
  background: radial-gradient(ellipse at 50% 40%, rgba(0, 229, 153, 0.08) 0%, transparent 55%);
}

.capsule-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 110px;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.03), transparent);
}

.capsule-graphic {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.capsule-top {
  width: 40px;
  height: 20px;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.3), rgba(0, 229, 153, 0.15));
  border-radius: 20px 20px 0 0;
  border: 1px solid rgba(0, 229, 153, 0.3);
  border-bottom: none;
}

.capsule-body {
  width: 50px;
  height: 40px;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.15), rgba(0, 229, 153, 0.05));
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 0 0 6px 6px;
  position: relative;
}

.capsule-band {
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, rgba(0, 229, 153, 0.2), rgba(0, 229, 153, 0.5), rgba(0, 229, 153, 0.2));
  box-shadow: 0 0 8px rgba(0, 229, 153, 0.3);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.capsule-glow {
  position: absolute;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle, rgba(0, 229, 153, 0.15), transparent 70%);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: wormhole-spin 6s linear infinite;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0, 229, 153, 0.1);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(0, 229, 153, 0.25);
    transform: translateY(-2px);
  }
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.05), transparent);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
  box-shadow: inset 0 1px 0 rgba(0, 229, 153, 0.06);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  animation: clock-tick 2s ease-in-out infinite;
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

@keyframes wormhole-spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) rotate(180deg) scale(1.3);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg) scale(1);
    opacity: 0.5;
  }
}

@keyframes clock-tick {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(6deg); }
  20% { transform: rotate(0deg); }
}

@media (prefers-reduced-motion: reduce) {
  .capsule-glow,
  .hero-stat-value {
    animation: none;
  }
}
</style>
