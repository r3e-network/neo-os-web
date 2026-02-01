<template>
  <view v-if="visible" class="match-celebration">
    <view class="match-celebration__backdrop" :style="{ '--celebration-color': turtleColorHex }" />

    <!-- Light Rays -->
    <view class="light-rays">
      <view v-for="i in 12" :key="i" class="ray" :style="{ '--angle': (i * 30) + 'deg' }" />
    </view>

    <!-- Matched turtles -->
    <view class="match-view">
      <view class="match-turtle left">
        <TurtleSprite :color="turtleColor" matched size="lg" />
      </view>
      <view class="match-text">{{ t("matchLabel") }}</view>
      <view class="match-turtle right">
        <TurtleSprite :color="turtleColor" matched size="lg" />
      </view>
    </view>

    <!-- Reward display -->
    <view class="reward-card">
      <text class="reward-title">{{ t("rewardLabel") }}</text>
      <view class="reward-amount">
        <text class="amount-val">+{{ formattedReward }}</text>
        <text class="amount-unit">GAS</text>
      </view>
    </view>

    <!-- Visual Effects -->
    <view class="fx-layer">
      <!-- Sparkles -->
      <view v-for="i in 15" :key="'s' + i" class="sparkle" />
      <!-- Coins -->
      <view v-for="i in 10" :key="'c' + i" class="flying-coin">
        <svg viewBox="0 0 100 100" class="holo-coin">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#fbbf24" stroke-width="2" />
          <circle cx="50" cy="50" r="35" fill="rgba(251, 191, 36, 0.2)" stroke="#fbbf24" stroke-width="1" />
          <path d="M40 35 L60 35 L60 45 L40 65 L60 65" fill="none" stroke="white" stroke-width="5" />
        </svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { TurtleColor, COLOR_CSS } from "@/shared/composables/useTurtleMatch";
import TurtleSprite from "./TurtleSprite.vue";

const props = defineProps<{
  visible: boolean;
  turtleColor: TurtleColor;
  reward: bigint;
}>();

const emit = defineEmits<{
  (e: "complete"): void;
}>();

const { t } = useI18n();

const turtleColorHex = computed(() => COLOR_CSS[props.turtleColor]);

const formattedReward = computed(() => {
  const gas = Number(props.reward) / 100000000;
  return gas.toFixed(3);
});

watch(() => props.visible, (val) => {
  if (val) {
    setTimeout(() => {
      emit("complete");
    }, 2500);
  }
});
</script>

<style lang="scss" scoped>
.match-celebration {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  pointer-events: none;
}

.match-celebration__backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--turtle-overlay-backdrop) 0%, var(--turtle-overlay-backdrop-strong) 100%);
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, var(--celebration-color) 0%, transparent 60%);
    opacity: 0.3;
    animation: pulse 2s infinite;
  }
}

.light-rays {
  position: absolute;
  width: 100%;
  height: 100%;
  animation: rotate 20s linear infinite;
}

.ray {
  position: absolute;
  top: 50%; left: 50%;
  width: 2px;
  height: 1000px;
  background: linear-gradient(to top, var(--celebration-color, #fff), transparent);
  transform-origin: top center;
  transform: rotate(var(--angle)) translateY(-50%);
  opacity: 0.2;
}

.match-view {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 40px;
  z-index: 10;
}

.match-text {
  font-size: 40px;
  font-weight: 900;
  color: var(--turtle-overlay-text);
  text-shadow: 0 0 20px var(--celebration-color), 0 0 40px var(--celebration-color);
  animation: text-pulse 0.5s ease-in-out infinite alternate;
}

.match-turtle {
  &.left { animation: slide-in-left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
  &.right { animation: slide-in-right 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
}

.reward-card {
  background: var(--turtle-overlay-surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--turtle-overlay-border);
  padding: 20px 40px;
  border-radius: 20px;
  text-align: center;
  animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
  z-index: 10;
}

.reward-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--celebration-color);
  letter-spacing: 4px;
  display: block;
  margin-bottom: 10px;
}

.amount-val {
  font-size: 56px;
  font-weight: 800;
  color: var(--turtle-overlay-text);
}

.amount-unit {
  font-size: 18px;
  font-weight: 700;
  color: var(--turtle-overlay-muted);
  margin-left: 10px;
}

.sparkle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: var(--turtle-overlay-text);
  border-radius: 50%;
  filter: blur(1px);
  
  &:nth-child(3n) { top: 20%; left: 30%; animation-delay: 0.1s; }
  &:nth-child(3n+1) { top: 60%; left: 80%; animation-delay: 0.5s; }
  &:nth-child(3n+2) { top: 40%; left: 10%; animation-delay: 0.9s; }
  
  animation: twinkle 1s infinite alternate;
}

@keyframes twinkle {
  0% { transform: scale(1); opacity: 0.3; }
  100% { transform: scale(2); opacity: 1; }
}

.flying-coin {
  position: absolute;
  top: 50%; left: 50%;
  width: 40px;
  height: 40px;
  perspective: 1000px;
  
  &:nth-child(5n) { --tx: -150px; --ty: -200px; animation-delay: 0.1s; }
  &:nth-child(5n+1) { --tx: 180px; --ty: -150px; animation-delay: 0.2s; }
  &:nth-child(5n+2) { --tx: -200px; --ty: 150px; animation-delay: 0.3s; }
  &:nth-child(5n+3) { --tx: 150px; --ty: 200px; animation-delay: 0.4s; }
  &:nth-child(5n+4) { --tx: 0px; --ty: -250px; animation-delay: 0.5s; }
  
  animation: coin-fly 1.5s ease-out forwards;
}

.holo-coin {
  width: 100%;
  height: 100%;
  animation: coin-rotate 1s linear infinite;
  filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.5));
}

@keyframes coin-rotate {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
}

@keyframes slide-in-left { from { transform: translateX(-200px); opacity: 0; } }
@keyframes slide-in-right { from { transform: translateX(200px); opacity: 0; } }

@keyframes text-pulse {
  from { transform: scale(1); filter: brightness(1); }
  to { transform: scale(1.1); filter: brightness(1.5); }
}

@keyframes coin-fly {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0) rotate(360deg); opacity: 0; }
}

@keyframes pop-in {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.4; } }
</style>
