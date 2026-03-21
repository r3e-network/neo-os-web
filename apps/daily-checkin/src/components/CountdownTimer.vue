<template>
  <div class="countdown-timer" role="timer" :aria-label="ariaLabel || t('countdownDefault')">
    <div v-if="$slots.default" class="countdown-timer__custom">
      <slot :remaining="remaining" :display="display" :progress="progress" :is-complete="isComplete" />
    </div>

    <template v-else-if="textOnly">
      <div class="countdown-timer__text-only">
        <span class="countdown-timer__time">{{ display }}</span>
        <span v-if="label" class="countdown-timer__label">{{ label }}</span>
      </div>
    </template>

    <template v-else>
      <div class="countdown-timer__circle">
        <svg class="countdown-timer__ring" viewBox="0 0 220 220" aria-hidden="true">
          <circle class="countdown-timer__ring-bg" cx="110" cy="110" r="99" />
          <circle
            class="countdown-timer__ring-progress"
            cx="110"
            cy="110"
            r="99"
            :style="{ strokeDashoffset: strokeOffset }"
          />
        </svg>
        <div class="countdown-timer__display">
          <span class="countdown-timer__time">{{ display }}</span>
          <span v-if="label" class="countdown-timer__label">{{ label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

const CIRCUMFERENCE = 2 * Math.PI * 99;

const props = withDefaults(
  defineProps<{
    targetTime: number;
    label?: string;
    totalDuration?: number;
    showDays?: boolean;
    showHours?: boolean;
    textOnly?: boolean;
    ariaLabel?: string;
  }>(),
  {
    label: undefined,
    totalDuration: 0,
    showDays: true,
    showHours: true,
    textOnly: false,
    ariaLabel: undefined,
  }
);

const emit = defineEmits<{
  (e: "complete"): void;
}>();

const remaining = ref(0);
const isComplete = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;
let startTime = 0;

const effectiveTotalDuration = computed(() => (props.totalDuration > 0 ? props.totalDuration : props.targetTime - startTime));
const progress = computed(() => {
  const total = effectiveTotalDuration.value;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - remaining.value / total));
});
const strokeOffset = computed(() => CIRCUMFERENCE * (1 - progress.value));

const display = computed(() => {
  const totalSec = Math.max(0, Math.ceil(remaining.value / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (props.showDays && d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  const totalH = d * 24 + h;
  if (props.showHours && totalH > 0) return `${pad(totalH)}:${pad(m)}:${pad(s)}`;
  if (totalH > 0) return `${pad(totalH)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
});

const stop = () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const tick = () => {
  remaining.value = Math.max(0, props.targetTime - Date.now());
  if (remaining.value <= 0 && !isComplete.value) {
    isComplete.value = true;
    emit("complete");
    stop();
  }
};

const start = () => {
  stop();
  startTime = Date.now();
  isComplete.value = false;
  tick();
  intervalId = setInterval(tick, 1000);
};

watch(() => props.targetTime, start);
onMounted(start);
onUnmounted(stop);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.countdown-timer {
  display: flex;
  align-items: center;
  justify-content: center;

  &__circle {
    position: relative;
    width: 180px;
    height: 180px;
  }

  &__ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  &__ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.05);
    stroke-width: 14;
  }

  &__ring-progress {
    fill: none;
    stroke: var(--countdown-color, #00e599);
    stroke-width: 14;
    stroke-linecap: round;
    stroke-dasharray: 622;
    transition: stroke-dashoffset 1s linear;
    filter: drop-shadow(0 0 4px rgba(0, 229, 153, 0.3));
  }

  &__display {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__time {
    font-family: $font-mono;
    font-size: $font-size-5xl;
    font-weight: $font-weight-bold;
    color: var(--text-primary, white);
    text-shadow: 0 0 20px rgba(0, 229, 153, 0.3);
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    margin-top: $spacing-1;
  }

  &__text-only {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .countdown-timer__ring-progress {
    transition: none;
  }
}
</style>
