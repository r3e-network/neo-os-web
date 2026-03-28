<template>
  <div class="hero-container">
    <HeroSection variant="erobo-neo" compact>
      <template #background>
        <div class="multisig-scene" aria-hidden="true">
          <div class="key-group">
            <AppIcon name="key" :size="24" class="key-icon key-icon--active" aria-hidden="true" />
            <AppIcon name="key" :size="24" class="key-icon key-icon--active" aria-hidden="true" />
            <AppIcon name="key" :size="24" class="key-icon key-icon--inactive" aria-hidden="true" />
          </div>
          <span class="key-label">{{ t("multisigThreshold") }}</span>
        </div>
      </template>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ pendingCount }}</span>
            <span class="hero-stat-label">{{ t("statPending") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ completedCount }}</span>
            <span class="hero-stat-label">{{ t("statCompleted") }}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value">{{ totalCount }}</span>
            <span class="hero-stat-label">{{ t("sidebarTotalTxs") }}</span>
          </div>
        </div>
      </template>
    </HeroSection>
  </div>
</template>

<script setup lang="ts">
import { HeroSection } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  pendingCount: number;
  completedCount: number;
  totalCount: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-container {
  margin-bottom: 20px;
  background: radial-gradient(ellipse at center, rgba(0, 229, 153, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

.multisig-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 80px;
  justify-content: center;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.04) 0%, transparent 100%);
}

.key-group {
  display: flex;
  gap: 12px;
  background: linear-gradient(90deg, rgba(0, 229, 153, 0.06) 0%, rgba(0, 180, 120, 0.03) 50%, rgba(0, 229, 153, 0.06) 100%);
  background-size: 200% 100%;
  animation: shield-gradient 6s ease infinite;
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 229, 153, 0.1);
}

.key-icon {
  font-size: 24px;
  transition: opacity 0.3s;
}

.key-icon--active {
  opacity: 1;
  filter: drop-shadow(0 0 8px rgba(0, 229, 153, 0.5));
  animation: key-rotate 5s ease-in-out infinite;
  display: inline-block;
}

.key-icon--active:nth-child(2) {
  animation-delay: 1s;
  animation-direction: reverse;
}

.key-icon--inactive {
  opacity: 0.3;
}

.key-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 2px;
  text-shadow: 0 0 8px rgba(0, 229, 153, 0.4);
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(0, 180, 120, 0.06) 100%);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
  animation: lock-pulse-glow 4s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 24px rgba(0, 229, 153, 0.3);
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
  text-shadow: 0 0 8px rgba(0, 229, 153, 0.3);
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

@keyframes key-rotate {
  0%, 100% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(15deg) scale(1.1); }
  50% { transform: rotate(0deg) scale(1); }
  75% { transform: rotate(-10deg) scale(1.05); }
}

@keyframes shield-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes lock-pulse-glow {
  0%, 100% {
    box-shadow: 0 0 12px rgba(0, 229, 153, 0.1), 0 0 24px rgba(0, 229, 153, 0.05);
    border-color: rgba(0, 229, 153, 0.15);
  }
  50% {
    box-shadow: 0 0 22px rgba(0, 229, 153, 0.25), 0 0 44px rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .key-icon--active, .key-group, .hero-stat {
    animation: none;
  }
}
</style>
