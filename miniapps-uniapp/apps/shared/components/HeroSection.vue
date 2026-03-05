<template>
  <view
    class="hero-section"
    :class="[variant ? `hero-section--${variant}` : '', compact ? 'hero-section--compact' : '']"
    role="banner"
    :aria-label="title || ariaLabel || 'Hero'"
  >
    <view v-if="$slots.background" class="hero-section__background" aria-hidden="true">
      <slot name="background" />
    </view>

    <view class="hero-section__content">
      <text v-if="icon" class="hero-section__icon" aria-hidden="true">{{ icon }}</text>

      <text v-if="subtitle" class="hero-section__subtitle">{{ subtitle }}</text>
      <text v-if="title" class="hero-section__title">{{ title }}</text>
      <text v-if="suffix" class="hero-section__suffix">{{ suffix }}</text>

      <view v-if="description" class="hero-section__description">
        <text>{{ description }}</text>
      </view>

      <view v-if="$slots.stats" class="hero-section__stats">
        <slot name="stats" />
      </view>

      <view v-if="$slots.actions" class="hero-section__actions">
        <slot name="actions" />
      </view>

      <view v-if="$slots.default" class="hero-section__extra">
        <slot />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
export type HeroVariant = "default" | "erobo" | "erobo-neo" | "erobo-bitcoin" | "accent" | "danger";

withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    suffix?: string;
    variant?: HeroVariant;
    /** Emoji or icon character displayed above the title */
    icon?: string;
    /** Description text below the suffix */
    description?: string;
    /** Compact mode with reduced padding */
    compact?: boolean;
    /** Accessibility label override */
    ariaLabel?: string;
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    suffix: undefined,
    variant: "default",
    icon: undefined,
    description: undefined,
    compact: false,
    ariaLabel: undefined,
  }
);
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.hero-section {
  text-align: center;
  padding: $spacing-5;
  position: relative;
  overflow: hidden;
  background: var(--bg-card, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: var(--card-radius, 20px);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  &__background {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  &__content {
    position: relative;
    z-index: 1;
  }

  &__icon {
    display: block;
    font-size: 32px;
    margin-bottom: $spacing-2;
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.2));
  }

  &__subtitle {
    display: block;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.1em;
    margin-bottom: $spacing-2;
  }

  &__title {
    display: block;
    font-size: $font-size-5xl;
    font-weight: $font-weight-black;
    font-family: $font-family;
    color: var(--text-primary, #ffffff);
    line-height: $line-height-tight;
  }

  &__suffix {
    display: block;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    color: var(--text-muted, rgba(255, 255, 255, 0.4));
    margin-top: $spacing-1;
    letter-spacing: 0.05em;
  }

  &__description {
    margin-top: $spacing-3;
    font-size: $font-size-sm;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  &__stats {
    margin-top: $spacing-5;
  }

  &__actions {
    margin-top: $spacing-4;
    display: flex;
    justify-content: center;
    gap: $spacing-3;
  }

  &__extra {
    margin-top: $spacing-4;
  }

  // Compact mode
  &--compact {
    padding: $spacing-3;

    .hero-section__icon {
      font-size: 24px;
      margin-bottom: $spacing-1;
    }

    .hero-section__title {
      font-size: $font-size-3xl;
    }
  }

  // Variants
  &--erobo {
    background: linear-gradient(135deg, rgba(159, 157, 243, 0.15) 0%, rgba(123, 121, 209, 0.08) 100%);
    border-color: rgba(159, 157, 243, 0.25);
    box-shadow: 0 0 30px rgba(159, 157, 243, 0.15);

    .hero-section__title {
      background: linear-gradient(135deg, #9f9df3 0%, #f7aac7 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 20px rgba(159, 157, 243, 0.4));
    }
  }

  &--erobo-neo {
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.15) 0%, rgba(0, 179, 119, 0.08) 100%);
    border-color: rgba(0, 229, 153, 0.25);
    box-shadow: 0 0 30px rgba(0, 229, 153, 0.15);

    .hero-section__title {
      color: #00e599;
      text-shadow: 0 0 20px rgba(0, 229, 153, 0.4);
    }
  }

  &--erobo-bitcoin {
    background: linear-gradient(135deg, rgba(255, 228, 195, 0.15) 0%, rgba(255, 200, 140, 0.08) 100%);
    border-color: rgba(255, 228, 195, 0.25);
    box-shadow: 0 0 30px rgba(255, 228, 195, 0.15);

    .hero-section__title {
      color: #ffde59;
      text-shadow: 0 0 20px rgba(255, 222, 89, 0.4);
    }
  }

  &--accent {
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(0, 229, 153, 0.05) 100%);
    border-color: rgba(0, 229, 153, 0.3);
    box-shadow: 0 0 25px rgba(0, 229, 153, 0.15);
  }

  &--danger {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 107, 107, 0.3);
    box-shadow: 0 0 30px rgba(255, 107, 107, 0.1);

    .hero-section__title {
      background: linear-gradient(135deg, #ff6b6b 0%, #ffd700 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 20px rgba(255, 107, 107, 0.4));
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-section {
    &__title {
      filter: none;
    }
  }
}
</style>
