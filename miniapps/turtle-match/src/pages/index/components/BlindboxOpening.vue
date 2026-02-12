<template>
  <view v-if="visible" class="blindbox-opening">
    <view class="blindbox-opening__backdrop" />
    
    <!-- Cyber Capsule -->
    <view :class="['capsule-container', { 'capsule-container--opening': isOpening }]">
      <view class="capsule">
        <view class="capsule-top">
          <view class="capsule-rim" />
          <!-- Holographic Scanner -->
          <view class="hologram-scanner" />
        </view>
        <view class="capsule-bottom">
          <view class="capsule-glow" />
        </view>
        <view class="capsule-core">
          <text class="core-text">{{ t("neoSymbol") }}</text>
        </view>
      </view>
      
      <!-- Energy Beam & Holographic Projection -->
      <view v-if="isOpening" class="projection-beam" />
      <view v-if="isOpening" class="energy-beam" />
    </view>

    <!-- Reveal Area -->
    <view v-if="showTurtle" class="blindbox-opening__reveal">
      <view class="reveal-glow" :style="{ '--glow-color': turtleColorHex }" />
      <TurtleSprite :color="turtleColor" size="lg" />
    </view>

    <!-- UI Particles -->
    <view v-if="isOpening" class="blindbox-opening__particles">
      <view v-for="i in 16" :key="i" class="blindbox-opening__particle" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { TurtleColor, COLOR_CSS } from "@/shared/composables/useTurtleMatch";
import TurtleSprite from "./TurtleSprite.vue";

const props = defineProps<{
  visible: boolean;
  turtleColor: TurtleColor;
}>();

const emit = defineEmits<{
  (e: "complete"): void;
}>();

const { t } = useI18n();

const isOpening = ref(false);
const showTurtle = ref(false);

const turtleColorHex = computed(() => COLOR_CSS[props.turtleColor]);

let openingTimer: ReturnType<typeof setTimeout> | null = null;
let turtleTimer: ReturnType<typeof setTimeout> | null = null;
let completeTimer: ReturnType<typeof setTimeout> | null = null;

function clearAllTimers() {
  if (openingTimer) { clearTimeout(openingTimer); openingTimer = null; }
  if (turtleTimer) { clearTimeout(turtleTimer); turtleTimer = null; }
  if (completeTimer) { clearTimeout(completeTimer); completeTimer = null; }
}

watch(() => props.visible, (val) => {
  clearAllTimers();
  if (val) {
    isOpening.value = false;
    showTurtle.value = false;
    openingTimer = setTimeout(() => {
      isOpening.value = true;
    }, 200);
    turtleTimer = setTimeout(() => {
      showTurtle.value = true;
    }, 1000);
    completeTimer = setTimeout(() => {
      emit("complete");
    }, 2500);
  }
});

onUnmounted(() => {
  clearAllTimers();
});
</script>

<style lang="scss" scoped>
.blindbox-opening {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.blindbox-opening__backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, var(--turtle-overlay-backdrop) 0%, var(--turtle-overlay-backdrop-strong) 100%);
  backdrop-filter: blur(20px);
}

.capsule-container {
  position: relative;
  width: 120px;
  height: 180px;
  perspective: 1000px;
  
  &--opening {
    animation: capsule-burst 0.8s forwards;
    
    .capsule-top { transform: translateY(-100px) rotateX(-45deg); opacity: 0; }
    .capsule-bottom { transform: translateY(100px) rotateX(45deg); opacity: 0; }
    .capsule-core { transform: scale(3); opacity: 0; }
  }
}

.capsule {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  animation: float 2s ease-in-out infinite;
}

.capsule-top, .capsule-bottom {
  width: 120px;
  height: 80px;
  background: linear-gradient(135deg, var(--turtle-panel-dark) 0%, var(--turtle-panel-darker) 100%);
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    inset 0 0 20px rgba(255, 255, 255, 0.05),
    0 10px 40px rgba(0, 0, 0, 0.5);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.capsule-top {
  border-radius: 60px 60px 10px 10px;
  background: linear-gradient(to bottom, var(--turtle-panel-mid), var(--turtle-panel-dark));
}

.capsule-bottom {
  border-radius: 10px 10px 60px 60px;
  background: linear-gradient(to top, var(--turtle-panel-mid), var(--turtle-panel-dark));
}

.capsule-rim {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 8px;
  background: var(--turtle-primary);
  box-shadow: 0 0 15px var(--turtle-primary);
}

.capsule-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background: var(--turtle-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s ease;
  box-shadow: 0 0 30px var(--turtle-primary);
}

.core-text {
  font-size: 14px;
  font-weight: 800;
  color: var(--turtle-overlay-text);
  letter-spacing: 1px;
}

.hologram-scanner {
  position: absolute;
  top: 10px;
  left: 0;
  width: 100%;
  height: 2px;
  background: rgba(16, 185, 129, 0.4);
  box-shadow: 0 0 10px var(--turtle-primary);
  animation: scan-move 1s infinite alternate ease-in-out;
}

.projection-beam {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 300px;
  background: conic-gradient(from 150deg at 50% 0%, transparent 0deg, rgba(16, 185, 129, 0.1) 30deg, transparent 60deg);
  filter: blur(10px);
  animation: beam-flicker 0.1s infinite;
}

@keyframes scan-move {
  from { top: 10px; }
  to { top: 70px; }
}

@keyframes beam-flicker {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.6; }
}

.energy-beam {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 0;
  background: var(--turtle-overlay-text);
  box-shadow: 0 0 40px 10px var(--turtle-primary);
  animation: beam-grow 0.4s ease-out forwards;
}

@keyframes beam-grow {
  0% { height: 0; opacity: 1; }
  100% { height: 600px; opacity: 0; }
}

.blindbox-opening__reveal {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reveal-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
  opacity: 0.4;
  animation: glow-pulse 2s infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

@keyframes beam-grow {
  0% { height: 0; opacity: 1; }
  100% { height: 600px; opacity: 0; }
}

@keyframes capsule-burst {
  0% { transform: scale(1); }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes glow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.3); opacity: 0.5; }
}

/* Particles from common library or local */
.blindbox-opening__particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--turtle-overlay-text);
  border-radius: 50%;
  @for $i from 1 through 16 {
    &:nth-child(#{$i}) {
      animation: particle-burst 1.5s ease-out forwards;
      --angle: #{$i * 22.5}deg;
    }
  }
}

@keyframes particle-burst {
  0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(200px); opacity: 0; }
}
</style>
