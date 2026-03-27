<template>
  <div class="hero-container">
    <!-- Gacha Machine Visual -->
    <div :class="['gacha-hero-machine', { shaking: isPlaying }]">
      <!-- Glass Dome -->
      <div class="hero-dome">
        <div class="dome-shine" />
        <div class="capsules-float">
          <span v-for="i in 7" :key="i" class="hero-capsule" :style="getCapsuleHeroStyle(i)">
            <AppIcon :name="capsuleIcons[i - 1]" :size="20" aria-hidden="true" />
          </span>
        </div>
      </div>
      <!-- Machine Body -->
      <div class="hero-machine-body">
        <div class="machine-slot-strip">
          <div class="slot-indicator" :class="{ active: !isPlaying }" />
        </div>
      </div>
      <!-- Machine Base -->
      <div class="hero-machine-base">
        <div class="dispense-slot">
          <div v-if="isPlaying" class="dispense-capsule"><AppIcon name="pill" :size="24" aria-hidden="true" /></div>
        </div>
      </div>
    </div>

    <!-- Machine Info -->
    <div class="hero-machine-info">
      <span class="hero-machine-name">
        {{ machineName }}
      </span>
      <span v-if="machinePrice" class="hero-machine-price">
        {{ machinePrice }}
      </span>
      <span class="hero-machine-count"> {{ machineCountLabel }} </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppIcon } from "@shared/components";

defineProps<{
  isPlaying: boolean;
  machineName: string;
  machinePrice: string | null;
  machineCountLabel: string;
}>();

const capsuleIcons = ["pill", "crystal_ball", "neo", "generous", "star", "dice", "sparkle"] as const;

const getCapsuleHeroStyle = (i: number) => ({
  left: `${15 + ((i * 11) % 70)}%`,
  top: `${10 + ((i * 17) % 65)}%`,
  animationDelay: `${i * 0.4}s`,
  fontSize: `${18 + (i % 3) * 4}px`,
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/gasbox-theme.scss" as *;

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 16px 16px;
  gap: 20px;
}

/* -- Gacha Machine -- */
.gacha-hero-machine {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.2s;

  &.shaking {
    animation: machine-shake 0.15s ease-in-out infinite;
  }
}

.hero-dome {
  width: 160px;
  height: 140px;
  border-radius: 50% 50% 8% 8%;
  background: radial-gradient(
    ellipse at 30% 25%,
    rgba(255, 255, 255, 0.12),
    rgba(139, 92, 246, 0.08) 40%,
    rgba(99, 102, 241, 0.05) 70%,
    rgba(0, 0, 0, 0.3)
  );
  border: 2px solid rgba(139, 92, 246, 0.3);
  box-shadow:
    0 0 30px rgba(139, 92, 246, 0.15),
    inset 0 -20px 40px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  z-index: 2;
}

.dome-shine {
  position: absolute;
  top: 8px;
  left: 20px;
  width: 50px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: rotate(-30deg);
}

.capsules-float {
  position: absolute;
  inset: 0;
}

.hero-capsule {
  position: absolute;
  animation: capsule-bob 3s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.hero-machine-body {
  width: 140px;
  height: 40px;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.3));
  border: 2px solid rgba(139, 92, 246, 0.25);
  border-top: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.machine-slot-strip {
  width: 80%;
  height: 20px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.slot-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.3s;

  &.active {
    background: var(--gacha-accent-green);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
    animation: slot-blink 2s ease-in-out infinite;
  }
}

.hero-machine-base {
  width: 120px;
  height: 30px;
  background: linear-gradient(180deg, rgba(79, 70, 229, 0.3), rgba(67, 56, 202, 0.4));
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-top: none;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dispense-slot {
  width: 40px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px 4px 0 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.dispense-capsule {
  position: absolute;
  font-size: 16px;
  left: 50%;
  transform: translateX(-50%);
  animation: capsule-drop 0.6s ease-out forwards;
}

/* -- Machine Info -- */
.hero-machine-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hero-machine-name {
  font-size: 18px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--gacha-hero-gradient-start, #a78bfa), var(--gacha-hero-gradient-end, #818cf8));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-machine-price {
  font-size: 14px;
  font-weight: 700;
  color: var(--gacha-accent-yellow);
  font-family: $font-mono;
}

.hero-machine-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

@keyframes machine-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px) rotate(-1deg);
  }
  75% {
    transform: translateX(3px) rotate(1deg);
  }
}

@keyframes capsule-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-6px) rotate(10deg);
  }
}

@keyframes capsule-drop {
  0% {
    top: -20px;
    opacity: 0;
  }
  60% {
    top: 4px;
    opacity: 1;
  }
  80% {
    top: 0;
  }
  100% {
    top: 4px;
  }
}

@keyframes slot-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@media (max-width: 480px) {
  .hero-dome {
    width: 130px;
    height: 115px;
  }
  .hero-machine-body {
    width: 115px;
  }
  .hero-machine-base {
    width: 100px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gacha-hero-machine.shaking,
  .hero-capsule,
  .slot-indicator.active,
  .dispense-capsule {
    animation: none;
  }
}
</style>
