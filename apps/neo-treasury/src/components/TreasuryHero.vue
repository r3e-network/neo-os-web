<template>
  <div class="hero-container">
    <HeroSection variant="erobo-bitcoin" compact>
      <template #stats>
        <div class="hero-stats">
          <div class="hero-stat">
            <AppIcon name="money" :size="18" class="hero-stat-icon" aria-hidden="true" />
            <span class="hero-stat-value">{{ totalUsdLabel }}</span>
            <span class="hero-stat-label">{{ t("sidebarTotalUsd") }}</span>
          </div>
          <div class="hero-stat">
            <AppIcon name="green_circle" :size="18" class="hero-stat-icon" aria-hidden="true" />
            <span class="hero-stat-value">{{ totalNeoLabel }}</span>
            <span class="hero-stat-label">{{ t("tokenNeo") }}</span>
          </div>
          <div class="hero-stat">
            <AppIcon name="fuel" :size="18" class="hero-stat-icon" aria-hidden="true" />
            <span class="hero-stat-value">{{ totalGasLabel }}</span>
            <span class="hero-stat-label">{{ t("tokenGas") }}</span>
          </div>
        </div>
      </template>
    </HeroSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HeroSection } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  totalUsd?: number;
  totalNeo?: number;
  totalGas?: number;
}>();

const totalUsdLabel = computed(() =>
  props.totalUsd ? `$${props.totalUsd.toLocaleString()}` : props.t("notAvailable"),
);
const totalNeoLabel = computed(() => props.totalNeo?.toLocaleString() ?? props.t("notAvailable"));
const totalGasLabel = computed(() => props.totalGas?.toLocaleString() ?? props.t("notAvailable"));
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-container {
  margin-bottom: 20px;
  background: radial-gradient(ellipse at 50% 40%, rgba(255, 222, 89, 0.08) 0%, transparent 55%);
}

.hero-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  box-shadow: 0 4px 20px rgba(255, 222, 89, 0.1);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(255, 222, 89, 0.25);
    transform: translateY(-2px);
  }
}

.hero-stat {
  text-align: center;
  padding: 8px 14px;
  background: linear-gradient(180deg, rgba(255, 222, 89, 0.04), transparent);
  border-radius: 8px;
  border: 1px solid rgba(255, 222, 89, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 222, 89, 0.08);
}

.hero-stat-icon {
  display: block;
  font-size: 18px;
  margin-bottom: 4px;
  animation: counter-tick 3s ease-in-out infinite;
}

.hero-stat-value {
  display: block;
  font-size: 16px;
  font-weight: 800;
  color: var(--treasury-gold, var(--text-primary));
  font-family: var(--font-family-display, "Cinzel", serif);
  background: linear-gradient(90deg, var(--treasury-gold), var(--treasury-light-gold, #fff8dc), var(--treasury-gold));
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gold-shimmer 4s linear infinite;
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

@keyframes gold-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes counter-tick {
  0%, 100% { transform: translateY(0); }
  10% { transform: translateY(-2px); }
  20% { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-stat-value,
  .hero-stat-icon {
    animation: none;
  }
}
</style>
