<template>
  <view v-if="visible" class="game-result">
    <view class="result-backdrop" />
    
    <view class="result-card">
      <!-- Title -->
      <view class="title-area">
        <text class="congrats-text">{{ t("sessionComplete") }}</text>
        <view class="glow-line" />
      </view>

      <!-- Stats Grid -->
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-label">{{ t("totalMatchesLabel") }}</text>
          <text class="stat-value">{{ matches }}</text>
        </view>
        <view class="stat-item highlight">
          <text class="stat-label">{{ t("totalEarnedLabel") }}</text>
          <text class="stat-value gold">{{ formattedReward }} GAS</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">{{ t("boxesOpenedLabel") }}</text>
          <text class="stat-value">{{ boxCount }}</text>
        </view>
      </view>

      <!-- Action -->
      <view class="action-area">
        <NeoButton variant="primary" size="lg" block @click="$emit('close')">
          {{ t("confirmSettlement") }}
        </NeoButton>
      </view>
    </view>

    <!-- Background Decoration -->
    <view class="result-fx">
      <view v-for="i in 20" :key="i" class="sparkle" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  visible: boolean;
  matches: number;
  reward: bigint;
  boxCount: number;
}>();

defineEmits<{
  (e: "close"): void;
}>();

const { t } = useI18n();

const formattedReward = computed(() => {
  return (Number(props.reward) / 100000000).toFixed(3);
});
</script>

<style lang="scss" scoped>
.game-result {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.result-backdrop {
  position: absolute;
  inset: 0;
  background: var(--turtle-overlay-backdrop);
  backdrop-filter: blur(20px);
}

.result-card {
  position: relative;
  width: 90%;
  max-width: 400px;
  background: var(--turtle-overlay-surface);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 30px;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: card-appear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.congrats-text {
  font-size: 10px;
  font-weight: 800;
  color: #10b981;
  letter-spacing: 5px;
  text-align: center;
  display: block;
}

.glow-line {
  height: 2px;
  background: linear-gradient(90deg, transparent, #10b981, transparent);
  margin-top: 8px;
  opacity: 0.5;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-item {
  background: var(--turtle-overlay-surface);
  border: 1px solid var(--turtle-overlay-border);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &.highlight {
    background: rgba(16, 185, 129, 0.05);
    border-color: rgba(16, 185, 129, 0.2);
  }
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--turtle-overlay-muted);
  letter-spacing: 1px;
}

.stat-value {
  font-size: 20px;
  font-weight: 900;
  color: var(--turtle-overlay-text);
  
  &.gold { color: #fbbf24; }
}

@keyframes card-appear {
  from { transform: scale(0.8) translateY(40px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.result-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #10b981;
  border-radius: 50%;
  
  &:nth-child(4n) { top: 20%; left: 30%; animation-delay: 0s; }
  &:nth-child(4n+1) { top: 60%; left: 80%; animation-delay: 1s; }
  &:nth-child(4n+2) { top: 40%; left: 10%; animation-delay: 0.5s; }
  &:nth-child(4n+3) { top: 80%; left: 50%; animation-delay: 1.5s; }
  
  animation: twinkle 3s infinite;
}

@keyframes twinkle {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.5); opacity: 0.8; }
}
</style>
