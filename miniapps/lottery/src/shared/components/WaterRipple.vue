<template>
  <view class="water-ripple-container" :class="{ active: active }">
    <!-- SVG Filter Definition -->
    <svg class="water-ripple-svg" aria-hidden="true">
      <defs>
        <filter :id="filterId" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.015" numOctaves="2" seed="42" result="noise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            :scale="currentIntensity"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>

    <!-- Content with filter applied -->
    <view class="water-ripple-content" :style="contentStyle">
      <slot />
    </view>

    <!-- Visual ripple rings -->
    <view
      v-for="ripple in ripples"
      :key="ripple.id"
      class="water-ripple-ring-container"
      :style="{ left: ripple.x + 'px', top: ripple.y + 'px' }"
    >
      <view
        v-for="i in 4"
        :key="i"
        class="water-ripple-ring"
        :style="{
          animationDelay: (i - 1) * 150 + 'ms',
          animationDuration: duration + 'ms',
          borderColor: tint,
          maxWidth: maxRadius * 2 + 'px',
          maxHeight: maxRadius * 2 + 'px',
        }"
      />
      <view
        class="water-ripple-splash"
        :style="{
          animationDuration: duration * 0.3 + 'ms',
          background: tint,
        }"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    active?: boolean;
    duration?: number;
    maxRadius?: number;
    intensity?: number;
    tint?: string;
  }>(),
  {
    active: false,
    duration: 1500,
    maxRadius: 300,
    intensity: 30,
    tint: "rgba(159, 157, 243, 0.3)",
  },
);

const emit = defineEmits<{
  (e: "complete"): void;
}>();

interface Ripple {
  id: number;
  x: number;
  y: number;
}

const ripples = ref<Ripple[]>([]);
const rippleId = ref(0);
const currentIntensity = ref(0);

const filterId = computed(() => `water-ripple-filter-${rippleId.value}`);

const contentStyle = computed(() => ({
  filter: ripples.value.length > 0 ? `url(#${filterId.value})` : "none",
}));

// Create ripple at center
const createRipple = () => {
  const newRipple: Ripple = {
    id: rippleId.value++,
    x: 150, // Center position (adjust based on container)
    y: 300,
  };

  ripples.value.push(newRipple);
  currentIntensity.value = props.intensity;

  // Animate intensity decay
  const startTime = Date.now();
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / props.duration, 1);
    currentIntensity.value = props.intensity * (1 - progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  requestAnimationFrame(animate);

  // Remove ripple after duration
  setTimeout(() => {
    ripples.value = ripples.value.filter((r) => r.id !== newRipple.id);
    currentIntensity.value = 0;
    emit("complete");
  }, props.duration);
};

// Watch active prop
watch(
  () => props.active,
  (val) => {
    if (val) {
      createRipple();
    }
  },
);

onUnmounted(() => {
  ripples.value = [];
});
</script>

<style lang="scss">
.water-ripple-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.water-ripple-svg {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.water-ripple-content {
  width: 100%;
  height: 100%;
  will-change: filter;
  transition: filter 0.3s ease-out;
}

.water-ripple-ring-container {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1000;
}

.water-ripple-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 20px;
  height: 20px;
  border: 2px solid;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  opacity: 0.8;
  animation: rippleExpand ease-out forwards;
  will-change: transform, opacity;
}

.water-ripple-splash {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(1);
  opacity: 0.6;
  animation: splashFade ease-out forwards;
  will-change: transform, opacity;
}

@keyframes rippleExpand {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(15);
    opacity: 0;
  }
}

@keyframes splashFade {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
}
</style>
