<template>
  <view v-if="visible" class="game-splash" :class="{ 'splash-exit': exit }">
    <view class="splash-content">
      <view class="logo-container">
        <view class="turtle-glow" />
        <TurtleSprite :color="TurtleColor.Gold" matched size="lg" />
      </view>
      
      <view class="title-container">
        <text class="game-name">{{ t("splashTitle") }}</text>
        <text class="game-subtitle">{{ t("splashSubtitle") }}</text>
      </view>

      <view class="loading-bar">
        <view class="loading-progress" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { TurtleColor } from "@/shared/composables/useTurtleMatch";
import { useI18n } from "@/composables/useI18n";
import TurtleSprite from "./TurtleSprite.vue";

const props = defineProps<{
  visible: boolean;
}>();

const { t } = useI18n();
const exit = ref(false);
const emit = defineEmits<{
  (e: "complete"): void;
}>();

let exitTimer: ReturnType<typeof setTimeout> | null = null;
let completeTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  exitTimer = setTimeout(() => {
    exit.value = true;
    completeTimer = setTimeout(() => {
      emit("complete");
    }, 800);
  }, 2500);
});

onUnmounted(() => {
  if (exitTimer) clearTimeout(exitTimer);
  if (completeTimer) clearTimeout(completeTimer);
});
</script>

<style lang="scss" scoped>
.game-splash {
  position: fixed;
  inset: 0;
  background: var(--turtle-overlay-backdrop-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  transition: opacity 0.8s ease;
}

.splash-exit {
  opacity: 0;
  pointer-events: none;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

.logo-container {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.turtle-glow {
  position: absolute;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, transparent 70%);
  animation: glow-pulse 2s infinite ease-in-out;
}

.title-container {
  text-align: center;
}

.game-name {
  font-size: 40px;
  font-weight: 900;
  color: var(--turtle-overlay-text);
  letter-spacing: 4px;
  text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
  display: block;
}

.game-subtitle {
  font-size: 11px;
  font-weight: 700;
  color: var(--turtle-primary);
  letter-spacing: 8px;
  margin-top: 10px;
  display: block;
}

.loading-bar {
  width: 200px;
  height: 4px;
  background: var(--turtle-overlay-surface);
  border-radius: 2px;
  overflow: hidden;
}

.loading-progress {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--turtle-primary), var(--turtle-secondary));
  animation: load-slide 2.5s ease-in-out forwards;
}

@keyframes load-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes glow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.2); opacity: 0.4; }
}
</style>
