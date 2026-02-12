<template>
  <view class="header-neo">
    <view class="header-glass-container">
      <view class="glow-effect"></view>
      <text class="title-neo">{{ t("title") }}</text>
      <text class="subtitle-neo">{{ t("subtitle") }}</text>
      <view class="decorations-neo">
        <view class="decoration-item delay-1"><AppIcon name="sparkle" :size="24" class="text-gold glow-animate" /></view>
        <view class="decoration-item"><AppIcon name="gift" :size="32" class="text-white bounce-animate" /></view>
        <view class="decoration-item delay-2"><AppIcon name="sparkle" :size="24" class="text-gold glow-animate" /></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { AppIcon } from "@shared/components";

defineProps<{
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.header-neo {
  padding: 24px;
  display: flex;
  justify-content: center;
}

.header-glass-container {
  position: relative;
  width: 100%;
  padding: 32px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  text-align: center;
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.glow-effect {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%);
  z-index: 0;
  pointer-events: none;
}

.title-neo, .subtitle-neo, .decorations-neo {
  position: relative;
  z-index: 1;
}

.title-neo {
  font-size: 32px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
  display: block;
  font-family: $font-family;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 20px rgba(255, 69, 58, 0.4);
}

.subtitle-neo {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  display: block;
  margin-bottom: 24px;
}

.decorations-neo {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
}

.text-gold { color: var(--red-envelope-gold-warm); filter: drop-shadow(0 0 8px rgba(252, 211, 77, 0.5)); }
.text-white { color: var(--text-primary); filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5)); }

.glow-animate {
  animation: glow 2s ease-in-out infinite;
}

.bounce-animate {
  animation: bounce 2s ease-in-out infinite;
}

.delay-1 { animation-delay: 0.5s; }
.delay-2 { animation-delay: 1s; }

@keyframes glow {
  0%, 100% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
</style>
