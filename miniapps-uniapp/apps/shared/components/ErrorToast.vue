<template>
  <Teleport to="body">
    <Transition name="toast-slide">
      <view
        v-if="show"
        :class="['error-toast', `error-toast--${type}`]"
        role="alert"
        aria-live="assertive"
      >
        <view class="error-toast__content">
          <text class="error-toast__icon">{{ iconMap[type] }}</text>
          <text class="error-toast__message">{{ message }}</text>
        </view>
        <button class="error-toast__close" aria-label="Close" @click="$emit('close')">×</button>
      </view>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from "vue";

/** Toast notification type */
export type ToastType = "error" | "success" | "warning";

/**
 * ErrorToast - Shared toast notification for all miniapps
 *
 * Replaces per-app custom error toast implementations with a single,
 * consistent component. Supports error, success, and warning types.
 *
 * @example
 * ```vue
 * <ErrorToast
 *   :show="!!errorMsg"
 *   :message="errorMsg"
 *   type="error"
 *   @close="errorMsg = ''"
 * />
 * ```
 */
const props = withDefaults(
  defineProps<{
    /** Toast message text */
    message: string;
    /** Visual type: error (red), success (green), warning (amber) */
    type?: ToastType;
    /** Whether the toast is visible */
    show: boolean;
    /** Auto-hide duration in ms (0 = no auto-hide) */
    autoHideDuration?: number;
  }>(),
  {
    type: "error",
    autoHideDuration: 5000,
  }
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const iconMap: Record<string, string> = {
  error: "✕",
  success: "✓",
  warning: "⚠",
};

let hideTimer: ReturnType<typeof setTimeout> | undefined;

const clearTimer = () => {
  if (hideTimer !== undefined) {
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }
};

watch(
  () => props.show,
  (visible) => {
    clearTimer();
    if (visible && props.autoHideDuration > 0) {
      hideTimer = setTimeout(() => emit("close"), props.autoHideDuration);
    }
  },
  { immediate: true }
);

onBeforeUnmount(clearTimer);
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.error-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1050;
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
    color: #fca5a5;
  }

  &--success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  &--warning {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fcd34d;
  }

  &__content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  &__icon {
    font-size: 14px;
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
    width: 24px;
    height: 24px;
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
