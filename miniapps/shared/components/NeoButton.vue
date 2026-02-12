<template>
  <button
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
    @click="$emit('click', $event)"
  >
    <view v-if="loading" class="neo-btn__spinner" />
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "erobo";
export type ButtonSize = "sm" | "md" | "lg";

withDefaults(
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

defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();
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
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-primary, #3b82f6);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
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
    background: linear-gradient(135deg, #9f9df3 0%, #f7aac7 100%);
    color: #1b1b2f;
    box-shadow: 0 12px 30px rgba(159, 157, 243, 0.35);
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
      background: var(--bg-elevated, rgba(255, 255, 255, 0.1));
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
    }
  }

  &--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 25px rgba(239, 68, 68, 0.6);
      filter: brightness(1.1);
    }
  }

  &--success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 25px rgba(16, 185, 129, 0.6);
      filter: brightness(1.1);
    }
  }

  &--warning {
    background: linear-gradient(135deg, #fde047 0%, #eab308 100%);
    color: var(--button-on-warning, #000);
    box-shadow: 0 4px 15px rgba(253, 224, 71, 0.4);
    border: none;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 25px rgba(253, 224, 71, 0.6);
      filter: brightness(1.1);
    }
  }

  &--erobo {
    background: #1b1b2f;
    color: #fff;
    box-shadow: 0 20px 50px rgba(27, 27, 47, 0.35);
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
