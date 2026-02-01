<template>
  <view class="turtle-grid-wrapper">
    <!-- Pond Ripples Background -->
    <view class="pond-waves">
      <view class="wave wave1"></view>
      <view class="wave wave2"></view>
      <view class="wave wave3"></view>
      
      <!-- Sub-aquatic Shadows -->
      <view class="grass-shadows">
        <view class="grass grass1"></view>
        <view class="grass grass2"></view>
      </view>
    </view>

    <view class="turtle-grid">
      <view 
        v-for="(turtle, index) in gridTurtles" 
        :key="index"
        :class="['turtle-grid__cell', { 
          'turtle-grid__cell--empty': !turtle,
          'turtle-grid__cell--matched': !!turtle && matchedIds.includes(turtle.id)
        }]"
      >
        <TurtleSprite 
          v-if="turtle"
          :color="turtle.color"
          :matched="matchedIds.includes(turtle.id)"
          size="md"
        />
        <view v-else class="turtle-grid__placeholder">
          <view class="ripple-effect" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Turtle } from "@/shared/composables/useTurtleMatch";
import TurtleSprite from "./TurtleSprite.vue";

const props = defineProps<{
  gridTurtles: (Turtle | null)[];
  matchedPair?: number[];
}>();

const matchedIds = computed(() => {
  if (!props.matchedPair || props.matchedPair.length === 0) return [];
  return props.matchedPair
    .map(pos => props.gridTurtles[pos]?.id)
    .filter((id): id is number => id !== undefined);
});
</script>

<style lang="scss" scoped>
.turtle-grid-wrapper {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 2px solid rgba(16, 185, 129, 0.3);
  box-shadow: 
    inset 0 0 40px rgba(0, 0, 0, 0.5),
    0 10px 30px rgba(0, 0, 0, 0.3);
  transform: perspective(1000px) rotateX(10deg);
  transform-style: preserve-3d;
}

.pond-waves {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.wave {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border: 1px solid rgba(56, 189, 248, 0.1);
  border-radius: 50%;
  animation: ripple 6s linear infinite;
}

.wave2 { animation-delay: 2s; }
.wave3 { animation-delay: 4s; }

@keyframes ripple {
  0% { width: 0%; height: 0%; opacity: 0; }
  5% { opacity: 0.5; }
  100% { width: 250%; height: 250%; opacity: 0; }
}

.grass-shadows {
  position: absolute;
  inset: 0;
  opacity: 0.1;
  filter: blur(20px);
}

.grass {
  position: absolute;
  background: #10b981;
  border-radius: 50% 50% 0 0;
  animation: sway 10s infinite ease-in-out;
}

.grass1 {
  width: 100px;
  height: 300px;
  bottom: -50px;
  left: 10%;
}

.grass2 {
  width: 150px;
  height: 400px;
  bottom: -100px;
  right: 5%;
  animation-delay: -5s;
}

@keyframes sway {
  0%, 100% { transform: rotate(-5deg) skewX(-2deg); }
  50% { transform: rotate(5deg) skewX(2deg); }
}

.turtle-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 24px;
}

.turtle-grid__cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(16, 185, 129, 0.4);
    transform: translateY(-2px);
  }
}

.turtle-grid__cell--empty {
  background: radial-gradient(circle at center, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
  border: 1px dashed rgba(16, 185, 129, 0.2);
}

.turtle-grid__cell--matched {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(245, 158, 11, 0.6);
  z-index: 2;
}

.turtle-grid__placeholder {
  position: relative;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ripple-effect {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(16, 185, 129, 0.2);
  animation: cell-ripple 2s ease-out infinite;
}

@keyframes cell-ripple {
  0% { transform: scale(0.5); opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}
</style>
