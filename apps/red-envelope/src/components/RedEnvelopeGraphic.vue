<template>
  <div :class="['red-envelope-hero', { opening: isOpening }]">
    <!-- Envelope flap -->
    <div class="envelope-flap">
      <div class="flap-fold" />
    </div>
    <!-- Envelope body -->
    <div class="envelope-body">
      <div class="envelope-seal">
        <span class="seal-character">福</span>
      </div>
      <!-- Gold trim -->
      <div class="envelope-trim-top" />
      <div class="envelope-trim-bottom" />
      <!-- Corner ornaments -->
      <div class="corner-ornament top-left" />
      <div class="corner-ornament top-right" />
      <div class="corner-ornament bottom-left" />
      <div class="corner-ornament bottom-right" />
    </div>
    <!-- Gold coins spilling out on open -->
    <div v-if="isOpening" class="coins-spill" aria-hidden="true">
      <span v-for="i in 6" :key="i" class="gold-coin" :style="{ animationDelay: `${0.2 + i * 0.1}s`, left: `${20 + (i * 12) % 60}%` }">&#x1FA99;</span>
    </div>
    <!-- Sparkle decorations -->
    <div class="envelope-sparkles">
      <span v-for="i in 5" :key="i" class="sparkle" :style="{ animationDelay: `${i * 0.3}s` }"><AppIcon name="sparkle" :size="14" aria-hidden="true" /></span>
    </div>
    <!-- Lucky knot decoration -->
    <div class="lucky-knot" aria-hidden="true">
      <span class="knot-symbol">&#x7D50;</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * RedEnvelopeGraphic.vue — Pure CSS art envelope visualization.
 * Stateless presentational component that renders the decorative envelope
 * with flap, seal, trim and sparkle animations.
 */
import AppIcon from "@shared/components/AppIcon.vue";

defineProps<{
  /** When true, plays the opening animation */
  isOpening?: boolean;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "../pages/index/red-envelope-theme.scss" as *;

.red-envelope-hero {
  position: relative;
  width: 160px;
  height: 200px;
  transition: transform 0.5s ease;

  &.opening {
    animation: envelope-open 0.8s ease-out forwards;
  }
}

.envelope-flap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: linear-gradient(135deg, var(--envelope-flap-start), var(--envelope-flap-end));
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  z-index: 2;
  transition: transform 0.5s ease;

  .opening & {
    transform: rotateX(180deg);
    transform-origin: top center;
  }
}

.flap-fold {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 15px;
  border-radius: 0 0 50% 50%;
  background: rgba(0, 0, 0, 0.1);
}

.envelope-body {
  position: absolute;
  top: 30px;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--envelope-body-gradient);
  border-radius: 4px 4px 12px 12px;
  z-index: 1;
  box-shadow:
    0 10px 40px var(--envelope-shadow-red),
    inset 0 1px 0 var(--envelope-shadow-white);
  overflow: hidden;
}

.envelope-seal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--envelope-seal-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 20px var(--envelope-gold-glow),
    0 0 40px rgba(var(--envelope-gold-rgb), 0.2);
  animation: seal-glow 2s ease-in-out infinite alternate;
}

.seal-character {
  font-size: 30px;
  font-weight: 900;
  color: var(--envelope-premium-red-dark);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.envelope-trim-top {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--envelope-trim-gold), transparent);
}

.envelope-trim-bottom {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--envelope-trim-gold), transparent);
}

.envelope-sparkles {
  position: absolute;
  inset: -20px;
  z-index: 3;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  font-size: 14px;
  animation: sparkle-float 3s ease-in-out infinite;

  &:nth-child(1) {
    top: 0;
    left: 10%;
  }
  &:nth-child(2) {
    top: 20%;
    right: 0;
  }
  &:nth-child(3) {
    bottom: 10%;
    left: 0;
  }
  &:nth-child(4) {
    bottom: 0;
    right: 15%;
  }
  &:nth-child(5) {
    top: 40%;
    left: 50%;
  }
}

@keyframes envelope-open {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05) translateY(-5px);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes seal-glow {
  0% {
    box-shadow:
      0 0 15px var(--envelope-gold-glow),
      0 0 30px rgba(var(--envelope-gold-rgb), 0.15);
  }
  100% {
    box-shadow:
      0 0 25px rgba(var(--envelope-gold-rgb), 0.6),
      0 0 50px rgba(var(--envelope-gold-rgb), 0.25);
  }
}

@keyframes sparkle-float {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0) scale(0.8);
  }
  50% {
    opacity: 1;
    transform: translateY(-8px) scale(1.1);
  }
}

/* Corner ornaments - Chinese pattern */
.corner-ornament {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(var(--envelope-gold-rgb, 255, 215, 0), 0.25);
  z-index: 2;

  &.top-left { top: 14px; left: 14px; border-right: none; border-bottom: none; border-radius: 3px 0 0 0; }
  &.top-right { top: 14px; right: 14px; border-left: none; border-bottom: none; border-radius: 0 3px 0 0; }
  &.bottom-left { bottom: 14px; left: 14px; border-right: none; border-top: none; border-radius: 0 0 0 3px; }
  &.bottom-right { bottom: 14px; right: 14px; border-left: none; border-top: none; border-radius: 0 0 3px 0; }
}

/* Gold coins spilling */
.coins-spill {
  position: absolute;
  top: 40%;
  left: 0;
  right: 0;
  z-index: 4;
  pointer-events: none;
}

.gold-coin {
  position: absolute;
  font-size: 18px;
  animation: coin-spill 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  opacity: 0;
}

@keyframes coin-spill {
  0% { opacity: 0; transform: translateY(-10px) rotate(0deg) scale(0.5); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(60px) rotate(360deg) scale(1.2); }
}

/* Lucky knot */
.lucky-knot {
  position: absolute;
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
}

.knot-symbol {
  font-size: 16px;
  color: rgba(var(--envelope-gold-rgb, 255, 215, 0), 0.5);
  font-family: "Noto Serif SC", serif;
  font-weight: 900;
  filter: drop-shadow(0 0 4px rgba(var(--envelope-gold-rgb, 255, 215, 0), 0.3));
}

@media (max-width: 480px) {
  .red-envelope-hero {
    width: 130px;
    height: 170px;
  }
  .envelope-seal {
    width: 48px;
    height: 48px;
  }
  .seal-character {
    font-size: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .envelope-seal,
  .sparkle {
    animation: none;
  }
}
</style>
