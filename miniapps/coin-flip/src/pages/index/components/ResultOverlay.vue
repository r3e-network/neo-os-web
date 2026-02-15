<template>
  <view v-if="visible" class="cinematic-overlay" @click="$emit('close')">
    <view class="overlay-backdrop" />

    <view class="overlay-content" :class="{ 'is-win': Number(winAmount) > 0 }" aria-live="polite" role="status">
      <image
        v-if="Number(winAmount) > 0"
        src="@/static/holo_winner.png"
        class="winner-title-img"
        mode="aspectFit"
        :alt="t('winnerTitle')"
      />
      <view v-else class="congrats-text">{{ t("overlayUnlucky") }}</view>

      <view class="reward-circle">
        <view class="glow-ring" />
        <view class="content">
          <text v-if="Number(winAmount) > 0" class="amount">+{{ winAmount }}</text>
          <text v-else class="amount">0</text>
          <text class="unit">GAS</text>
        </view>
      </view>

      <view class="win-label">{{ Number(winAmount) > 0 ? t("overlayWinLabel") : t("overlayLoseLabel") }}</view>

      <view class="tap-hint">{{ t("overlayTapContinue") }}</view>
    </view>

    <!-- Background FX -->
    <view v-if="Number(winAmount) > 0" class="fx-layer">
      <view v-for="i in 20" :key="i" class="sparkle" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  visible: boolean;
  winAmount: string;
}>();

defineEmits(["close"]);
</script>

<style lang="scss" scoped>
.cinematic-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.overlay-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(2, 6, 23, 0.95) 0%, rgba(10, 10, 15, 1) 100%);
  backdrop-filter: blur(10px);
}

.overlay-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  animation: entry-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.congrats-text {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 6px;
  color: var(--coin-gold);
  text-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
}

.winner-title-img {
  width: 280px;
  height: 80px;
  filter: drop-shadow(0 0 15px rgba(0, 255, 157, 0.6));
  animation: title-float 3s ease-in-out infinite;
}

@keyframes title-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.reward-circle {
  width: 200px;
  height: 200px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  .glow-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.1);
    background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
    animation: rotate-ring 4s linear infinite;

    &::before {
      content: "";
      position: absolute;
      top: -2px;
      left: 50%;
      width: 10px;
      height: 10px;
      background: var(--coin-gold);
      border-radius: 50%;
      box-shadow: 0 0 20px var(--coin-gold);
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;

    .amount {
      font-size: 64px;
      font-weight: 900;
      color: var(--coin-white);
      line-height: 1;
    }
    .unit {
      font-size: 16px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 2px;
    }
  }
}

.win-label {
  font-size: 18px;
  font-weight: 700;
  color: var(--coin-white);
  opacity: 0.8;
}

.tap-hint {
  margin-top: 40px;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 2px;
  animation: fade-blink 1.5s infinite;
}

.is-win {
  .congrats-text {
    color: var(--coin-success);
    text-shadow: 0 0 20px var(--coin-success);
  }
  .reward-circle .glow-ring::before {
    background: var(--coin-success);
    box-shadow: 0 0 20px var(--coin-success);
  }
  .amount {
    color: var(--coin-success);
  }
}

@keyframes entry-pulse {
  from {
    transform: scale(0.8) translateY(20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes rotate-ring {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fade-blink {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.6;
  }
}

/* Sparkles FX */
.sparkle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  background: var(--coin-success);
  border-radius: 50%;

  &:nth-child(even) {
    background: var(--coin-gold);
  }

  @for $i from 1 through 20 {
    &:nth-child(#{$i}) {
      animation: particle-fly 1.5s ease-out infinite;
      animation-delay: #{$i * 0.1}s;
      --tx: #{(random(400) - 200)}px;
      --ty: #{(random(400) - 200)}px;
    }
  }
}

@keyframes particle-fly {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(0);
    opacity: 0;
  }
}
</style>
