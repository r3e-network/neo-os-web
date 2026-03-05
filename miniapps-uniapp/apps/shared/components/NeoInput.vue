<template>
  <view class="neo-input" :class="{ 'neo-input--error': error, 'neo-input--disabled': disabled }">
    <text v-if="label" :id="`${inputId}-label`" class="neo-input__label">{{ label }}</text>
    <view class="neo-input__wrapper">
      <textarea
        v-if="type === 'textarea'"
        :id="inputId"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="ariaLabel || (!label ? placeholder : undefined)"
        :aria-labelledby="label ? `${inputId}-label` : undefined"
        :aria-describedby="error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined"
        :aria-invalid="!!error || undefined"
        :aria-required="required || undefined"
        class="neo-input__field neo-input__textarea"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @focus="$emit('focus', $event)"
        @blur="$emit('blur', $event)"
      />
      <input
        v-else
        :id="inputId"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="ariaLabel || (!label ? placeholder : undefined)"
        :aria-labelledby="label ? `${inputId}-label` : undefined"
        :aria-describedby="error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined"
        :aria-invalid="!!error || undefined"
        :aria-required="required || undefined"
        class="neo-input__field"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @focus="$emit('focus', $event)"
        @blur="$emit('blur', $event)"
      />
      <view v-if="suffixIcon || suffix" class="neo-input__suffix">
        <AppIcon v-if="suffixIcon" :name="suffixIcon" :size="18" />
        <text v-if="suffix">{{ suffix }}</text>
      </view>
    </view>
    <text v-if="error" :id="`${inputId}-error`" class="neo-input__error" role="alert">{{ error }}</text>
    <text v-else-if="hint" :id="`${inputId}-hint`" class="neo-input__hint">{{ hint }}</text>
  </view>
</template>

<script setup lang="ts">
import { AppIcon } from "./index";

let globalInputCounter = 0;
const inputId = `neo-input-${++globalInputCounter}`;

defineProps<{
  modelValue?: string | number;
  type?: "text" | "number" | "password" | "textarea";
  label?: string;
  placeholder?: string;
  suffix?: string;
  suffixIcon?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Accessibility label for screen readers - use when no visible label is provided */
  ariaLabel?: string;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "focus", event: FocusEvent): void;
  (e: "blur", event: FocusEvent): void;
}>();
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.neo-input {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: 2px;
  }

  &__wrapper {
    display: flex;
    align-items: center;
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 18px;
    box-shadow: inset 0 2px 4px var(--shadow-color, rgba(0, 0, 0, 0.1));
    transition: all 0.2s ease;

    &:focus-within {
      background: var(--bg-elevated, rgba(255, 255, 255, 0.1));
      border-color: rgba(159, 157, 243, 0.6);
      box-shadow:
        0 0 20px rgba(159, 157, 243, 0.2),
        inset 0 2px 4px var(--shadow-color, rgba(0, 0, 0, 0.1));
    }
  }

  &__field {
    flex: 1;
    height: 50px;
    padding: 0 16px;
    background: transparent;
    border: none;
    font-size: 14px;
    font-family: $font-family;
    font-weight: 500;
    color: var(--text-primary, white);
    width: 100%;

    &::placeholder {
      color: var(--text-muted, rgba(255, 255, 255, 0.3));
    }
  }

  &__textarea {
    height: 120px;
    padding: 12px 16px;
    line-height: 1.5;
  }

  &__suffix {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 16px;
    font-weight: 600;
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  &__hint {
    font-size: 11px;
    color: var(--text-muted, rgba(255, 255, 255, 0.4));
    margin-left: 2px;
  }

  &__error {
    font-size: 11px;
    color: #ef4444;
    font-weight: 600;
    margin-left: 2px;
  }

  &--error {
    .neo-input__wrapper {
      border-color: #ef4444;
      box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);

      &:focus-within {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
      }
    }

    .neo-input__label {
      color: #ef4444;
    }
  }

  &--disabled {
    opacity: 0.5;
    pointer-events: none;

    .neo-input__wrapper {
      background: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.05);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .neo-input__wrapper {
    transition: none;
  }
}
</style>
