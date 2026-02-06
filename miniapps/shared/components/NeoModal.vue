<template>
  <view
    v-if="visible"
    class="neo-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="title || 'Dialog'"
    @click.self="closeable && $emit('close')"
    @keydown.escape="closeable && $emit('close')"
  >
    <view ref="contentRef" class="neo-modal__content" :class="`neo-modal--${variant}`">
      <view v-if="title" class="neo-modal__header">
        <text class="neo-modal__title">{{ title }}</text>
        <view
          v-if="closeable"
          class="neo-modal__close"
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

      <view class="neo-modal__body">
        <slot />
      </view>
      <view v-if="$slots.footer" class="neo-modal__footer">
        <slot name="footer" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from "vue";
import AppIcon from "./AppIcon.vue";

export type ModalVariant = "default" | "success" | "warning" | "danger";

const props = defineProps<{
  visible: boolean;
  title?: string;
  variant?: ModalVariant;
  closeable?: boolean;
}>();

defineEmits<{
  (e: "close"): void;
}>();

const contentRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      previouslyFocused = typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null;
      await nextTick();
      // Focus the first focusable element inside the modal, or the content itself
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
@use "../styles/variables.scss" as *;

.neo-modal {
  position: fixed;
  inset: 0;
  z-index: $z-modal;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-5;
  background: rgba(0, 0, 0, 0.85);
  animation: fadeIn 0.2s ease;

  &__content {
    width: 100%;
    max-width: 400px;
    background: var(--bg-card);
    border: $border-width-lg solid var(--border-color);
    box-shadow: $shadow-lg;
    animation: scaleIn 0.2s ease;
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

  &__body {
    padding: $spacing-5;
  }
  &__footer {
    padding: $spacing-4 $spacing-5;
    border-top: $border-width-sm solid var(--border-color);
    display: flex;
    gap: $spacing-3;
    justify-content: flex-end;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
