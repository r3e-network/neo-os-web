<template>
  <div class="hero-section">
    <div class="fire-container" aria-hidden="true">
      <div class="flame flame-1"></div>
      <div class="flame flame-2"></div>
      <div class="flame flame-3"></div>
    </div>
    <div class="hero-content">
      <span class="hero-subtitle">{{ t("totalBurned") }}</span>
      <span class="hero-value">{{ formatNum(totalBurned) }}</span>
      <span class="hero-suffix">{{ t("tokenGas") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatNum } from "../composables/useBurnLeague";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  totalBurned: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.hero-section {
  position: relative;
  width: 100%;
  max-width: 400px;
  padding: 32px 20px;
  border-radius: 16px;
  background: linear-gradient(
    145deg,
    rgba(255, 80, 0, 0.08) 0%,
    rgba(200, 30, 0, 0.06) 50%,
    rgba(255, 120, 0, 0.04) 100%
  );
  border: 1px solid rgba(255, 100, 0, 0.15);
  text-align: center;
  overflow: hidden;
  animation: ember-glow 3s ease-in-out infinite;
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hero-subtitle {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.hero-value {
  font-size: 36px;
  font-weight: 900;
  font-family: $font-mono;
  background: linear-gradient(180deg, #ff6b00, #ff0000);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 12px rgba(255, 80, 0, 0.4));
  animation: flame-flicker 2s ease-in-out infinite;
}

.hero-suffix {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  background: radial-gradient(circle at bottom, var(--burn-flame-orange, #f97316), transparent 70%);
  border-radius: 50% 50% 20% 20%;
  animation: neo-flicker 2s infinite alternate ease-in-out;
  margin: 0 -10px;
  opacity: 0.7;

  &.flame-1 {
    animation-delay: 0s;
    height: 70px;
    background: radial-gradient(circle at bottom, var(--burn-flame-red, #ef4444), transparent 70%);
  }
  &.flame-2 {
    animation-delay: 0.5s;
    height: 90px;
    background: radial-gradient(circle at bottom, var(--burn-flame-amber, #f59e0b), transparent 70%);
    z-index: 1;
  }
  &.flame-3 {
    animation-delay: 1s;
    height: 60px;
    background: radial-gradient(circle at bottom, var(--burn-flame-red, #ef4444), transparent 70%);
  }
}

@keyframes flame-flicker {
  0%, 100% {
    text-shadow: 0 0 10px rgba(255, 100, 0, 0.6), 0 0 20px rgba(255, 60, 0, 0.4), 0 0 40px rgba(255, 40, 0, 0.2);
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    text-shadow: 0 0 15px rgba(255, 120, 0, 0.8), 0 0 30px rgba(255, 80, 0, 0.5), 0 0 50px rgba(255, 40, 0, 0.3);
    transform: scale(1.02);
    opacity: 1;
  }
}

@keyframes ember-glow {
  0%, 100% { box-shadow: 0 0 15px rgba(255, 80, 0, 0.15), 0 0 30px rgba(255, 40, 0, 0.08); }
  50% { box-shadow: 0 0 25px rgba(255, 100, 0, 0.3), 0 0 50px rgba(255, 60, 0, 0.15); }
}

@keyframes neo-flicker {
  0% { transform: scaleY(1) translateY(0); opacity: 0.5; }
  100% { transform: scaleY(1.2) translateY(-10px); opacity: 0.8; }
}

@media (max-width: 480px) {
  .hero-value { font-size: 28px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-section, .hero-value, .flame { animation: none; }
}
</style>
