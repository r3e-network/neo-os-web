<template>
  <view
    class="scroll-reveal"
    :class="[animation, { 'is-visible': isVisible }]"
    :style="{ transitionDelay: delay + 'ms', transitionDuration: duration + 'ms' }"
  >
    <slot />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, getCurrentInstance, onUnmounted } from 'vue';

interface Props {
  animation?: 'fade-up' | 'fade-down' | 'scale-in' | 'slide-left' | 'slide-right';
  delay?: number;
  duration?: number;
  threshold?: number;
  offset?: number;
  reversible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  animation: 'fade-up',
  delay: 0,
  duration: 800,
  threshold: 0.1,
  offset: -50,
  reversible: false
});

const isVisible = ref(false);
const instance = getCurrentInstance();
let observer: any = null;

onMounted(() => {
  // Small delay to ensure DOM is ready
  setTimeout(() => {
    if (!instance) return;
    
    // Failsafe: Ensure content shows up eventually if observer fails
    setTimeout(() => {
      if (!isVisible.value) {
        isVisible.value = true;
      }
    }, 500);

    // @ts-ignore - uni global is available in UniApp environment
    observer = uni.createIntersectionObserver(instance);
    
    observer
      .relativeToViewport({ bottom: props.offset })
      .observe('.scroll-reveal', (res: any) => {
        if (res.intersectionRatio > 0) {
          isVisible.value = true;
          // Only disconnect if not reversible
          if (!props.reversible) {
             observer.disconnect();
          }
        } else {
             if (props.reversible) {
                 isVisible.value = false;
             }
        }
      });
  }, 100);
});

defineExpose({ isVisible });

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<style lang="scss" scoped>
.scroll-reveal {
  opacity: 0;
  transition-property: opacity, transform;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1); // Smooth "Out Expo"ish
  will-change: opacity, transform;

  // Animation Variants
  &.fade-up {
    transform: translateY(40px);
  }
  
  &.fade-down {
    transform: translateY(-40px);
  }

  &.scale-in {
    transform: scale(0.92);
  }
  
  &.slide-left {
    transform: translateX(40px);
  }

  &.slide-right {
    transform: translateX(-40px);
  }

  // Active State
  &.is-visible {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}
</style>
