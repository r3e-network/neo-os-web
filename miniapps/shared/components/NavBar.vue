<template>
  <view class="navbar" role="navigation" aria-label="Bottom navigation">
    <view
      v-for="tab in tabs"
      :key="tab.id"
      :class="['nav-item', activeTab === tab.id && 'active']"
      role="menuitem"
      :tabindex="activeTab === tab.id ? 0 : -1"
      :aria-label="tab.label"
      :aria-selected="activeTab === tab.id"
      @click="handleTabChange(tab.id)"
      @keydown.enter="handleTabChange(tab.id)"
      @keydown.space.prevent="handleTabChange(tab.id)"
    >
      <view class="nav-icon" aria-hidden="true">
        <AppIcon :name="tab.icon" :size="22" />
      </view>
      <text class="nav-label">{{ tab.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import AppIcon from "./AppIcon.vue";

/**
 * NavTab Interface
 *
 * Defines the structure for navigation tab items.
 */
export interface NavTab {
  /** Unique identifier for the tab */
  id: string;
  /** Icon name from AppIcon registry */
  icon: string;
  /** Display label for the tab */
  label: string;
}

/**
 * NavBar Component
 *
 * A mobile-first bottom navigation bar component with icon and label support.
 * Includes keyboard navigation and accessibility features.
 *
 * @example
 * ```vue
 * <NavBar
 *   :tabs="navTabs"
 *   active-tab="home"
 *   @change="activeTab = $event"
 * />
 * ```
 */
const props = defineProps<{
  /** Array of navigation tabs to display */
  tabs: NavTab[];
  /** Currently active tab ID */
  activeTab: string;
}>();

const emit = defineEmits<{
  /** Emitted when a tab is clicked/activated */
  (e: "change", tabId: string): void;
}>();

/**
 * Handle tab change with proper keyboard and mouse interaction
 */
const handleTabChange = (tabId: string): void => {
  emit("change", tabId);
};

/**
 * Validate tabs configuration on mount
 */
onMounted(() => {
  if (!props.tabs || props.tabs.length === 0) {
    console.warn("[NavBar] No tabs provided - navigation will be empty");
    return;
  }

  const hasDuplicateIds = props.tabs.some((tab, index) => props.tabs.findIndex((t) => t.id === tab.id) !== index);

  if (hasDuplicateIds) {
    console.error("[NavBar] Duplicate tab IDs detected - navigation may not work correctly");
  }

  const activeTabExists = props.tabs.some((t) => t.id === props.activeTab);

  if (!activeTabExists && props.activeTab) {
    console.warn(
      `[NavBar] Active tab "${props.activeTab}" not found in tabs array. ` +
        `Available tabs: ${props.tabs.map((t) => t.id).join(", ")}`,
    );
  }
});
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

// Mobile bottom navigation bar
.navbar {
  height: 64px;
  min-height: 64px;
  background: var(--bg-card, var(--navbar-bg, rgba(12, 13, 22, 0.8)));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-color, var(--navbar-border, rgba(159, 157, 243, 0.18)));
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom, 0);
  flex-shrink: 0;
  position: relative;
  z-index: 10;

  // Subtle top glow effect
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, var(--navbar-accent, #9f9df3) 50%, transparent 100%);
    opacity: 0.5;
    box-shadow: 0 0 10px rgba(159, 157, 243, 0.3);
  }
}

// Individual navigation item
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2, 8px) 0;
  color: var(--text-muted, var(--navbar-inactive, #666666));
  transition: all var(--transition-normal, 250ms ease);
  cursor: pointer;
  position: relative;
  border: none;
  outline: none;
  background: transparent;

  // Focus styles for keyboard navigation
  &:focus-visible {
    background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }

  // Active indicator (pseudo-element)
  &::after {
    content: "";
    position: absolute;
    bottom: var(--spacing-1, 4px);
    left: 50%;
    transform: translateX(-50%) scaleX(0);
    width: 24px;
    height: 2px;
    background: var(--navbar-accent, #9f9df3);
    border-radius: 1px;
    transition: transform var(--transition-normal, 250ms ease);
  }

  // Active state
  &.active {
    color: var(--navbar-accent, #9f9df3);

    &::after {
      transform: translateX(-50%) scaleX(1);
    }
  }

  // Hover state (non-touch devices)
  @media (hover: hover) {
    &:hover {
      color: var(--navbar-accent, #9f9df3);
      background: var(--bg-hover, rgba(159, 157, 243, 0.1));
    }
  }

  // Active/pressed state
  &:active {
    transform: scale(0.95);
  }
}

// Icon wrapper
.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-1, 4px);
}

// Label text
.nav-label {
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-bold, 700);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

// Reduced motion support for accessibility
@media (prefers-reduced-motion: reduce) {
  .nav-item {
    transition: none;

    &,
    &::after,
    &:active {
      transform: none;
    }
  }

  .nav-item::after {
    transition: none;
    opacity: 1;
  }

  .nav-item.active::after {
    transform: translateX(-50%) scaleX(1);
  }
}
</style>
