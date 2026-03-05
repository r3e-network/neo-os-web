<template>
  <view class="control-group">
    <text class="control-label">{{ label }}</text>
    <view class="segment-row">
      <view
        v-for="option in options"
        :key="option.value"
        class="segment"
        :class="[option.variant, { active: modelValue === option.value }]"
        role="button"
        tabindex="0"
        :aria-pressed="modelValue === option.value"
        @click="emit('update:modelValue', option.value)"
        @keydown.enter="emit('update:modelValue', option.value)"
        @keydown.space.prevent="emit('update:modelValue', option.value)"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
export interface SegmentOption {
  value: string;
  label: string;
  /** Optional CSS variant class (e.g. 'yes', 'no') */
  variant?: string;
}

defineProps<{
  label: string;
  options: SegmentOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.control-group {
  margin-bottom: 16px;
}

.control-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--predict-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.45px;
}

.segment-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.segment {
  padding: 12px 10px;
  border-radius: 11px;
  border: 1px solid var(--predict-input-border);
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--predict-text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    border-color: var(--predict-accent);
    background: rgba(59, 130, 246, 0.14);
    color: var(--predict-accent);
  }

  &.yes.active {
    border-color: var(--predict-success);
    color: var(--predict-success);
    background: var(--predict-success-bg);
  }

  &.no.active {
    border-color: var(--predict-danger);
    color: var(--predict-danger);
    background: var(--predict-danger-bg);
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(59, 130, 246, 0.35);
    color: var(--predict-text-primary);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.45);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .segment {
    transition: none;
  }

  .segment:hover,
  .segment:active {
    transform: none;
  }
}
</style>
