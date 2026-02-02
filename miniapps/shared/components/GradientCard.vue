<template>
  <view
    :class="['gradient-card', `gradient-card--${variant}`, { 'gradient-card--hoverable': hoverable }]"
    :style="cardStyle"
    @click="hoverable && $emit('click', $event)"
  >
    <view v-if="glow" class="gradient-card__glow" :style="glowStyle" />
    <view class="gradient-card__content">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type GradientVariant = "purple" | "neo" | "bitcoin" | "glass" | "dark";

const props = withDefaults(
  defineProps<{
    variant?: GradientVariant;
    hoverable?: boolean;
    glow?: boolean;
    glowIntensity?: number;
  }>(),
  {
    variant: "glass",
    hoverable: false,
    glow: false,
    glowIntensity: 0.3,
  },
);

defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const gradients: Record<GradientVariant, string> = {
  purple: "linear-gradient(135deg, rgba(159, 157, 243, 0.2) 0%, rgba(123, 121, 209, 0.1) 100%)",
  neo: "linear-gradient(135deg, rgba(0, 229, 153, 0.2) 0%, rgba(0, 179, 119, 0.1) 100%)",
  bitcoin: "linear-gradient(135deg, rgba(255, 228, 195, 0.2) 0%, rgba(255, 200, 140, 0.1) 100%)",
  glass: "rgba(255, 255, 255, 0.03)",
  dark: "rgba(0, 0, 0, 0.4)",
};

const glowColors: Record<GradientVariant, string> = {
  purple: "rgba(159, 157, 243, 0.4)",
  neo: "rgba(0, 229, 153, 0.4)",
  bitcoin: "rgba(255, 228, 195, 0.4)",
  glass: "rgba(255, 255, 255, 0.1)",
  dark: "rgba(0, 0, 0, 0.2)",
};

const cardStyle = computed(() => ({
  background: gradients[props.variant],
}));

const glowStyle = computed(() => ({
  background: glowColors[props.variant],
  opacity: props.glowIntensity,
}));
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;
.gradient-card {
  position: relative;
  border-radius: var(--card-radius, 20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(var(--blur-radius, 50px));
  -webkit-backdrop-filter: blur(var(--blur-radius, 50px));
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  &__glow {
    position: absolute;
    width: 150%;
    height: 150%;
    top: -25%;
    left: -25%;
    filter: blur(60px);
    pointer-events: none;
    z-index: 0;
  }

  &__content {
    position: relative;
    z-index: 1;
    padding: 20px;
  }

  &--hoverable {
    cursor: pointer;

    &:hover {
      transform: translateY(-4px) scale(1.01);
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: var(--erobo-glow, 0 0 30px rgba(159, 157, 243, 0.3));
    }

    &:active {
      transform: translateY(-1px) scale(1);
    }
  }

  &--purple {
    border-color: rgba(159, 157, 243, 0.2);
  }

  &--neo {
    border-color: rgba(0, 229, 153, 0.2);
  }

  &--bitcoin {
    border-color: rgba(255, 228, 195, 0.2);
  }
}
</style>
