<template>
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
        },
      ]"
    >
      <span
        class="day-icon"
        :aria-label="day <= weekSlotFilled ? t('dayCompleted') : t('dayPending')"
      >
        <AppIcon
          :name="day <= weekSlotFilled ? 'check-circle' : 'circle'"
          :size="16"
          aria-hidden="true"
        />
      </span>
      <span class="day-label">{{ t("dayPrefix") }}{{ day }}</span>
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
  padding: 8px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 38px;
  transition: all 0.3s ease;

  &.checked {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.2);
  }

  &.today {
    background: rgba(255, 222, 89, 0.08);
    border-color: rgba(255, 222, 89, 0.3);
    box-shadow: 0 0 12px rgba(255, 222, 89, 0.15);
    animation: today-glow 2s ease-in-out infinite alternate;
  }

  &.today-done {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
  }
}

.day-icon {
  font-size: 18px;
  line-height: 1;
}

.day-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}

@keyframes today-glow {
  0% {
    box-shadow: 0 0 8px rgba(255, 222, 89, 0.1);
  }
  100% {
    box-shadow: 0 0 18px rgba(255, 222, 89, 0.25);
  }
}

@media (max-width: 480px) {
  .week-day-slot {
    min-width: 32px;
    padding: 6px 4px;
  }
  .day-icon {
    font-size: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .week-day-slot {
    animation: none;
    transition: none;
  }
}
</style>
