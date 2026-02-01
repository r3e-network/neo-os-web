<template>
  <view class="load-section">
    <text class="load-label">{{ label }}</text>
    <view class="load-input-row">
      <view class="input-wrapper">
        <text class="input-icon">🔗</text>
        <input
          type="text"
          class="load-input"
          :placeholder="placeholder"
          :value="modelValue"
          @input="$emit('update:modelValue', ($event as any).detail.value)"
        />
      </view>
      <view :class="['load-btn', { disabled: !modelValue }]" @click="$emit('load')">
        <text class="load-btn-text">{{ buttonText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  label: string;
  placeholder: string;
  buttonText: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  load: [];
}>();
</script>

<style lang="scss" scoped>
.load-section {
  position: relative;
  z-index: 50;
}

.load-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--multi-text-muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.load-input-row {
  display: flex;
  gap: 12px;
  position: relative;
  z-index: 60;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--multi-input-bg);
  border: 1px solid var(--multi-input-border);
  border-radius: 12px;
  padding: 0 16px;
  transition: all 0.2s ease;
  position: relative;
  z-index: 100;

  &:focus-within {
    border-color: var(--multi-input-focus-border);
    background: var(--multi-input-focus-bg);
  }
}

.input-icon {
  font-size: 16px;
  opacity: 0.5;
  pointer-events: none;
  flex-shrink: 0;
}

.load-input {
  flex: 1;
  background: transparent !important;
  border: none !important;
  color: var(--multi-text);
  font-size: 14px;
  padding: 14px 0;
  font-family: "JetBrains Mono", monospace;
  outline: none !important;
  min-height: 48px;
  width: 100%;
  -webkit-appearance: none;
  appearance: none;

  &::placeholder {
    color: var(--multi-text-soft);
  }
}

.load-btn {
  background: var(--multi-button-bg);
  border: 1px solid var(--multi-button-border);
  border-radius: 12px;
  padding: 14px 24px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active:not(.disabled) {
    background: var(--multi-button-active-bg);
    border-color: var(--multi-button-active-border);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.load-btn-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--multi-text);
}
</style>
