<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import { formatGas } from "@/utils/format";

const props = defineProps<{ amount: number }>();
const { t } = useI18n();

// Generate 20 confetti particles with random properties
const confettiColors = ["#e53935", "#ffd700", "#ff6f60", "#ffab00", "#c62828", "#ffeb3b"];
const confetti = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  color: confettiColors[i % confettiColors.length],
  left: `${Math.random() * 100}%`,
  delay: `${Math.random() * 2}s`,
  duration: `${2 + Math.random() * 2}s`,
  size: `${4 + Math.random() * 6}px`,
}));
</script>

<template>
  <div class="lucky-overlay">
    <!-- CSS confetti particles -->
    <div class="confetti-container">
      <span
        v-for="c in confetti"
        :key="c.id"
        class="confetti-particle"
        :style="{
          left: c.left,
          backgroundColor: c.color,
          animationDelay: c.delay,
          animationDuration: c.duration,
          width: c.size,
          height: c.size,
        }"
      ></span>
    </div>

    <div class="lucky-icon">🧧</div>
    <div class="lucky-title">{{ t("congratulations") }}</div>

    <!-- Gold sparkle border around amount -->
    <div class="lucky-amount-wrapper">
      <div class="lucky-amount">
        <span class="amount-value">{{ formatGas(props.amount) }}</span>
        <span class="amount-unit">{{ t("gas") }}</span>
      </div>
    </div>

    <div class="lucky-subtitle">{{ t("shareYourLuck") }}</div>
  </div>
</template>

<style scoped>
.lucky-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  animation: fadeIn 0.4s ease;
  position: relative;
  overflow: hidden;
}

/* Confetti container */
.confetti-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.confetti-particle {
  position: absolute;
  top: -10px;
  border-radius: 2px;
  animation: confettiDrop 3s ease-in forwards;
}

.lucky-icon {
  font-size: 4rem;
  margin-bottom: 0.5rem;
  animation: bounce 0.6s ease;
  filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.4));
}

.lucky-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-gold, #ffd700);
  margin-bottom: 1rem;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
}

/* Gold sparkle border */
.lucky-amount-wrapper {
  padding: 3px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    var(--color-gold, #ffd700),
    var(--color-red, #e53935),
    var(--color-gold, #ffd700)
  );
  background-size: 200% 200%;
  animation: sparkleGradient 2s ease-in-out infinite;
  margin-bottom: 0.75rem;
}

.lucky-amount {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  background: var(--color-bg-card, #2d1111);
  border-radius: 10px;
  padding: 0.75rem 1.5rem;
}

.amount-value {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-gold, #ffd700);
}

.amount-unit {
  font-size: 1rem;
  color: var(--color-text-secondary, #c4a0a0);
}

.lucky-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #c4a0a0);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

@keyframes sparkleGradient {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
</style>
