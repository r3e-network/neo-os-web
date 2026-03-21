<template>
  <div
    v-if="visible"
    class="action-modal"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="title ? `${modalId}-title` : undefined"
    :aria-describedby="description ? `${modalId}-desc` : undefined"
    :aria-label="title ? undefined : t('dialogAriaLabel')"
    @click.self="closeable && $emit('close')"
    @keydown.escape="closeable && $emit('close')"
  >
    <div
      ref="contentRef"
      class="action-modal__content"
      :class="[variant ? `action-modal--${variant}` : '', sizeClass]"
    >
      <div v-if="title || closeable" class="action-modal__header">
        <span v-if="title" :id="`${modalId}-title`" class="action-modal__title">{{ title }}</span>
        <button
          v-if="closeable"
          type="button"
          class="action-modal__close"
          :aria-label="t('close')"
          @click="$emit('close')"
        >
          <AppIcon name="x" :size="20" />
        </button>
      </div>

      <div v-if="description" :id="`${modalId}-desc`" class="action-modal__description">
        <span>{{ description }}</span>
      </div>

      <div class="action-modal__body">
        <slot />
      </div>

      <div v-if="$slots.actions || confirmLabel" class="action-modal__actions">
        <slot name="actions">
          <div class="action-modal__default-actions">
            <button
              v-if="cancelLabel"
              type="button"
              class="action-modal__btn action-modal__btn--cancel"
              @click="$emit('cancel')"
            >
              <span>{{ cancelLabel }}</span>
            </button>
            <button
              type="button"
              class="action-modal__btn action-modal__btn--confirm"
              :class="{ 'action-modal__btn--loading': confirmLoading }"
              :disabled="confirmLoading"
              @click="!confirmLoading && $emit('confirm')"
            >
              <div v-if="confirmLoading" class="action-modal__btn-spinner" aria-hidden="true" />
              <span v-else>{{ confirmLabel }}</span>
            </button>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted, computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { useI18n } from "@shared/composables/useI18n";

export type ActionModalVariant = "default" | "success" | "warning" | "danger";
export type ActionModalSize = "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title?: string;
    /** Description text shown below the header */
    description?: string;
    variant?: ActionModalVariant;
    size?: ActionModalSize;
    closeable?: boolean;
    /** Label for the confirm button (enables default action buttons) */
    confirmLabel?: string;
    /** Label for the cancel button */
    cancelLabel?: string;
    /** Show loading spinner on confirm button */
    confirmLoading?: boolean;
  }>(),
  {
    title: undefined,
    description: undefined,
    variant: "default",
    size: "md",
    closeable: true,
    confirmLabel: undefined,
    cancelLabel: undefined,
    confirmLoading: false,
  }
);

defineEmits<{
  (e: "close"): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const contentRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const modalId = `action-modal-${useId()}`;

const sizeClass = computed(() => `action-modal--size-${props.size}`);

watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      previouslyFocused = typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null;
      await nextTick();
      const focusable = contentRef.value?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || contentRef.value)?.focus?.();
    } else if (previouslyFocused) {
      previouslyFocused.focus?.();
      previouslyFocused = null;
    }
  }
);

onUnmounted(() => {
  previouslyFocused = null;
});
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.action-modal {
  position: fixed;
  inset: 0;
  z-index: $z-modal;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-5;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  animation: actionModalFadeIn 0.2s ease;

  &__content {
    width: 100%;
    background: var(--bg-card);
    border: $border-width-lg solid var(--border-color);
    box-shadow: 0 20px 40px var(--shadow-color, rgba(0, 0, 0, 0.3));
    border-radius: 16px;
    overflow: hidden;
    animation: actionModalScaleIn 0.2s ease;
  }

  &--size-sm .action-modal__content,
  &__content.action-modal--size-sm {
    max-width: 320px;
  }
  &--size-md .action-modal__content,
  &__content.action-modal--size-md {
    max-width: 400px;
  }
  &--size-lg .action-modal__content,
  &__content.action-modal--size-lg {
    max-width: 520px;
  }

  &--success {
    border-color: var(--accent-success);
    box-shadow: 8px 8px 0 var(--accent-success);
  }
  &--warning {
    border-color: var(--accent-warning);
    box-shadow: 8px 8px 0 var(--accent-warning);
  }
  &--danger {
    border-color: var(--accent-error);
    box-shadow: 8px 8px 0 var(--accent-error);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-4 $spacing-5;
    border-bottom: $border-width-sm solid var(--border-color);
  }

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-black;
    color: var(--text-primary);
    text-transform: uppercase;
  }

  &__close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color $transition-fast;
    border: none;
    appearance: none;
    padding: 0;
    background: transparent;

    &:hover {
      color: var(--text-primary);
    }
  }

  &__description {
    padding: 0 $spacing-5;
    padding-top: $spacing-3;
    font-size: $font-size-sm;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    line-height: 1.5;
  }

  &__body {
    padding: $spacing-5;
  }

  &__actions {
    padding: $spacing-4 $spacing-5;
    border-top: $border-width-sm solid var(--border-color);
    background: var(--bg-secondary, rgba(0, 0, 0, 0.2));
  }

  &__default-actions {
    display: flex;
    gap: $spacing-3;
    justify-content: flex-end;
  }

  &__btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 80px;

    &--cancel {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary, rgba(255, 255, 255, 0.6));
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary);
      }
    }

    &--confirm {
      background: var(--accent-primary, #3b82f6);
      color: #000;
      border: 1px solid transparent;

      &:hover {
        filter: brightness(1.1);
      }
    }

    &--loading {
      pointer-events: none;
      opacity: 0.7;
    }
  }

  &__btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-top-color: #000;
    border-radius: 50%;
    animation: actionModalBtnSpin 0.6s linear infinite;
  }
}

@keyframes actionModalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes actionModalScaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes actionModalBtnSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-modal {
    animation: none;

    &__content {
      animation: none;
    }

    &__close {
      transition: none;
    }

    &__btn {
      transition: none;
    }

    &__btn-spinner {
      animation: none;
    }
  }
}
</style>
