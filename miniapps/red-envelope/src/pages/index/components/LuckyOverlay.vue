<template>
  <view v-if="luckyMessage" class="lucky-overlay" @click="$emit('close')">
    <view class="lucky-card-glass" @click.stop>
      <view class="card-glow"></view>
      
      <view class="lucky-content">
        <text class="lucky-header">🎉 {{ t("congratulations") }} 🎉</text>
        
        <view class="amount-circle">
          <view class="amount-inner">
            <text class="lucky-amount">{{ luckyMessage.amount }}</text>
            <text class="lucky-currency">GAS</text>
          </view>
        </view>

        <view class="sender-pill">
          <text class="from-label">{{ t("fromPrefix") }}</text>
          <text class="from-address">{{ luckyMessage.from }}</text>
        </view>

        <NeoButton variant="primary" size="lg" block class="confirm-btn" @click="$emit('close')">
          <text>{{ t("confirm") }}</text>
        </NeoButton>
      </view>

      <view class="coins-rain">
        <view v-for="i in 15" :key="i" class="coin-item" :style="{ animationDelay: `${Math.random() * 2}s`, left: `${Math.random() * 100}%` }">
          <AppIcon name="money" :size="24" class="text-gold" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { AppIcon, NeoButton } from "@shared/components";

defineProps<{
  luckyMessage: { amount: number; from: string } | null;
  t: (key: string) => string;
}>();

defineEmits(["close"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.lucky-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(15px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

.lucky-card-glass {
  position: relative;
  width: 85%;
  max-width: 380px;
  background: rgba(30, 10, 10, 0.8);
  border: 1px solid rgba(255, 69, 58, 0.3);
  border-radius: 32px;
  overflow: hidden;
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(220, 38, 38, 0.2);
  animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.card-glow {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 200px;
  background: radial-gradient(circle at top center, rgba(239, 68, 68, 0.4) 0%, transparent 70%);
  pointer-events: none;
}

.lucky-content {
  position: relative;
  z-index: 2;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lucky-header {
  font-size: 18px;
  font-weight: 800;
  color: #FCD34D;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 32px;
  text-shadow: 0 0 15px rgba(253, 224, 71, 0.4);
}

.amount-circle {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.2);
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.05);
    animation: pulse-ring 2s infinite;
  }
}

.amount-inner {
  text-align: center;
}

.lucky-amount {
  display: block;
  font-size: 56px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: $font-family;
  line-height: 1;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
}

.lucky-currency {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-top: 4px;
}

.sender-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 32px;
}

.from-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.from-address {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: $font-mono;
}

.confirm-btn {
  width: 100%;
}

.coins-rain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.coin-item {
  position: absolute;
  top: -50px;
  animation: rain 2.5s linear infinite;
}

.text-gold {
  color: #FCD34D;
  filter: drop-shadow(0 0 5px rgba(253, 224, 71, 0.5));
}

@keyframes rain {
  0% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(500px) rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.2); opacity: 0; }
}
</style>
