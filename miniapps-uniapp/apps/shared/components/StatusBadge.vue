<template>
  <view
    class="status-badge"
    :class="[`status-badge--${status}`, { 'status-badge--pulse': pulse }]"
    role="status"
    :aria-label="`${label || status}`"
  >
    <view class="status-badge__dot" aria-hidden="true" />
    <text class="status-badge__label">{{ label || status }}</text>
  </view>
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

<style lang="scss">
@use "../styles/tokens.scss" as *;

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: $radius-full;
  backdrop-filter: blur(5px);

  &__dot {
    width: 8px;
    height: 8px;
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
    background: rgba(255, 222, 89, 0.1);
    color: #ffde59;
    border-color: rgba(255, 222, 89, 0.3);

    .status-badge__dot {
      background: #ffde59;
    }
  }

  &--active {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.3);

    .status-badge__dot {
      background: #3b82f6;
    }
  }

  &--success {
    background: rgba(0, 229, 153, 0.1);
    color: #00e599;
    border-color: rgba(0, 229, 153, 0.3);

    .status-badge__dot {
      background: #00e599;
    }
  }

  &--warning {
    background: rgba(253, 224, 71, 0.1);
    color: #fde047;
    border-color: rgba(253, 224, 71, 0.3);

    .status-badge__dot {
      background: #fde047;
    }
  }

  &--error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);

    .status-badge__dot {
      background: #ef4444;
    }
  }

  &--inactive {
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  &--pending {
    background: rgba(159, 157, 243, 0.1);
    color: #9f9df3;
    border-color: rgba(159, 157, 243, 0.3);

    .status-badge__dot {
      background: #9f9df3;
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
