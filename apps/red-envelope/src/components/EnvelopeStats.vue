<template>
  <div class="hero-envelope-stats">
    <div class="hero-stat">
      <span class="hero-stat-emoji" aria-hidden="true">&#x1F9E7;</span>
      <span class="hero-stat-value">{{ envelopeCount }}</span>
      <span class="hero-stat-label">{{ t("sidebarEnvelopes") }}</span>
    </div>
    <div class="hero-stat-divider" />
    <div class="hero-stat">
      <span class="hero-stat-emoji" aria-hidden="true">&#x1F4B0;</span>
      <span class="hero-stat-value">{{ poolCount }}</span>
      <span class="hero-stat-label">{{ t("sidebarPools") }}</span>
    </div>
    <div class="hero-stat-divider" />
    <div class="hero-stat">
      <span class="hero-stat-emoji" aria-hidden="true">&#x2728;</span>
      <span class="hero-stat-value">{{ claimCount }}</span>
      <span class="hero-stat-label">{{ t("sidebarClaims") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * EnvelopeStats.vue — Stats summary row for the red envelope hero section.
 * Shows envelope, pool, and claim counts in a compact pill layout.
 */
defineProps<{
  envelopeCount: number;
  poolCount: number;
  claimCount: number;
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/red-envelope-theme.scss" as *;

.hero-envelope-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--envelope-stat-bg);
  border: 1px solid var(--envelope-stat-border);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.hero-stat-emoji {
  font-size: 18px;
  margin-bottom: 2px;
}

.hero-stat-value {
  font-size: 24px;
  font-weight: 900;
  color: var(--envelope-stat-value);
  font-family: $font-mono;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.hero-stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--envelope-stat-label);
}

.hero-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--envelope-divider);
}

@media (max-width: 480px) {
  .hero-envelope-stats {
    padding: 12px 16px;
    gap: 12px;
  }
  .hero-stat-value {
    font-size: 18px;
  }
  .hero-stat-label {
    font-size: 9px;
  }
}
</style>
