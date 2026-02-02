<template>
  <NeoCard variant="erobo" class="hero-card">
    <view class="fire-container">
      <view class="flame flame-1"></view>
      <view class="flame flame-2"></view>
      <view class="flame flame-3"></view>
    </view>
    <view class="hero-content">
      <text class="hero-label">{{ t("totalBurned") }}</text>
      <text class="hero-value">{{ formatNum(totalBurned) }}</text>
      <text class="hero-suffix">GAS</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  totalBurned: number;
  t: (key: string) => string;
}>();

const formatNum = (n: number) => {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-card {
  text-align: center;
  padding: 16px 16px;
  position: relative;
  overflow: hidden;
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 107, 107, 0.3);
  box-shadow: 0 0 30px rgba(255, 107, 107, 0.1);
}

.fire-container {
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  opacity: 0.6;
  filter: blur(10px);
}

.flame {
  width: 40px;
  height: 60px;
  background: radial-gradient(circle at bottom, #F97316, transparent 70%);
  border-radius: 50% 50% 20% 20%;
  animation: neo-flicker 2s infinite alternate ease-in-out;
  margin: 0 -10px;
  opacity: 0.7;
  
  &.flame-1 { animation-delay: 0s; height: 70px; background: radial-gradient(circle at bottom, #EF4444, transparent 70%); }
  &.flame-2 { animation-delay: 0.5s; height: 90px; background: radial-gradient(circle at bottom, #F59E0B, transparent 70%); z-index: 1; }
  &.flame-3 { animation-delay: 1.0s; height: 60px; background: radial-gradient(circle at bottom, #EF4444, transparent 70%); }
}

@keyframes neo-flicker {
  0% { transform: scaleY(1) translateY(0); opacity: 0.5; }
  100% { transform: scaleY(1.2) translateY(-10px); opacity: 0.8; }
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  display: block;
}

.hero-value {
  font-size: 32px;
  font-weight: 800;
  font-family: $font-family;
  background: linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 20px rgba(255, 107, 107, 0.4));
  line-height: 1;
}

.hero-suffix {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  margin-top: 4px;
  display: block;
  letter-spacing: 0.05em;
}
</style>
