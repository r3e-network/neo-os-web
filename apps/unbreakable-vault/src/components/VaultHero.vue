<template>
  <div class="hero-container">
    <HeroSection variant="erobo-neo" compact>
      <template #background>
        <div class="vault-scene" aria-hidden="true">
          <div class="vault-door">
            <div class="vault-handle" />
            <div class="vault-lock" aria-hidden="true">&#x1F512;</div>
          </div>
        </div>
      </template>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ myVaultCount }}</span>
            <span class="hero-stat-label">{{ t("create") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ recentVaultCount }}</span>
            <span class="hero-stat-label">{{ t("break") }}</span>
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
  myVaultCount: number;
  recentVaultCount: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-container {
  margin-bottom: 20px;
}

.vault-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 90px;
}

.vault-door {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.1), rgba(0, 229, 153, 0.05));
  border: 2px solid rgba(0, 229, 153, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.vault-handle {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(0, 229, 153, 0.3);
  border-radius: 50%;
  position: absolute;
  top: 10px;
  right: 10px;
}

.vault-lock {
  font-size: 20px;
  margin-top: 8px;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(0, 229, 153, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
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

/* -- Vault Hero Enhancements -- */
@keyframes vault-lock-rotate {
  0%,
  70% {
    transform: rotate(0deg);
  }
  75% {
    transform: rotate(-15deg);
  }
  80% {
    transform: rotate(10deg);
  }
  85% {
    transform: rotate(-8deg);
  }
  90% {
    transform: rotate(5deg);
  }
  95% {
    transform: rotate(-2deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes vault-laser-grid {
  0% {
    background-position: 0 0;
    opacity: 0.3;
  }
  50% {
    background-position: 10px 10px;
    opacity: 0.6;
  }
  100% {
    background-position: 0 0;
    opacity: 0.3;
  }
}

@keyframes vault-steel-gradient {
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

@keyframes vault-door-glow {
  0%,
  100% {
    box-shadow:
      0 0 16px rgba(0, 229, 153, 0.1),
      inset 0 0 12px rgba(0, 229, 153, 0.05);
  }
  50% {
    box-shadow:
      0 0 32px rgba(0, 229, 153, 0.25),
      inset 0 0 20px rgba(0, 229, 153, 0.1);
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(75, 85, 99, 0.06), rgba(192, 192, 192, 0.04));
  background-size: 200% 200%;
  animation: vault-steel-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(107, 114, 128, 0.1),
    inset 0 1px 0 rgba(192, 192, 192, 0.08);
  border: 1px solid rgba(107, 114, 128, 0.12);
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0, 229, 153, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 229, 153, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    animation: vault-laser-grid 6s linear infinite;
    pointer-events: none;
    z-index: 0;
  }
}

.vault-door {
  animation: vault-door-glow 4s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

.vault-handle {
  animation: vault-lock-rotate 6s ease-in-out infinite;
  transform-origin: center;
  box-shadow: 0 0 8px rgba(0, 229, 153, 0.2);
}

.hero-stat {
  box-shadow: 0 0 16px rgba(107, 114, 128, 0.1);
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(192, 192, 192, 0.04));
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .vault-door,
  .vault-handle,
  .hero-container {
    animation: none;
  }
  .hero-container::before {
    animation: none;
  }
}
</style>
