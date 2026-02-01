<template>
  <NeoCard variant="erobo" class="countdown-hero-card">
    <!-- Main Info Group -->
    <view class="hero-header">
      <view class="status-indicator" :class="{ ready: canCheckIn, done: !canCheckIn }">
        <view class="indicator-dot"></view>
        <text class="indicator-text">{{ canCheckIn ? t("ready") : t("checkedInToday") }}</text>
      </view>
      <view class="utc-clock">
        <text class="clock-label">{{ t('utcClock') }}</text>
        <text class="clock-time">{{ utcTimeDisplay }}</text>
      </view>
    </view>

    <view class="visualization-area">
      <view class="countdown-circle">
        <svg class="countdown-ring" viewBox="0 0 220 220">
          <circle class="countdown-ring-bg" cx="110" cy="110" r="99" />
          <circle
            class="countdown-ring-progress"
            cx="110"
            cy="110"
            r="99"
            :style="{ strokeDashoffset: countdownProgress }"
          />
        </svg>
        <view class="countdown-content">
          <text class="time-remaining">{{ countdownLabel }}</text>
          <text class="time-label">{{ t("nextCheckin") }}</text>
        </view>
      </view>

      <view class="status-card" :class="{ glow: canCheckIn }">
        <view class="status-icon-box" :class="{ 'glow-icon': canCheckIn }">
          <AppIcon :name="canCheckIn ? 'star' : 'check'" :size="24" />
        </view>
        <view class="status-info">
          <text class="status-main">{{ canCheckIn ? t("notCheckedIn") : t("checkedInToday") }}</text>
          <text class="status-sub">
            {{ canCheckIn ? t("statusReady") : t("statusDone") }}
          </text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { AppIcon, NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

defineProps<{
  countdownProgress: number;
  countdownLabel: string;
  canCheckIn: boolean;
  utcTimeDisplay: string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.countdown-hero-card {
  margin-bottom: 24px;
  overflow: hidden;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.4);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 100px;
  backdrop-filter: blur(5px);

  &.ready {
    background: rgba(255, 222, 89, 0.1);
    color: #ffde59;
    border-color: rgba(255, 222, 89, 0.3);
    .indicator-dot {
      background: #ffde59;
      animation: pulse 1s infinite;
      box-shadow: 0 0 10px rgba(255, 222, 89, 0.5);
    }
  }

  &.done {
    background: rgba(0, 229, 153, 0.1);
    color: #00e599;
    border-color: rgba(0, 229, 153, 0.3);
    .indicator-dot {
      background: #00e599;
      box-shadow: 0 0 10px rgba(0, 229, 153, 0.5);
    }
  }
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.indicator-text {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.utc-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.clock-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-bottom: 2px;
  letter-spacing: 0.05em;
}

.clock-time {
  font-family: $font-mono;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, white);
}

.visualization-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  gap: 24px;
}

.countdown-circle {
  position: relative;
  width: 180px;
  height: 180px;
}

.countdown-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.05);
  stroke-width: 14;
}

.countdown-ring-progress {
  fill: none;
  stroke: #00e599;
  stroke-width: 14;
  stroke-linecap: round;
  stroke-dasharray: 622;
  transition: stroke-dashoffset 1s linear;
  filter: drop-shadow(0 0 4px rgba(0, 229, 153, 0.3));
}

.countdown-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.time-remaining {
  font-family: $font-mono;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary, white);
  text-shadow: 0 0 20px rgba(0, 229, 153, 0.3);
}

.time-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-top: 4px;
}

.status-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  transition: all 0.3s;
  backdrop-filter: blur(10px);

  &.glow {
    background: linear-gradient(90deg, rgba(255, 222, 89, 0.05) 0%, rgba(255, 222, 89, 0.01) 100%);
    border-color: rgba(255, 222, 89, 0.2);
  }
}

.status-icon-box {
  width: 48px;
  height: 48px;
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));

  &.glow-icon {
    background: rgba(255, 222, 89, 0.1);
    color: #ffde59;
    box-shadow: 0 0 15px rgba(255, 222, 89, 0.2);
  }
}

.status-info {
  flex: 1;
}

.status-main {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, white);
  margin-bottom: 2px;
  text-transform: uppercase;
}

.status-sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}
</style>
