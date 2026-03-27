<template>
  <div class="streak-section">
    <div class="streak-fire-ring" :class="{ active: currentStreak > 0 }">
      <span class="streak-number">{{ currentStreak }}</span>
    </div>
    <span class="streak-text">{{ t("dayStreak") }}</span>
    <span class="streak-best-text">
      {{ t("bestStreak") }}: {{ highestStreak }} {{ t("days") }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  currentStreak: number;
  highestStreak: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/variables.scss" as *;

.streak-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.streak-fire-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  border: 3px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s ease;

  &.active {
    border-color: rgba(251, 146, 60, 0.4);
    box-shadow:
      0 0 20px rgba(251, 146, 60, 0.2),
      0 0 40px rgba(251, 146, 60, 0.1);
    animation: fire-pulse 2s ease-in-out infinite alternate;
  }
}

.streak-number {
  font-size: 28px;
  font-weight: 900;
  font-family: $font-mono;
  background: linear-gradient(180deg, var(--sunrise-streak-start, #fbbf24), var(--sunrise-streak-end, #f97316));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4));
}

.streak-text {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.streak-best-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

@keyframes fire-pulse {
  0% {
    box-shadow:
      0 0 15px rgba(251, 146, 60, 0.15),
      0 0 30px rgba(251, 146, 60, 0.08);
  }
  100% {
    box-shadow:
      0 0 25px rgba(251, 146, 60, 0.25),
      0 0 50px rgba(251, 146, 60, 0.12);
  }
}

@media (max-width: 480px) {
  .streak-fire-ring {
    width: 64px;
    height: 64px;
  }
  .streak-number {
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .streak-fire-ring {
    animation: none;
    transition: none;
  }
}
</style>
