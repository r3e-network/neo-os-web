<template>
  <view class="form-card" role="form" :aria-label="title || 'Form'">
    <view v-if="title || description" class="form-card__header">
      <view class="form-card__header-text">
        <text v-if="title" class="form-card__title">{{ title }}</text>
        <text v-if="description" class="form-card__description">{{ description }}</text>
      </view>
      <slot name="header-extra" />
    </view>

    <view class="form-card__body" :class="{ 'form-card__body--loading': loading }">
      <slot />
      <view v-if="loading" class="form-card__overlay" role="status" aria-label="Loading">
        <view class="form-card__spinner" aria-hidden="true" />
      </view>
    </view>

    <!-- Validation error -->
    <view v-if="error" class="form-card__error" role="alert">
      <text class="form-card__error-text">{{ error }}</text>
    </view>

    <view v-if="$slots.actions || submitLabel" class="form-card__actions">
      <slot name="actions">
        <view
          class="form-card__submit"
          :class="{ 'form-card__submit--loading': submitLoading, 'form-card__submit--disabled': submitDisabled }"
          role="button"
          tabindex="0"
          :aria-disabled="submitLoading || submitDisabled"
          @click="!submitLoading && !submitDisabled && $emit('submit')"
          @keydown.enter="!submitLoading && !submitDisabled && $emit('submit')"
        >
          <view v-if="submitLoading" class="form-card__submit-spinner" aria-hidden="true" />
          <text v-else>{{ submitLabel }}</text>
        </view>
      </slot>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    /** Description text below the title */
    description?: string;
    loading?: boolean;
    /** Label for the built-in submit button */
    submitLabel?: string;
    /** Show loading spinner on submit button */
    submitLoading?: boolean;
    /** Disable the submit button */
    submitDisabled?: boolean;
    /** Validation error message */
    error?: string;
  }>(),
  {
    title: undefined,
    description: undefined,
    loading: false,
    submitLabel: undefined,
    submitLoading: false,
    submitDisabled: false,
    error: undefined,
  }
);

defineEmits<{
  (e: "submit"): void;
}>();
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.form-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: var(--card-radius, 20px);
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: $spacing-5;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  }

  &__header-text {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-bold;
    color: var(--text-primary, rgba(255, 255, 255, 0.9));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: $font-family;
  }

  &__description {
    font-size: $font-size-sm;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
  }

  &__body {
    position: relative;
    padding: $spacing-5;
    display: flex;
    flex-direction: column;
    gap: $spacing-4;

    &--loading {
      pointer-events: none;
      opacity: 0.6;
    }
  }

  &__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(2px);
    z-index: 1;
  }

  &__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-top-color: var(--text-primary, #ffffff);
    border-radius: 50%;
    animation: formCardSpin 0.8s linear infinite;
  }

  &__error {
    padding: $spacing-2 $spacing-5;
    background: rgba(239, 68, 68, 0.1);
    border-top: 1px solid rgba(239, 68, 68, 0.2);
  }

  &__error-text {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: #ef4444;
  }

  &__actions {
    padding: $spacing-4 $spacing-5;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    background: var(--bg-secondary, rgba(0, 0, 0, 0.2));
    display: flex;
    gap: $spacing-3;
  }

  &__submit {
    flex: 1;
    padding: 12px 20px;
    border-radius: 10px;
    background: var(--color-primary, #00e599);
    color: #000;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
    cursor: pointer;
    transition: filter 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      filter: brightness(1.1);
    }

    &--loading,
    &--disabled {
      pointer-events: none;
      opacity: 0.6;
    }
  }

  &__submit-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-top-color: #000;
    border-radius: 50%;
    animation: formCardSpin 0.6s linear infinite;
  }
}

@keyframes formCardSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-card__spinner,
  .form-card__submit-spinner {
    animation: none;
  }

  .form-card__submit {
    transition: none;
  }
}
</style>
