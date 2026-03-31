<template>
  <button
    type="button"
    :class="[
      'neo-btn',
      `neo-btn--${variant}`,
      `neo-btn--${size}`,
      { 'neo-btn--block': block, 'neo-btn--loading': loading },
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading"
    :aria-disabled="disabled || loading"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <div v-if="loading" class="neo-btn__spinner" aria-hidden="true" />
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "erobo";
export type ButtonSize = "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    disabled?: boolean;
    loading?: boolean;
    /** Accessibility label for screen readers - use when button has no visible text */
    ariaLabel?: string;
  }>(),
  {
    variant: "primary",
    size: "md",
    block: false,
    disabled: false,
    loading: false,
    ariaLabel: undefined,
  }
);

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

let lastClickTime = 0;

function handleClick(event: MouseEvent) {
  if (props.loading || props.disabled) return;
  const now = Date.now();
  if (now - lastClickTime < 300) return; // Debounce double-clicks within 300ms
  lastClickTime = now;
  emit("click", event);
}
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.neo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  font-family: $font-family;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 999px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-primary, #00e599);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(0, 229, 153, 0.15);
  }

  &--block {
    width: 100%;
    display: flex;
  }

  // Sizes
  &--sm {
    height: 32px;
    padding: 0 16px;
    font-size: 11px;
  }

  &--md {
    height: 44px;
    padding: 0 24px;
    font-size: 13px;
  }

  &--lg {
    height: 56px;
    padding: 0 32px;
    font-size: 15px;
  }

  // Variants
  &--primary {
    background: linear-gradient(135deg, var(--btn-primary-start, #9f9df3) 0%, var(--btn-primary-end, #f7aac7) 100%);
    color: var(--btn-primary-color, #1b1b2f);
    box-shadow: 0 12px 30px var(--btn-primary-shadow, rgba(159, 157, 243, 0.35));
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 18px 40px rgba(159, 157, 243, 0.45);
      filter: brightness(1.1);
    }
  }

  &--secondary {
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
    color: var(--text-primary, white);
    border: 1px solid var(--border-color, rgba(159, 157, 243, 0.18));
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 10px var(--shadow-color, rgba(0, 0, 0, 0.1));

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.06);
      border-color: var(--border-color, rgba(255, 255, 255, 0.2));
      box-shadow: 0 4px 15px var(--shadow-color, rgba(0, 0, 0, 0.2));
    }
  }

  &--ghost {
    background: transparent;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    border-color: transparent;
    box-shadow: none;

    &:hover:not(:disabled) {
      color: var(--text-primary, white);
      background: var(--bg-card, rgba(255, 255, 255, 0.05));
      box-shadow: 0 0 15px rgba(0, 229, 153, 0.1);
    }
  }

  &--danger {
    background: linear-gradient(135deg, var(--accent-error, #ef4444) 0%, var(--accent-error-dark, #dc2626) 100%);
    color: var(--button-on-danger, white);
    box-shadow: 0 4px 15px var(--accent-error, rgba(239, 68, 68, 0.4));
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 25px var(--accent-error, rgba(239, 68, 68, 0.6));
      filter: brightness(1.1);
    }
  }

  &--success {
    background: linear-gradient(135deg, var(--accent-success, #10b981) 0%, var(--accent-success-dark, #059669) 100%);
    color: var(--button-on-success, white);
    box-shadow: 0 4px 15px var(--accent-success, rgba(16, 185, 129, 0.4));
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 25px var(--accent-success, rgba(16, 185, 129, 0.6));
      filter: brightness(1.1);
    }
  }

  &--warning {
    background: linear-gradient(135deg, var(--accent-warning, #f59e0b) 0%, var(--accent-warning-dark, #eab308) 100%);
    color: var(--button-on-warning, #000);
    box-shadow: 0 4px 15px var(--accent-warning, rgba(253, 224, 71, 0.4));
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 25px var(--accent-warning, rgba(253, 224, 71, 0.6));
      filter: brightness(1.1);
    }
  }

  &--erobo {
    background: var(--btn-erobo-bg, #1b1b2f);
    color: var(--btn-erobo-color, #fff);
    box-shadow: 0 20px 50px var(--btn-erobo-shadow, rgba(27, 27, 47, 0.35));
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 28px 65px rgba(27, 27, 47, 0.45);
      filter: brightness(1.1);
    }
  }

  // Loading spinner
  &__spinner {
    width: 20px;
    height: 20px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .neo-btn {
    transition: none;

    &:hover:not(:disabled) {
      transform: none;
    }

    &:active:not(:disabled) {
      transform: none;
    }
  }
}
</style>
