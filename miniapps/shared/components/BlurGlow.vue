<template>
  <view class="blur-glow" :style="glowStyle">
    <view class="blur-glow__effect" :style="effectStyle" />
    <view class="blur-glow__content">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type GlowColor = "purple" | "neo" | "bitcoin" | "custom";

const props = withDefaults(
  defineProps<{
    color?: GlowColor;
    customColor?: string;
    intensity?: number;
    blur?: number;
    size?: number;
    offsetX?: number;
    offsetY?: number;
  }>(),
  {
    color: "purple",
    intensity: 0.4,
    blur: 50,
    size: 100,
    offsetX: 0,
    offsetY: 0,
  }
);

const colorMap: Record<string, string> = {
  purple: "#9f9df3",
  neo: "#00e599",
  bitcoin: "#ffe4c3",
};

const glowColor = computed(() => {
  if (props.color === "custom" && props.customColor) {
    return props.customColor;
  }
  return colorMap[props.color] || colorMap.purple;
});

const glowStyle = computed(() => ({
  position: "relative" as const,
}));

const effectStyle = computed(() => ({
  position: "absolute" as const,
  width: `${props.size}%`,
  height: `${props.size}%`,
  left: `${50 + props.offsetX - props.size / 2}%`,
  top: `${50 + props.offsetY - props.size / 2}%`,
  background: glowColor.value,
  opacity: props.intensity,
  filter: `blur(${props.blur}px)`,
  borderRadius: "50%",
  pointerEvents: "none" as const,
  zIndex: 0,
}));
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;
.blur-glow {
  position: relative;
  overflow: hidden;

  &__effect {
    transition: all 0.3s ease;
  }

  &__content {
    position: relative;
    z-index: 1;
  }
}
</style>
