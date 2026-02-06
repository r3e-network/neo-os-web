<template>
  <view
    :class="['neo-card', `neo-card--${variant}`, { 'neo-card--hoverable': hoverable, 'neo-card--flat': flat }]"
    :role="hoverable ? 'button' : undefined"
    :tabindex="hoverable ? 0 : undefined"
    @click="hoverable && $emit('click', $event)"
    @keydown.enter="hoverable && $emit('click', $event as any)"
    @keydown.space.prevent="hoverable && $emit('click', $event as any)"
  >
    <view v-if="title || $slots.header" class="neo-card__header">
      <text v-if="title" class="neo-card__title">{{ title }}</text>
      <slot name="header" />
    </view>
    <view class="neo-card__body">
      <slot />
    </view>
    <view v-if="$slots.footer" class="neo-card__footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<script setup lang="ts">
export type CardVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "erobo"
  | "erobo-neo"
  | "erobo-bitcoin";

withDefaults(
  defineProps<{
    title?: string;
    variant?: CardVariant;
    hoverable?: boolean;
    flat?: boolean;
  }>(),
  {
    title: undefined,
    variant: "default",
    hoverable: false,
    flat: false,
  }
);

defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.neo-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: var(--card-radius, 20px);
  box-shadow: 0 4px 20px var(--shadow-color, rgba(0, 0, 0, 0.1));
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  color: var(--text-primary, #ffffff);

  &--flat {
    box-shadow: none;
    background: transparent;
    border: none;
    backdrop-filter: none;
  }

  &--hoverable {
    cursor: pointer;
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 50px rgba(27, 27, 47, 0.18);
      border-color: rgba(159, 157, 243, 0.35);
      background: rgba(255, 255, 255, 0.08);
    }
    &:active {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
    &:focus-visible {
      outline: 2px solid var(--accent-primary, #3b82f6);
      outline-offset: 2px;
    }
  }

  // Variants with E-Robo Glass Gradients
  &--accent {
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(0, 229, 153, 0.05) 100%);
    border-color: rgba(0, 229, 153, 0.3);
    box-shadow: 0 0 25px rgba(0, 229, 153, 0.15);
  }

  &--success {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%);
    border-color: rgba(16, 185, 129, 0.3);
    box-shadow: 0 0 25px rgba(16, 185, 129, 0.15);
  }

  &--warning {
    background: linear-gradient(135deg, rgba(253, 224, 71, 0.15) 0%, rgba(253, 224, 71, 0.05) 100%);
    border-color: rgba(253, 224, 71, 0.3);
    box-shadow: 0 0 25px rgba(253, 224, 71, 0.15);
  }

  &--danger {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%);
    border-color: rgba(239, 68, 68, 0.3);
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.15);
  }

  // E-Robo Wallet Style Variants
  &--erobo {
    background: linear-gradient(135deg, rgba(159, 157, 243, 0.15) 0%, rgba(123, 121, 209, 0.08) 100%);
    border-color: rgba(159, 157, 243, 0.25);
    box-shadow: 0 0 30px rgba(159, 157, 243, 0.15);
    backdrop-filter: blur(50px);
    -webkit-backdrop-filter: blur(50px);

    &.neo-card--hoverable:hover {
      box-shadow: 0 0 40px rgba(159, 157, 243, 0.3);
      border-color: rgba(159, 157, 243, 0.4);
    }
  }

  &--erobo-neo {
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.15) 0%, rgba(0, 179, 119, 0.08) 100%);
    border-color: rgba(0, 229, 153, 0.25);
    box-shadow: 0 0 30px rgba(0, 229, 153, 0.15);
    backdrop-filter: blur(50px);
    -webkit-backdrop-filter: blur(50px);

    &.neo-card--hoverable:hover {
      box-shadow: 0 0 40px rgba(0, 229, 153, 0.3);
      border-color: rgba(0, 229, 153, 0.4);
    }
  }

  &--erobo-bitcoin {
    background: linear-gradient(135deg, rgba(255, 228, 195, 0.15) 0%, rgba(255, 200, 140, 0.08) 100%);
    border-color: rgba(255, 228, 195, 0.25);
    box-shadow: 0 0 30px rgba(255, 228, 195, 0.15);
    backdrop-filter: blur(50px);
    -webkit-backdrop-filter: blur(50px);

    &.neo-card--hoverable:hover {
      box-shadow: 0 0 40px rgba(255, 228, 195, 0.3);
      border-color: rgba(255, 228, 195, 0.4);
    }
  }

  &__header {
    padding: 20px;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary, rgba(255, 255, 255, 0.9));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: $font-family;
  }

  &__body {
    padding: 20px;
  }

  &__footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    background: var(--bg-secondary, rgba(0, 0, 0, 0.2));
  }
}
</style>
