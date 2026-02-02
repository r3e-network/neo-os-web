<template>
  <view :class="['desktop-container', themeClass]">
    <!-- Sidebar Navigation (Left Panel) -->
    <view class="sidebar" role="navigation" aria-label="Main navigation">
      <!-- Logo/Brand Area -->
      <view class="sidebar-header">
        <text class="brand-name">NeoHub</text>
        <text class="brand-tagline">Miniapps</text>
      </view>

      <!-- Navigation Tabs -->
      <view class="sidebar-nav" role="menubar" aria-label="Navigation menu">
        <view
          v-for="tab in tabs"
          :key="tab.id"
          :class="['nav-item', activeTab === tab.id && 'active']"
          role="menuitem"
          :tabindex="activeTab === tab.id ? 0 : -1"
          :aria-label="tab.label"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="handleTabChange(tab.id)"
          @keydown.enter="handleTabChange(tab.id)"
          @keydown.space.prevent="handleTabChange(tab.id)"
        >
          <view class="nav-icon-wrapper">
            <AppIcon :name="tab.icon" :size="20" />
          </view>
          <text class="nav-label">{{ tab.label }}</text>
          <view v-if="activeTab === tab.id" class="nav-indicator" aria-hidden="true" />
        </view>
      </view>

      <!-- Sidebar Footer -->
      <view class="sidebar-footer">
        <view class="footer-status" role="status" aria-live="polite">
          <view class="status-dot online" aria-hidden="true" />
          <text class="status-text">Connected</text>
        </view>
      </view>
    </view>

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
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
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
  },
);

const emit = defineEmits<{
  /** Emitted when a navigation tab is clicked/activated */
  (e: "tab-change", tabId: string): void;
}>();

const themeClass = computed(() => (props.theme ? `theme-${props.theme}` : ""));

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
    console.warn("[DesktopLayout] No tabs provided - navigation will be hidden");
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

// ===== LEFT PANEL: Sidebar =====
.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100%;
  background: var(--bg-secondary, #1e293b);
  border-right: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  // Glass morphism effect
  background: rgba(30, 41, 59, 0.95);

  // Subtle gradient accent
  &::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 1px;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(139, 92, 246, 0.3) 0%,
      rgba(59, 130, 246, 0.2) 50%,
      rgba(236, 72, 153, 0.3) 100%
    );
  }
}

// Sidebar Header (Brand)
.sidebar-header {
  padding: var(--spacing-8, 32px) var(--spacing-6, 24px) var(--spacing-6, 24px);
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;

  .brand-name {
    display: block;
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: var(--spacing-1, 4px);
  }

  .brand-tagline {
    display: block;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-tertiary, rgba(248, 250, 252, 0.5));
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
}

// Sidebar Navigation
.sidebar-nav {
  flex: 1;
  padding: var(--spacing-4, 16px) var(--spacing-3, 12px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1, 4px);

  // Custom scrollbar
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  // Firefox scrollbar
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-lg, 12px);
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  cursor: pointer;
  position: relative;
  transition: all var(--transition-normal, 0.2s ease);
  gap: var(--spacing-3, 12px);
  border: 1px solid transparent;
  outline: none;

  // Focus styles for keyboard navigation
  &:focus-visible {
    border-color: var(--accent-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  // Hover effect
  &:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
    color: var(--text-primary, #f8fafc);
  }

  // Active state
  &.active {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1));
    color: #a78bfa;
    border-color: rgba(139, 92, 246, 0.2);

    .nav-icon-wrapper {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.15));
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
    }

    .nav-indicator {
      opacity: 1;
      transform: translateX(0);
    }
  }

  &:active {
    transform: scale(0.98);
  }
}

.nav-icon-wrapper {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md, 10px);
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
  transition: all var(--transition-normal, 0.2s ease);
}

.nav-label {
  flex: 1;
  font-size: var(--font-size-md, 14px);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.nav-indicator {
  width: 8px;
  height: 8px;
  background: #8b5cf6;
  border-radius: 50%;
  opacity: 0;
  transform: translateX(-10px);
  transition: all var(--transition-normal, 0.2s ease);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
}

// Sidebar Footer
.sidebar-footer {
  padding: var(--spacing-4, 16px) var(--spacing-6, 24px) var(--spacing-8, 32px);
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

.footer-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
  border-radius: var(--radius-md, 10px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.online {
    background: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);

    // Respect reduced motion preference
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    animation: pulse 2s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-size: var(--font-size-xs, 12px);
  font-weight: 500;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
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

  // Focus outline when content area is focusable
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

  // Firefox scrollbar
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;

  &.no-scroll {
    overflow: hidden;
  }
}

// ===== Responsive Design =====

// Tablet portrait
@media (max-width: 1024px) {
  .sidebar {
    width: 240px;
    min-width: 240px;
  }

  .top-bar {
    padding: 0 var(--spacing-6, 24px);
  }

  .content-area {
    padding: var(--spacing-6, 24px);
  }
}

// Mobile - switch to horizontal nav
@media (max-width: 768px) {
  .desktop-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    min-width: 100%;
    height: auto;
    flex-direction: row;
    align-items: center;
    padding: var(--spacing-3, 12px) var(--spacing-4, 16px);
    border-right: none;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;

    .sidebar-header {
      padding: 0;
      border: none;
      margin-right: var(--spacing-4, 16px);

      .brand-tagline {
        display: none;
      }

      .brand-name {
        font-size: 18px;
        margin-bottom: 0;
      }
    }

    .sidebar-nav {
      flex: 1;
      flex-direction: row;
      padding: 0;
      gap: var(--spacing-1, 4px);
      overflow-x: auto;
      overflow-y: hidden;

      &::-webkit-scrollbar {
        display: none;
      }

      // Hide scrollbar on mobile
      scrollbar-width: none;
    }

    .nav-item {
      padding: var(--spacing-2, 8px) var(--spacing-3, 12px);
      gap: var(--spacing-1, 6px);
      flex-shrink: 0;

      .nav-label {
        font-size: var(--font-size-xs, 12px);
      }

      .nav-icon-wrapper {
        width: 32px;
        height: 32px;
      }

      .nav-indicator {
        display: none;
      }

      &.active {
        background: var(--bg-hover, rgba(255, 255, 255, 0.08));
        border: none;
      }
    }

    .sidebar-footer {
      display: none;
    }

    &::after {
      display: none;
    }
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
  .sidebar {
    background: rgba(255, 255, 255, 0.95);
    border-right-color: rgba(15, 23, 42, 0.1);

    &::after {
      background: linear-gradient(
        180deg,
        rgba(139, 92, 246, 0.15) 0%,
        rgba(59, 130, 246, 0.1) 50%,
        rgba(236, 72, 153, 0.15) 100%
      );
    }
  }

  .top-bar {
    background: rgba(255, 255, 255, 0.9);
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }

  .nav-item {
    &.active {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.08));
      border-color: rgba(139, 92, 246, 0.15);
      color: #7c3aed;
    }
  }

  .footer-status {
    background: rgba(15, 23, 42, 0.03);
    border-color: rgba(15, 23, 42, 0.08);
  }

  .status-dot.online {
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
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

  .nav-indicator {
    transition: none;
    opacity: 1;
  }
}
</style>
