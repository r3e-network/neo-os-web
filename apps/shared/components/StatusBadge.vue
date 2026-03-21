<template>
  <div
    class="status-badge"
    :class="[`status-badge--${status}`, { 'status-badge--pulse': pulse }]"
    role="status"
    :aria-label="`${label || status}`"
  >
    <div class="status-badge__dot" aria-hidden="true" />
    <span class="status-badge__label">{{ label || status }}</span>
  </div>
</template>

<script setup lang="ts">
export type BadgeStatus = "ready" | "active" | "success" | "warning" | "error" | "inactive" | "pending";

withDefaults(
  defineProps<{
    status: BadgeStatus;
    label?: string;
    /** Whether the dot should pulse (useful for 'ready' or 'active' states) */
    pulse?: boolean;
  }>(),
  {
    label: undefined,
    pulse: false,
  }
);
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-1 $spacing-3;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: $radius-full;
  backdrop-filter: blur(5px);

  &__dot {
    width: $spacing-2;
    height: $spacing-2;
    border-radius: 50%;
    background: var(--text-secondary, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    color: inherit;
  }

  // Status variants
  &--ready {
    --badge-color: #ffde59;
    background: rgba(255, 222, 89, 0.1);
    color: var(--badge-color);
    border-color: rgba(255, 222, 89, 0.3);

    .status-badge__dot {
      background: var(--badge-color);
    }
  }

  &--active {
    --badge-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    color: var(--badge-color);
    border-color: rgba(59, 130, 246, 0.3);

    .status-badge__dot {
      background: var(--badge-color);
    }
  }

  &--success {
    --badge-color: #00e599;
    background: rgba(0, 229, 153, 0.1);
    color: var(--badge-color);
    border-color: rgba(0, 229, 153, 0.3);

    .status-badge__dot {
      background: var(--badge-color);
    }
  }

  &--warning {
    --badge-color: #fde047;
    background: rgba(253, 224, 71, 0.1);
    color: var(--badge-color);
    border-color: rgba(253, 224, 71, 0.3);

    .status-badge__dot {
      background: var(--badge-color);
    }
  }

  &--error {
    --badge-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    color: var(--badge-color);
    border-color: rgba(239, 68, 68, 0.3);

    .status-badge__dot {
      background: var(--badge-color);
    }
  }

  &--inactive {
    --badge-color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    color: var(--badge-color);
  }

  &--pending {
    --badge-color: #9f9df3;
    background: rgba(159, 157, 243, 0.1);
    color: var(--badge-color);
    border-color: rgba(159, 157, 243, 0.3);

    .status-badge__dot {
      background: var(--badge-color);
    }
  }

  // Pulse animation
  &--pulse .status-badge__dot {
    animation: statusBadgePulse 1.5s ease-in-out infinite;
  }
}

@keyframes statusBadgePulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-badge--pulse .status-badge__dot {
    animation: none;
  }
}
</style>
