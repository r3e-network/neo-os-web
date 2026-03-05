<template>
  <view
    v-if="visible"
    class="action-modal"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="title ? `${modalId}-title` : undefined"
    :aria-label="title ? undefined : 'Dialog'"
    @click.self="closeable && $emit('close')"
    @keydown.escape="closeable && $emit('close')"
  >
    <view
      ref="contentRef"
      class="action-modal__content"
      :class="[variant ? `action-modal--${variant}` : '', sizeClass]"
    >
      <view v-if="title || closeable" class="action-modal__header">
        <text v-if="title" :id="`${modalId}-title`" class="action-modal__title">{{ title }}</text>
        <view
          v-if="closeable"
          class="action-modal__close"
          role="button"
          tabindex="0"
          aria-label="Close dialog"
          @click="$emit('close')"
          @keydown.enter="$emit('close')"
          @keydown.space.prevent="$emit('close')"
        >
          <AppIcon name="x" :size="20" />
        </view>
      </view>

      <view v-if="description" class="action-modal__description">
        <text>{{ description }}</text>
      </view>

      <view class="action-modal__body">
        <slot />
      </view>

      <view v-if="$slots.actions || confirmLabel" class="action-modal__actions">
        <slot name="actions">
          <view class="action-modal__default-actions">
            <view
              v-if="cancelLabel"
              class="action-modal__btn action-modal__btn--cancel"
              role="button"
              tabindex="0"
              @click="$emit('cancel')"
              @keydown.enter="$emit('cancel')"
            >
              <text>{{ cancelLabel }}</text>
            </view>
            <view
              class="action-modal__btn action-modal__btn--confirm"
              :class="{ 'action-modal__btn--loading': confirmLoading }"
              role="button"
              tabindex="0"
              :aria-disabled="confirmLoading"
              @click="!confirmLoading && $emit('confirm')"
              @keydown.enter="!confirmLoading && $emit('confirm')"
            >
              <view v-if="confirmLoading" class="action-modal__btn-spinner" aria-hidden="true" />
              <text v-else>{{ confirmLabel }}</text>
            </view>
          </view>
        </slot>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from "vue";
import AppIcon from "./AppIcon.vue";

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

const contentRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

let modalCounter = 0;
const modalId = `action-modal-${++modalCounter}`;

const sizeClass = `action-modal--size-${props.size}`;

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

<style lang="scss">
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
    border-color: var(--status-success);
    box-shadow: 8px 8px 0 var(--status-success);
  }
  &--warning {
    border-color: var(--status-warning);
    box-shadow: 8px 8px 0 var(--status-warning);
  }
  &--danger {
    border-color: var(--status-error);
    box-shadow: 8px 8px 0 var(--status-error);
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
      background: var(--color-primary, #00e599);
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
