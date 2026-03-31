<template>
  <div class="week-row-wrapper">
    <div class="week-progress-label">
      <span class="progress-text">{{ weekSlotFilled }}/7 {{ t("dayPrefix") }}s</span>
      <span v-if="weekSlotFilled === 7" class="week-complete-badge">COMPLETE</span>
    </div>
    <div class="week-row">
      <div
        v-for="day in 7"
        :key="day"
        :class="[
          'week-day-slot',
          {
            checked: day <= weekSlotFilled,
            today: day === weekSlotToday,
            'today-done': !canCheckIn && day === weekSlotFilled,
            'today-ready': canCheckIn && day === weekSlotToday,
          },
        ]"
      >
        <span
          class="day-icon"
          :aria-label="day <= weekSlotFilled ? t('dayCompleted') : t('dayPending')"
        >
          <AppIcon
            :name="day <= weekSlotFilled ? 'check-circle' : 'circle'"
            :size="20"
            aria-hidden="true"
          />
        </span>
        <span class="day-label">{{ t("dayPrefix") }}{{ day }}</span>
        <span v-if="day === 7 && weekSlotFilled >= 7" class="bonus-star" aria-hidden="true">&#x2B50;</span>
      </div>
    </div>
    <div class="week-connector">
      <div class="connector-fill" :style="{ width: `${(weekSlotFilled / 7) * 100}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AppIcon } from "@shared/components";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  currentStreak: number;
  canCheckIn: boolean;
}>();

const weekSlotFilled = computed(() => {
  const mod = props.currentStreak % 7;
  return props.currentStreak >= 7 && mod === 0 ? 7 : mod;
});

const weekSlotToday = computed(() => {
  const filled = weekSlotFilled.value;
  return filled === 7 && props.canCheckIn ? 1 : filled + 1;
});
</script>

<style lang="scss" scoped>
.week-row-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.week-progress-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.06em;
}

.week-complete-badge {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.15em;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  animation: complete-shine 2s ease-in-out infinite;
}

.week-row {
  display: flex;
  gap: 6px;
  width: 100%;
  justify-content: center;
}

.week-day-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 40px;
  transition: all 0.3s ease;
  position: relative;

  &.checked {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.25);

    .day-icon { color: #34d399; }
    .day-label { color: rgba(52, 211, 153, 0.7); }
  }

  &.today {
    background: rgba(255, 222, 89, 0.08);
    border-color: rgba(255, 222, 89, 0.3);
    box-shadow: 0 0 12px rgba(255, 222, 89, 0.15);
    animation: today-glow 2s ease-in-out infinite alternate;
  }

  &.today-ready {
    background: rgba(255, 107, 53, 0.12);
    border-color: rgba(255, 107, 53, 0.4);
    box-shadow: 0 0 16px rgba(255, 107, 53, 0.25);
    animation: ready-pulse 1.5s ease-in-out infinite;

    .day-icon { color: #ff6b35; }
    .day-label { color: rgba(255, 107, 53, 0.8); font-weight: 800; }
  }

  &.today-done {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.35);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
  }
}

.day-icon {
  font-size: 20px;
  line-height: 1;
  transition: color 0.3s ease;
}

.day-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}

.bonus-star {
  position: absolute;
  top: -6px;
  right: -4px;
  font-size: 12px;
  animation: star-spin 3s linear infinite;
}

.week-connector {
  width: 85%;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.connector-fill {
  height: 100%;
  background: linear-gradient(90deg, #34d399, #fbbf24, #ff6b35);
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes today-glow {
  0% { box-shadow: 0 0 8px rgba(255, 222, 89, 0.1); }
  100% { box-shadow: 0 0 18px rgba(255, 222, 89, 0.25); }
}

@keyframes ready-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 107, 53, 0.2);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 24px rgba(255, 107, 53, 0.4);
    transform: scale(1.05);
  }
}

@keyframes complete-shine {
  0%, 100% { box-shadow: 0 0 8px rgba(16, 185, 129, 0.2); }
  50% { box-shadow: 0 0 16px rgba(16, 185, 129, 0.4); }
}

@keyframes star-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .week-day-slot {
    min-width: 34px;
    padding: 8px 5px;
  }
  .day-icon { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .week-day-slot, .bonus-star, .week-complete-badge {
    animation: none;
    transition: none;
  }
}
</style>
