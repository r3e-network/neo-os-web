<template>
  <view
    :class="['app-icon', `icon-${name}`, sizeClass]"
    :style="customStyle"
    :aria-hidden="ariaHidden"
    :aria-label="ariaLabel"
    :role="presentation"
  >
    <text v-if="iconEmoji" class="icon-emoji" :aria-hidden="true">{{ iconEmoji }}</text>
    <text v-else-if="iconText" class="icon-text" :aria-hidden="true">{{ iconText }}</text>
    <text v-else class="icon-fallback" :aria-label="`Icon: ${name}`">{{ name.charAt(0).toUpperCase() }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

/**
 * AppIcon Component
 *
 * A versatile icon component that renders icons using emoji mappings, text symbols,
 * or fallback to first character. Supports multiple sizes and includes accessibility
 * features.
 *
 * @example
 * ```vue
 * <!-- Using predefined emoji icon -->
 * <AppIcon name="home" :size="24" />
 *
 * <!-- Using text symbol icon -->
 * <AppIcon name="arrow-left" :size="20" />
 *
 * <!-- Fallback icon (shows first letter) -->
 * <AppIcon name="custom-icon" :size="16" />
 * ```
 */
const props = withDefaults(
  defineProps<{
    /** Icon name - maps to predefined emoji or text symbol */
    name: string;
    /** Icon size in pixels (default: 20) */
    size?: number;
    /** Accessibility label - if provided, icon will be announced to screen readers */
    label?: string;
    /** Whether icon is decorative and should be hidden from screen readers (default: true) */
    decorative?: boolean;
  }>(),
  {
    size: 20,
    decorative: true,
  },
);

/**
 * Complete registry of icon emoji mappings
 * Organized by category for better maintainability
 */
const iconEmojis: Record<string, string> = {
  // Navigation icons
  home: "🏠",
  settings: "⚙️",
  user: "👤",
  wallet: "💼",
  book: "📖",
  trophy: "🏆",
  star: "⭐",
  heart: "❤️",
  check: "✓",
  clock: "🕐",
  plus: "➕",
  add: "➕",
  close: "✕",
  x: "✕",
  menu: "☰",

  // Action icons
  trending: "📈",
  chart: "📊",
  calendar: "📅",
  search: "🔍",
  filter: "🔽",
  edit: "✏️",
  delete: "🗑️",
  copy: "📋",
  share: "📤",
  download: "⬇️",
  upload: "⬆️",

  // Status icons
  success: "✓",
  error: "✕",
  warning: "⚠️",
  info: "ℹ️",
  loading: "⏳",

  // Crypto/blockchain icons
  neo: "💎",
  gas: "⛽",
  contract: "📜",
  chain: "⛓️",
  block: "🧱",

  // Social icons
  helpful: "🤝",
  generous: "🎁",
  verified: "✓",
  contributor: "⭐",
  champion: "🏆",
  legend: "👑",

  // Misc icons
  game: "🎮",
  stats: "📊",
  docs: "📄",
  about: "ℹ️",
  contact: "✉️",
};

/**
 * Text symbol fallbacks for directional and action icons
 * These use Unicode characters instead of emoji
 */
const textMappings: Record<string, string> = {
  logout: "↪",
  back: "←",
  forward: "→",
  arrowUp: "↑",
  arrowDown: "↓",
  arrowLeft: "←",
  arrowRight: "→",
  refresh: "↻",
};

/**
 * Accessibility: Determine if icon should be hidden from screen readers
 * Icons are decorative by default unless a label is provided
 */
const ariaHidden = computed(() => {
  // If a label is provided, icon is not hidden
  if (props.label) return undefined;
  // Otherwise, hide decorative icons from screen readers
  return props.decorative ? "true" : undefined;
});

/**
 * Accessibility: Role for decorative icons
 */
const presentation = computed(() => {
  return props.decorative ? "presentation" : undefined;
});

/**
 * Accessibility: Generate aria-label for screen readers
 */
const ariaLabel = computed(() => {
  if (props.label) return props.label;
  // Auto-generate label for non-decorative icons
  if (!props.decorative) {
    return `${props.name} icon`;
  }
  return undefined;
});

/**
 * Determine size class based on pixel size
 * Maps to predefined size variants for consistent styling
 */
const sizeClass = computed(() => {
  if (props.size <= 16) return "icon-sm";
  if (props.size <= 20) return "icon-md";
  if (props.size <= 24) return "icon-lg";
  return "icon-xl";
});

/**
 * Generate custom inline styles for non-standard sizes
 * Default sizes use predefined CSS classes for better performance
 */
const customStyle = computed(() => {
  if (!sizeClass.value || sizeClass.value === "icon-md") return {};

  const baseSize = props.size;
  return {
    width: `${baseSize}px`,
    height: `${baseSize}px`,
    fontSize: `${baseSize * 0.6}px`,
  };
});

/**
 * Get emoji icon for the given name
 * Returns undefined if no emoji mapping exists
 */
const iconEmoji = computed(() => iconEmojis[props.name]);

/**
 * Get text symbol for the given name
 * Used for directional arrows and other special characters
 */
const iconText = computed(() => textMappings[props.name]);

/**
 * Validate icon name on mount
 * Logs warning if icon name is not recognized (helps catch typos)
 */
onMounted(() => {
  const hasEmoji = props.name in iconEmojis;
  const hasText = props.name in textMappings;

  if (!hasEmoji && !hasText) {
    console.warn(
      `[AppIcon] Unknown icon name "${props.name}". Using fallback (first letter). ` +
        `Available icons: ${[...Object.keys(iconEmojis), ...Object.keys(textMappings)].sort().join(", ")}`,
    );
  }
});
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

// Base icon container styles
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition-fast, var(--transition-normal, 150ms ease));

  // Active state feedback
  &:active {
    transform: scale(0.9);
  }
}

// Size variants - using CSS classes for better performance than inline styles
.icon-sm {
  width: 16px;
  height: 16px;
  font-size: 10px;
}

.icon-md {
  width: 20px;
  height: 20px;
  font-size: 12px;
}

.icon-lg {
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.icon-xl {
  width: 28px;
  height: 28px;
  font-size: 16px;
}

// Icon content types (emoji, text symbols, or fallback letter)
.icon-emoji,
.icon-text,
.icon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  line-height: 1;
  // Use system emoji font stack for best cross-platform rendering
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif;
}

// Fallback icon (when no emoji or text mapping exists)
.icon-fallback {
  font-weight: var(--font-weight-bold, 700);
  color: var(--icon-fallback-color, var(--text-secondary, rgba(248, 250, 252, 0.7)));
  background: var(--icon-fallback-bg, var(--bg-tertiary, rgba(255, 255, 255, 0.1)));
  border-radius: var(--radius-sm, 4px);
  text-transform: uppercase;
}

// Reduced motion support for accessibility
@media (prefers-reduced-motion: reduce) {
  .app-icon {
    transition: none;

    &:active {
      transform: none;
    }
  }
}
</style>
