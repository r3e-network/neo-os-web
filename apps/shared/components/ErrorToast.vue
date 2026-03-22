<template>
  <Teleport to="body">
    <Transition name="toast-slide">
      <div
        v-if="show"
        :class="['error-toast', `error-toast--${type}`]"
        role="alert"
      >
        <div class="error-toast__content">
          <span class="error-toast__icon" aria-hidden="true">{{ iconMap[type] }}</span>
          <span class="error-toast__message">{{ message }}</span>
        </div>
        <button type="button" class="error-toast__close" :aria-label="t('close')" @click="$emit('close')">×</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from "vue";
import { useI18n } from "@shared/composables";
import { type StatusType } from "@shared/composables/useStatusMessage";

const { t } = useI18n();

type ToastType = StatusType;

const DEFAULT_AUTO_HIDE_DURATION_MS = 5000;

const props = withDefaults(
  defineProps<{
    message: string;
    type?: ToastType;
    show: boolean;
    autoHideDuration?: number;
  }>(),
  {
    type: "error",
    autoHideDuration: DEFAULT_AUTO_HIDE_DURATION_MS,
  }
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const iconMap: Record<ToastType, string> = {
  error: "✕",
  success: "✓",
  warning: "⚠",
  info: "ℹ",
  danger: "⚡",
  loading: "⟳",
};

let hideTimer: ReturnType<typeof setTimeout> | undefined;

const clearTimer = () => {
  if (hideTimer !== undefined) {
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }
};

const stopShowWatch = watch(
  () => props.show,
  (visible) => {
    clearTimer();
    if (visible && props.autoHideDuration > 0) {
      hideTimer = setTimeout(() => emit("close"), props.autoHideDuration);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopShowWatch();
  clearTimer();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.error-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: $z-index-toast;
  display: flex;
  align-items: center;
  gap: $spacing-3;
  max-width: 400px;
  width: calc(100% - #{$spacing-8});
  padding: $spacing-3 $spacing-4;
  border-radius: $radius-lg;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  font-family: $font-family;
  box-sizing: border-box;

  &--error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    --toast-color: var(--accent-error, #ef4444);
    color: var(--toast-color);
  }

  &--success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    --toast-color: var(--accent-success, #10b981);
    color: var(--toast-color);
  }

  &--warning {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    --toast-color: var(--accent-warning, #f59e0b);
    color: var(--toast-color);
  }

  &--info {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    --toast-color: var(--accent-info, #3b82f6);
    color: var(--toast-color);
  }

  &--danger {
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.3);
    --toast-color: var(--accent-error, #ef4444);
    color: var(--toast-color);
  }

  &--loading {
    background: rgba(75, 85, 99, 0.15);
    border: 1px solid rgba(75, 85, 99, 0.3);
    --toast-color: var(--text-secondary, #9ca3af);
    color: var(--toast-color);
  }

  &__content {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    flex: 1;
    min-width: 0;
  }

  &__icon {
    font-size: $font-size-sm;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__message {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    line-height: $line-height-normal;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__close {
    flex-shrink: 0;
    width: $spacing-6;
    height: $spacing-6;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: $radius-md;
    color: inherit;
    font-size: $font-size-md;
    cursor: pointer;
    transition: background $transition-fast;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.toast-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-16px);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-slide-enter-active,
  .toast-slide-leave-active {
    transition: opacity 0.15s ease;
  }

  .toast-slide-enter-from,
  .toast-slide-leave-to {
    transform: translateX(-50%);
  }
}
</style>
