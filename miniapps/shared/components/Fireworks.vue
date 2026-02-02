<template>
  <view v-if="active" class="fireworks-container">
    <view v-for="i in 12" :key="i" :class="`firework firework-${i}`" :style="getFireworkStyle(i)">
      <view v-for="j in 8" :key="j" :class="`spark spark-${j}`" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    active?: boolean;
    duration?: number;
  }>(),
  {
    active: false,
    duration: 3000,
  }
);

const emit = defineEmits<{
  (e: "complete"): void;
}>();

let timer: ReturnType<typeof setTimeout> | null = null;

const getFireworkStyle = (index: number) => {
  const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bd6", "#a855f7"];
  const x = 10 + Math.random() * 80;
  const y = 10 + Math.random() * 60;
  const delay = Math.random() * 0.5;
  const color = colors[(index - 1) % colors.length];
  
  return {
    left: `${x}%`,
    top: `${y}%`,
    animationDelay: `${delay}s`,
    "--firework-color": color,
  };
};

watch(
  () => props.active,
  (newVal) => {
    if (newVal) {
      timer = setTimeout(() => {
        emit("complete");
      }, props.duration);
    }
  }
);

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style lang="scss" scoped>
.fireworks-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.firework {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--firework-color, #ffd93d);
  animation: explode 1s ease-out forwards;
}

.spark {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--firework-color, #ffd93d);
  animation: spark-fly 0.8s ease-out forwards;
}

@for $i from 1 through 8 {
  .spark-#{$i} {
    $angle: ($i - 1) * 45deg;
    --spark-x: cos($angle) * 60px;
    --spark-y: sin($angle) * 60px;
    animation-delay: #{($i - 1) * 0.02}s;
  }
}

@keyframes explode {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  50% {
    transform: scale(2);
    opacity: 1;
  }
  100% {
    transform: scale(0);
    opacity: 0;
  }
}

@keyframes spark-fly {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--spark-x, 40px), var(--spark-y, 40px)) scale(0);
    opacity: 0;
  }
}

// Stagger firework animations
@for $i from 1 through 12 {
  .firework-#{$i} {
    animation-delay: #{$i * 0.15}s;
  }
}
</style>
