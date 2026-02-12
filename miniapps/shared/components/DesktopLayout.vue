<template>
  <view :class="['desktop-container', themeClass]">
    <DesktopSidebar
      :tabs="tabs"
      :active-tab="activeTab"
      @tab-change="handleTabChange"
    >
      <template v-if="hasDesktopSidebar" #desktop-sidebar>
        <slot name="desktop-sidebar" />
      </template>
    </DesktopSidebar>

    <!-- Main Content Area (Right Panel) -->
    <view class="main-content-wrapper" role="main">
      <!-- Top Bar -->
      <view class="top-bar">
        <view class="top-bar-left">
          <text v-if="title" class="page-title">{{ title }}</text>
        </view>
        <view class="top-bar-right">
          <slot name="top-bar-actions" />
        </view>
      </view>

      <!-- Content Area -->
      <view :class="['content-area', !allowScroll && 'no-scroll']" :tabindex="allowScroll ? -1 : 0">
        <slot />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, useSlots } from "vue";
import DesktopSidebar from "./DesktopSidebar.vue";
import type { NavTab } from "./NavBar.vue";

/**
 * DesktopLayout Component
 *
 * A professional desktop-first layout component with sidebar navigation
 * and main content area. Designed for screen sizes 1024px and above.
 *
 * @example
 * ```vue
 * <DesktopLayout
 *   title="My App"
 *   :tabs="navTabs"
 *   active-tab="home"
 *   :allow-scroll="true"
 *   theme="my-app"
 * >
 *   <template #top-bar-actions>
 *     <button>Settings</button>
 *   </template>
 *   <!-- Main content -->
 * </DesktopLayout>
 * ```
 */
const props = withDefaults(
  defineProps<{
    /** Page title displayed in the top bar */
    title?: string;
    /** Navigation tabs for the sidebar */
    tabs?: NavTab[];
    /** Currently active tab ID */
    activeTab?: string;
    /** Whether the content area should be scrollable */
    allowScroll?: boolean;
    /** Optional theme class name (without 'theme-' prefix) */
    theme?: string;
  }>(),
  {
    title: "",
    tabs: () => [],
    activeTab: "",
    allowScroll: true,
    theme: "",
  }
);

const emit = defineEmits<{
  /** Emitted when a navigation tab is clicked/activated */
  (e: "tab-change", tabId: string): void;
}>();

const themeClass = computed(() => (props.theme ? `theme-${props.theme}` : ""));
const slots = useSlots();
const hasDesktopSidebar = computed(() => Boolean(slots["desktop-sidebar"]));

/**
 * Handle tab change with proper keyboard and mouse interaction
 */
const handleTabChange = (tabId: string): void => {
  emit("tab-change", tabId);
};

/**
 * Validate that tabs array contains valid entries
 */
const validateTabs = (): boolean => {
  if (!props.tabs || props.tabs.length === 0) {
    if (import.meta.env.DEV) console.warn("[DesktopLayout] No tabs provided - navigation will be hidden");
    return false;
  }

  const hasDuplicateIds = props.tabs.some((tab, index) => props.tabs.findIndex((t) => t.id === tab.id) !== index);

  if (hasDuplicateIds) {
    console.error("[DesktopLayout] Duplicate tab IDs detected - navigation may not work correctly");
    return false;
  }

  return true;
};

// Validate tabs on mount
validateTabs();
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;
@use "../styles/theme-base.scss" as *;

// Desktop container with proper sizing
.desktop-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  background: var(--bg-primary, #0f172a);
  color: var(--text-primary, #f8fafc);
  overflow: hidden;
  position: relative;

  // Animated gradient background
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
      radial-gradient(circle at 40% 60%, rgba(236, 72, 153, 0.04) 0%, transparent 40%);
    pointer-events: none;
    z-index: 0;
  }
}

// ===== RIGHT PANEL: Main Content =====
.main-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  z-index: 5;
  overflow: hidden;
}

// Top Bar
.top-bar {
  min-height: 72px;
  padding: 0 var(--spacing-10, 40px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  background: var(--bg-secondary, rgba(30, 41, 59, 0.8));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  flex-shrink: 0;

  // Subtle glow at bottom
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: var(--spacing-10, 40px);
    right: var(--spacing-10, 40px);
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.3) 50%, transparent 100%);
  }
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}

// Content Area
.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--spacing-8, 32px) var(--spacing-10, 40px);
  scroll-behavior: smooth;

  &:focus {
    outline: none;
  }

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  }

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;

  &.no-scroll {
    overflow: hidden;
  }
}

// ===== Responsive Design =====

// Tablet portrait
@media (max-width: 1024px) {
  .top-bar {
    padding: 0 var(--spacing-6, 24px);
  }

  .content-area {
    padding: var(--spacing-6, 24px);
  }
}

// Mobile
@media (max-width: 768px) {
  .desktop-container {
    flex-direction: column;
  }

  .top-bar {
    padding: 0 var(--spacing-4, 16px);
    min-height: 56px;

    &::after {
      left: var(--spacing-4, 16px);
      right: var(--spacing-4, 16px);
    }
  }

  .page-title {
    font-size: 16px;
  }

  .content-area {
    padding: var(--spacing-4, 16px);
  }
}

// Light theme adjustments
:global(.theme-light) .desktop-container,
[data-theme="light"] .desktop-container {
  .top-bar {
    background: rgba(255, 255, 255, 0.9);
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
