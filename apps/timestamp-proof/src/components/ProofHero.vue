<template>
  <div class="hero-container">
    <HeroSection variant="erobo" compact>
      <template #background>
        <div class="stamp-scene" aria-hidden="true">
          <div class="stamp-seal">
            <div class="stamp-ring" />
            <span class="stamp-text">&#x2726;</span>
          </div>
        </div>
      </template>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ totalProofs }}</span>
            <span class="hero-stat-label">{{ t("totalProofs") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ yourProofs }}</span>
            <span class="hero-stat-label">{{ t("yourProofs") }}</span>
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
  totalProofs: number;
  yourProofs: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-container {
  margin-bottom: 20px;
}

.stamp-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
}

.stamp-seal {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stamp-ring {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(159, 157, 243, 0.3);
  border-radius: 50%;
  border-style: dashed;
  animation: stamp-rotate 10s linear infinite;
}

.stamp-text {
  font-size: 20px;
  color: rgba(159, 157, 243, 0.6);
}

@keyframes stamp-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
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

/* -- Timestamp Proof Hero Enhancements -- */
@keyframes ts-clock-tick {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(90deg);
  }
  50% {
    transform: rotate(180deg);
  }
  75% {
    transform: rotate(270deg);
  }
}

@keyframes ts-stamp-impression {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(159, 157, 243, 0.15);
    transform: scale(1);
  }
  15% {
    transform: scale(1.1);
    box-shadow: 0 0 32px rgba(159, 157, 243, 0.4);
  }
  30% {
    transform: scale(0.97);
    box-shadow: 0 0 20px rgba(159, 157, 243, 0.25);
  }
  45% {
    transform: scale(1);
    box-shadow: 0 0 12px rgba(159, 157, 243, 0.15);
  }
}

@keyframes ts-silver-gradient {
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
  background: linear-gradient(135deg, rgba(159, 157, 243, 0.1), rgba(107, 114, 128, 0.06), rgba(192, 192, 192, 0.05));
  background-size: 200% 200%;
  animation: ts-silver-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 24px rgba(159, 157, 243, 0.08),
    inset 0 1px 0 rgba(159, 157, 243, 0.1);
  border: 1px solid rgba(159, 157, 243, 0.1);
  border-radius: 16px;
  padding: 20px;
}

.stamp-seal {
  animation: ts-stamp-impression 5s ease-in-out infinite;
  background: radial-gradient(circle, rgba(159, 157, 243, 0.15), transparent 70%);
}

.stamp-ring {
  border-color: rgba(159, 157, 243, 0.4);
  box-shadow: 0 0 8px rgba(159, 157, 243, 0.2);
}

.stamp-text {
  animation: ts-clock-tick 8s steps(4) infinite;
  display: inline-block;
}

.hero-stat {
  box-shadow: 0 0 16px rgba(159, 157, 243, 0.1);
  background: linear-gradient(135deg, rgba(159, 157, 243, 0.1), rgba(107, 114, 128, 0.04));
}

@media (prefers-reduced-motion: reduce) {
  .stamp-seal,
  .stamp-ring,
  .stamp-text,
  .hero-container {
    animation: none;
  }
}
</style>
