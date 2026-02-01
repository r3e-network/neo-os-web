<template>
  <view class="hero-section">
    <view class="hero-badge">
      <text class="badge-icon">🔐</text>
      <text class="badge-text">{{ title }}</text>
    </view>
    <text class="hero-title">{{ headline }}</text>
    <text class="hero-subtitle">{{ subtitle }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  headline: string;
  subtitle: string;
}>();
</script>

<style lang="scss" scoped>
.hero-section {
  position: relative;
  z-index: 10;
  text-align: center;
  margin-bottom: 32px;
  padding-top: 20px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--multi-accent-soft);
  border: 1px solid var(--multi-accent-border);
  border-radius: 20px;
  padding: 6px 16px;
  margin-bottom: 16px;
}

.badge-icon {
  font-size: 16px;
}

.badge-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--multi-accent);
}

.hero-title {
  display: block;
  font-size: 28px;
  font-weight: 800;
  color: var(--multi-text);
  margin-bottom: 12px;
  line-height: 1.2;
}

.hero-subtitle {
  display: block;
  font-size: 14px;
  color: var(--multi-text-muted);
  max-width: 280px;
  margin: 0 auto;
  line-height: 1.5;
}

@media (max-width: 767px) {
  .hero-section {
    margin-bottom: 24px;
    padding-top: 12px;
  }
  .hero-title {
    font-size: 22px;
  }
}

@media (min-width: 1024px) {
  .hero-title {
    font-size: 32px;
  }
}
</style>
