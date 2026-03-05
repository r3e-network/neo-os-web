<template>
  <view class="control-group">
    <text class="control-label">{{ label }}</text>
    <input
      :value="modelValue"
      class="trade-input"
      type="number"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="label"
      @input="onInput"
    />
    <view :class="['preset-row', variant]">
      <view
        v-for="preset in presets"
        :key="preset.value"
        class="preset-chip"
        role="button"
        tabindex="0"
        @click="emit('update:modelValue', preset.value)"
        @keydown.enter="emit('update:modelValue', preset.value)"
        @keydown.space.prevent="emit('update:modelValue', preset.value)"
      >
        {{ preset.label }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
export interface PresetItem {
  value: number;
  label: string;
}

const props = defineProps<{
  label: string;
  modelValue: number;
  presets: PresetItem[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Optional row variant class (e.g. 'shares') */
  variant?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const num = Number(target.value);
  if (Number.isFinite(num)) {
    emit("update:modelValue", num);
  }
};
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

.trade-input {
  width: 100%;
  border-radius: 11px;
  border: 1px solid var(--predict-input-border);
  background: var(--predict-input-bg);
  color: var(--predict-text-primary);
  font-size: 14px;
  padding: 12px;
}

.preset-row {
  margin-top: 9px;
  display: flex;
  gap: 7px;
  flex-wrap: wrap;

  &.shares .preset-chip {
    min-width: 52px;
    text-align: center;
  }
}

.preset-chip {
  padding: 6px 9px;
  border-radius: 999px;
  border: 1px solid var(--predict-input-border);
  color: var(--predict-text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;

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
  .preset-chip {
    transition: none;
  }

  .preset-chip:hover,
  .preset-chip:active {
    transform: none;
  }
}
</style>
