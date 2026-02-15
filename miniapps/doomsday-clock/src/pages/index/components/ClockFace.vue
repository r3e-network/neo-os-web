<template>
  <NeoCard variant="erobo-bitcoin" :class="['doomsday-clock-card', dangerLevel]">
    <view class="clock-header">
      <text class="clock-label text-glass-glow">{{ t("timeUntilEvent") }}</text>
      <view :class="['danger-badge-glass', dangerLevel]">
        <text class="danger-text">{{ dangerLevelText }}</text>
      </view>
    </view>

    <view class="clock-display-glass" aria-live="polite" role="timer" :aria-label="t('timeUntilEvent')">
      <text :class="['clock-time-glass', dangerLevel, { pulse: shouldPulse }]">{{ countdown }}</text>
    </view>

    <!-- Danger Level Meter -->
    <view class="danger-meter-glass">
      <view class="meter-labels">
        <text class="meter-label text-glass">{{ t("safe") }}</text>
        <text class="meter-label text-glass">{{ t("critical") }}</text>
      </view>
      <view class="meter-bar-glass">
        <view :class="['meter-fill-glass', dangerLevel]" :style="{ width: dangerProgress + '%' }"></view>
        <view class="meter-indicator-glass" :style="{ left: dangerProgress + '%' }"></view>
      </view>
    </view>

    <!-- Event Description -->
    <view class="event-description-glass">
      <text class="event-title-glass">{{ t("nextEvent") }}</text>
      <text class="event-text-glass">{{ currentEventDescription }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  dangerLevel: string;
  dangerLevelText: string;
  shouldPulse: boolean;
  countdown: string;
  dangerProgress: number;
  currentEventDescription: string;
  t: (key: string, ...args: unknown[]) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.doomsday-clock-card {
  position: relative;
  overflow: hidden;
}

.clock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-6;
}
.clock-label {
  font-size: 12px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-primary);
}

.danger-badge-glass {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: $font-weight-black;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);

  &.low {
    background: rgba(16, 185, 129, 0.2);
    color: var(--doom-safe);
    border-color: rgba(16, 185, 129, 0.3);
  }
  &.medium {
    background: rgba(245, 158, 11, 0.2);
    color: var(--doom-warn-light);
    border-color: rgba(245, 158, 11, 0.3);
  }
  &.high {
    background: rgba(239, 68, 68, 0.2);
    color: var(--doom-danger-light);
    border-color: rgba(239, 68, 68, 0.3);
  }
  &.critical {
    background: rgba(239, 68, 68, 0.3);
    color: var(--doom-danger-light);
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
    animation: pulse-red 1s infinite alternate;
  }
}

@keyframes pulse-red {
  0% {
    box-shadow: 0 0 5px rgba(239, 68, 68, 0.4);
  }
  100% {
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.8);
  }
}

.clock-display-glass {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: $spacing-8 0;
  padding: $spacing-6;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);
}
.clock-time-glass {
  font-size: 36px;
  font-weight: $font-weight-black;
  font-family: $font-mono;
  line-height: 1;
  letter-spacing: 0.05em;
  background: linear-gradient(180deg, var(--doom-white), var(--doom-indigo-light));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 8px rgba(165, 180, 252, 0.5));

  &.critical {
    background: linear-gradient(180deg, var(--doom-white), var(--doom-danger-light));
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 0 10px rgba(248, 113, 113, 0.6));
  }
  &.pulse {
    animation: time-pulse 1s infinite alternate;
  }
}

@keyframes time-pulse {
  0% {
    opacity: 0.8;
    transform: scale(0.98);
  }
  100% {
    opacity: 1;
    transform: scale(1.02);
  }
}

.danger-meter-glass {
  margin-top: $spacing-6;
}
.meter-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.meter-label {
  font-size: 10px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.meter-bar-glass {
  height: 12px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.meter-fill-glass {
  height: 100%;
  transition: width 0.3s ease;
  /* Gradient driven by state classes */
  background: linear-gradient(90deg, var(--doom-safe), var(--doom-amber), var(--doom-red));
  &.low {
    background: linear-gradient(90deg, var(--doom-safe), var(--doom-green));
  }
  &.medium {
    background: linear-gradient(90deg, var(--doom-warn-light), var(--doom-amber));
  }
  &.high {
    background: linear-gradient(90deg, var(--doom-danger-light), var(--doom-red));
  }
  &.critical {
    background: linear-gradient(90deg, var(--doom-red), var(--doom-red-deep));
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  }
}
.meter-indicator-glass {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--doom-white);
  box-shadow: 0 0 5px var(--doom-white);
  transform: translateX(-50%);
}

.event-description-glass {
  margin-top: $spacing-6;
  padding: $spacing-4;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.event-title-glass {
  @include stat-label;
  font-size: 10px;
  display: block;
  margin-bottom: 4px;
}
.event-text-glass {
  font-size: 14px;
  font-weight: $font-weight-medium;
  color: var(--text-primary);
  line-height: 1.4;
}
</style>
