<template>
  <view class="neo-stats">
    <view
      v-for="stat in stats"
      :key="stat.label"
      class="neo-stats__item"
      :class="`neo-stats__item--${stat.variant || 'default'}`"
    >
      <text class="neo-stats__value">{{ stat.value }}</text>
      <text class="neo-stats__label">{{ stat.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
export interface StatItem {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "danger" | "warning" | "accent" | "erobo" | "erobo-neo" | "erobo-bitcoin";
}

defineProps<{
  stats: StatItem[];
}>();
</script>

<style lang="scss">
@use "@shared/styles/tokens.scss" as *;

.neo-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  &__item {
    background: var(--bg-card, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    border-radius: 20px;
    padding: 16px;
    text-align: center;
    backdrop-filter: blur(10px);
    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

    &:hover {
      transform: translateY(-2px);
      background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
      border-color: rgba(159, 157, 243, 0.3);
    }

    &--success .neo-stats__value {
      color: #00e599;
      text-shadow: 0 0 10px rgba(0, 229, 153, 0.2);
    }
    &--danger .neo-stats__value {
      color: #ef4444;
      text-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
    }
    &--warning .neo-stats__value {
      color: #fde047;
      text-shadow: 0 0 10px rgba(253, 224, 71, 0.2);
    }
    &--accent .neo-stats__value {
      color: #00e599;
      text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
    }
    &--erobo .neo-stats__value {
      color: #9f9df3;
      text-shadow: 0 0 15px rgba(159, 157, 243, 0.4);
    }
    &--erobo-neo .neo-stats__value {
      color: #00e599;
      text-shadow: 0 0 15px rgba(0, 229, 153, 0.4);
    }
    &--erobo-bitcoin .neo-stats__value {
      color: #ffde59;
      text-shadow: 0 0 15px rgba(255, 222, 89, 0.4);
    }
  }

  &__value {
    display: block;
    font-size: 24px;
    font-weight: 800;
    color: var(--text-primary, #ffffff);
    font-family: $font-family;
    margin-bottom: 4px;
  }

  &__label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}
</style>
