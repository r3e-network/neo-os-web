<template>
  <NeoCard variant="erobo" class="security-dashboard-glass">
    <view class="scanner-line"></view>
    <view class="shield-container">
      <view class="shield-ring" :class="securityLevelClass"></view>
      <view class="shield-core">🛡️</view>
      <view class="shield-pulse" :class="securityLevelClass"></view>
    </view>

    <view class="security-info">
      <text class="security-label">{{ t("securityLevel") }}</text>
      <text :class="['security-value', securityLevelClass]">{{ securityLevel }}</text>
    </view>

    <view class="security-meter-glass">
      <view class="meter-bar-glass" :style="{ width: securityPercentage + '%' }" :class="securityLevelClass">
        <view class="meter-glint"></view>
      </view>
      <view class="meter-grid"></view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  securityLevel: string;
  securityLevelClass: string;
  securityPercentage: number;
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.security-dashboard-glass {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  gap: 16px;
}

.scanner-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(0, 229, 153, 0.5);
  box-shadow: 0 0 10px var(--ops-success);
  animation: scan 3s linear infinite;
  opacity: 0.3;
  z-index: 0;
}

.shield-container {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.shield-core {
  font-size: 48px;
  z-index: 2;
  filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.5));
}

.shield-ring {
  position: absolute;
  inset: -10px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  animation: spin-slow 10s linear infinite;

  &.level-critical {
    border-color: var(--ops-danger);
  }
  &.level-high {
    border-color: var(--ops-warning);
  }
  &.level-medium {
    border-color: var(--ops-success);
  }
}

.shield-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, currentColor, transparent);
  opacity: 0.2;
  animation: pulse 2s infinite;

  &.level-critical {
    color: var(--ops-danger);
  }
  &.level-high {
    color: var(--ops-warning);
  }
  &.level-medium {
    color: var(--ops-success);
  }
  &.level-low {
    color: transparent;
  }
}

.security-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 4px;
}

.security-value {
  font-size: 32px;
  font-weight: 900;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.level-critical {
    color: var(--ops-danger);
    text-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
  }
  &.level-high {
    color: var(--ops-warning);
    text-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
  }
  &.level-medium {
    color: var(--ops-success);
    text-shadow: 0 0 20px rgba(0, 229, 153, 0.4);
  }
}

.security-meter-glass {
  width: 100%;
  max-width: 240px;
  height: 12px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.meter-bar-glass {
  height: 100%;
  position: relative;
  transition: width 0.5s ease-out;

  &.level-critical {
    background: linear-gradient(90deg, var(--ops-danger-deep), var(--ops-danger));
  }
  &.level-high {
    background: linear-gradient(90deg, var(--ops-warning-deep), var(--ops-warning));
  }
  &.level-medium {
    background: linear-gradient(90deg, var(--ops-success-deep), var(--ops-success));
  }
  &.level-low {
    background: rgba(255, 255, 255, 0.2);
  }
}

.meter-glint {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: translateX(-100%);
  animation: glimmer 2s infinite;
}

.meter-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(90deg, rgba(0, 0, 0, 0.5) 1px, transparent 1px);
  background-size: 10% 100%;
}

@keyframes scan {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  10% {
    opacity: 0.5;
  }
  90% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(300px);
    opacity: 0;
  }
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.2;
  }
  50% {
    transform: scale(1.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

@keyframes glimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
