<template>
  <NeoCard class="gas-tank-card">
    <view class="gas-tank-container">
      <view class="gas-tank">
        <!-- Technical Grid Background -->
        <view class="tank-grid"></view>

        <!-- Graduation Marks -->
        <view class="tank-graduations">
          <view class="graduation-mark" style="top: 20%"></view>
          <view class="graduation-mark" style="top: 40%"></view>
          <view class="graduation-mark" style="top: 60%"></view>
          <view class="graduation-mark" style="top: 80%"></view>
        </view>

        <view class="tank-body">
          <view class="fuel-level" :style="{ height: fuelLevelPercent + '%' }">
            <view class="fuel-surface"></view>
            <!-- Bubbles for liquid effect -->
            <view class="fuel-bubble b1"></view>
            <view class="fuel-bubble b2"></view>
            <view class="fuel-bubble b3"></view>
          </view>
          <view class="tank-glass-highlight"></view>
          <view class="tank-gauge">
            <text class="gauge-label">GAS</text>
            <text class="gauge-value">{{ formatBalance(gasBalance) }}</text>
          </view>
        </view>
      </view>
      <view class="tank-status">
        <view :class="['status-indicator', isEligible ? 'eligible' : 'full']">
          <text class="status-icon">{{ isEligible ? "⚡" : "✓" }}</text>
          <text class="status-text">{{ isEligible ? t("needsFuel") : t("tankFull") }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  fuelLevelPercent: number;
  gasBalance: string;
  isEligible: boolean;
  t: (key: string) => string;
}>();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.gas-tank-card { margin-bottom: 16px; }
.gas-tank-container { display: flex; flex-direction: column; align-items: center; padding: 24px; gap: 24px; }

.gas-tank {
  position: relative;
  width: 140px;
  height: 180px;
  background: var(--gas-tank-bg);
  border: 1px solid var(--gas-tank-border);
  border-radius: 24px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  box-shadow: var(--gas-tank-shadow);
}

/* Technical Grid Overlay */
.tank-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(var(--gas-tank-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--gas-tank-grid) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
  z-index: 1;
}

.tank-graduations {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 20px;
  z-index: 4;
}

.graduation-mark {
  position: absolute;
  right: 0;
  width: 8px;
  height: 1px;
  background: var(--gas-tank-graduation);
  &::before {
    content: '';
    position: absolute;
    right: 18px;
    top: -3px;
    font-size: 8px;
    color: var(--gas-text-muted);
  }
}

.tank-glass-highlight {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 40px;
  height: 120px;
  background: var(--gas-tank-highlight);
  border-radius: 12px;
  pointer-events: none;
  z-index: 5;
}

.fuel-level {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, var(--gas-fuel-start) 0%, var(--gas-fuel-end) 100%);
  transition: height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: var(--gas-fuel-shadow);
  z-index: 2;
  overflow: hidden;
}

.fuel-surface {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gas-fuel-surface);
  box-shadow: var(--gas-fuel-surface-shadow);
}

/* Bubbles Animation */
.fuel-bubble {
  position: absolute;
  background: var(--gas-bubble);
  border-radius: 50%;
  animation: bubble-rise 4s infinite ease-in;
  bottom: -10px;
}

.b1 { width: 6px; height: 6px; left: 20%; animation-duration: 3s; animation-delay: 0s; }
.b2 { width: 4px; height: 4px; left: 50%; animation-duration: 5s; animation-delay: 1s; }
.b3 { width: 8px; height: 8px; left: 80%; animation-duration: 4s; animation-delay: 2s; }

@keyframes bubble-rise {
  0% { transform: translateY(0); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(-100px); opacity: 0; }
}

.tank-gauge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gas-text-secondary);
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  text-shadow: 0 1px 3px var(--gas-inset-shadow);
}

.gauge-value {
  font-size: 28px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--gas-text);
  text-shadow: 0 2px 10px var(--gas-inset-shadow);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border: 1px solid var(--gas-status-pill-border);
  border-radius: 99px;
  background: var(--gas-status-pill-bg);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;

  &.eligible {
    border-color: var(--gas-status-eligible-border);
    color: var(--gas-status-eligible-text);
    box-shadow: var(--gas-status-eligible-shadow);
  }

  &.full {
    border-color: var(--gas-status-full-border);
    color: var(--gas-status-full-text);
    box-shadow: var(--gas-status-full-shadow);
  }
}

.status-text {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
