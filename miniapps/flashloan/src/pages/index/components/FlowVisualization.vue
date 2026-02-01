<template>
  <NeoCard variant="erobo-neo" class="flow-card">

    
    <view class="flow-diagram-glass">
      <!-- Step 1: Borrow -->
      <view class="flow-step">
        <view class="step-icon-container">
          <text class="step-icon">💰</text>
          <view class="step-ring"></view>
        </view>
        <text class="step-label">{{ t("borrow") }}</text>
      </view>

      <!-- Connector 1 -->
      <view class="flow-connector">
        <view class="connector-line">
          <view class="connector-pulse"></view>
        </view>
        <text class="connector-arrow">►</text>
      </view>

      <!-- Step 2: Execute -->
      <view class="flow-step">
        <view class="step-icon-container active">
          <text class="step-icon">🔄</text>
          <view class="step-ring pulse"></view>
        </view>
        <text class="step-label highlight">{{ t("execute") }}</text>
      </view>

      <!-- Connector 2 -->
      <view class="flow-connector">
        <view class="connector-line">
          <view class="connector-pulse delay"></view>
        </view>
        <text class="connector-arrow">►</text>
      </view>

      <!-- Step 3: Repay -->
      <view class="flow-step">
        <view class="step-icon-container">
          <text class="step-icon">✓</text>
          <view class="step-ring"></view>
        </view>
        <text class="step-label">{{ t("repay") }}</text>
      </view>
    </view>

    <view class="flow-note-glass">
      <view class="note-icon">ℹ️</view>
      <text class="note-text">{{ t("flowNote") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.flow-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 20px;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.flow-diagram-glass {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  position: relative;
  padding: 0 10px;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 2;
}

.step-icon-container {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(20, 20, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);

  &.active {
    border-color: #00e599;
    background: radial-gradient(circle, rgba(0, 229, 153, 0.1) 0%, rgba(20, 20, 30, 0.9) 70%);
    box-shadow: 0 0 20px rgba(0, 229, 153, 0.2);
  }
}

.step-icon {
  font-size: 24px;
  position: relative;
  z-index: 2;
}

.step-ring {
  position: absolute;
  top: -4px; right: -4px; bottom: -4px; left: -4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  
  &.pulse {
    border-color: rgba(0, 229, 153, 0.3);
    animation: ring-pulse 2s infinite;
  }
}

.step-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
  
  &.highlight {
    color: #00e599;
    text-shadow: 0 0 10px rgba(0, 229, 153, 0.4);
  }
}

.flow-connector {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 0 -10px;
  top: -14px; /* Align with icon center */
  z-index: 1;
}

.connector-line {
  height: 2px;
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.connector-pulse {
  position: absolute;
  top: 0; bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, #00e599, transparent);
  animation: connector-flow 1.5s infinite linear;
  
  &.delay {
    animation-delay: 0.75s;
  }
}

.connector-arrow {
  color: var(--text-muted);
  font-size: 10px;
  margin-left: -4px;
}

.flow-note-glass {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.note-icon {
  font-size: 14px;
}

.note-text {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  font-weight: 500;
}

@keyframes ring-pulse {
  0% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}

@keyframes connector-flow {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
</style>
