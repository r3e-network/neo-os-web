<template>
  <view :class="['mobile-container', isEmbedded && 'embedded']">
    <view class="aspect-wrapper">
      <view class="app-layout" role="application" aria-label="Application layout">
        <TopNavBar v-if="showTopNav" :title="title ?? ''" :show-back="showBack" @back="handleBack" />
        <view :class="['app-content', !allowScroll && 'no-scroll']" :tabindex="allowScroll ? -1 : 0">
          <slot />
        </view>
        <NavBar
          v-if="tabs && tabs.length > 0"
          :tabs="tabs"
          :active-tab="safeActiveTab"
          @change="$emit('tab-change', $event)"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import NavBar, { type NavTab } from "./NavBar.vue";
import TopNavBar from "./TopNavBar.vue";

/**
 * AppLayout Component
 *
 * Mobile-first layout component for miniapps with optional top navigation,
 * bottom navigation bar, and scrollable content area. Provides a consistent
 * mobile experience across all miniapps.
 *
 * @example
 * ```vue
 * <AppLayout
 *   title="My App"
 *   :tabs="navTabs"
 *   active-tab="home"
 *   :allow-scroll="true"
 * >
 *   <!-- Content -->
 * </AppLayout>
 * ```
 */

// Embedded mode detection — deferred to onMounted for SSR safety
const isEmbedded = ref(false);

const props = withDefaults(
  defineProps<{
    /** Page title displayed in the top navigation bar */
    title?: string;
    /** Whether to show the top navigation bar */
    showTopNav?: boolean;
    /** Whether to show the back button in the top navigation bar */
    showBack?: boolean;
    /** Navigation tabs for the bottom navigation bar */
    tabs?: NavTab[];
    /** Currently active tab ID */
    activeTab?: string;
    /** Whether the content area should be scrollable (default: true) */
    allowScroll?: boolean;
    /** Optional theme class name (without 'theme-' prefix) */
    theme?: string;
  }>(),
  {
    title: "",
    showTopNav: false,
    showBack: false,
    tabs: () => [],
    activeTab: "",
    allowScroll: true,
    theme: "",
  }
);

const emit = defineEmits<{
  /** Emitted when navigating back */
  (e: "back"): void;
  /** Emitted when a tab is clicked/activated */
  (e: "tab-change", tabId: string): void;
}>();

/**
 * Computed property for safe active tab (ensures string type)
 */
const safeActiveTab = computed(() => (props.activeTab as string) || "");

/**
 * Handle back navigation with emit and UniApp navigation
 */
const handleBack = (): void => {
  emit("back");
  const pages = getCurrentPages();
  if (pages && pages.length > 1) {
    uni.navigateBack({
      delta: 1,
    });
  }
};

/**
 * Validate props configuration on mount
 */
onMounted(() => {
  // Detect embedded mode (safe — only runs client-side)
  isEmbedded.value =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embedded") === "1";

  // Validate active tab exists in tabs array
  if (props.tabs && props.tabs.length > 0 && props.activeTab) {
    const activeTabExists = props.tabs.some((t) => t.id === props.activeTab);
    if (!activeTabExists) {
      console.warn(
        `[AppLayout] Active tab "${props.activeTab}" not found in tabs array. ` +
          `Available tabs: ${props.tabs.map((t) => t.id).join(", ")}`
      );
    }
  }

  // Log embedded mode for debugging
  if (isEmbedded.value) {
    console.log("[AppLayout] Running in embedded mode");
  }
});
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;
@use "../styles/theme.scss" as *;

// ============================================================================
// Global Reset
// ============================================================================

:global(*) {
  box-sizing: border-box;
}

:global(body),
:global(page) {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary, var(--app-bg, #05060d));
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

// ============================================================================
// Mobile Container
// ============================================================================

.mobile-container {
  width: 100%;
  height: 100%;
  background: var(--bg-primary, var(--app-bg, #05060d));
  overflow: hidden;
  position: relative;
}

:global(uni-page-body),
:global(uni-page-wrapper) {
  height: 100%;
}

.aspect-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

// ============================================================================
// App Layout
// ============================================================================

.app-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, var(--app-bg, #05060d));

  // Animated gradient background overlay
  background-image:
    radial-gradient(circle at 50% 0%, rgba(159, 157, 243, 0.12) 0%, transparent 60%),
    radial-gradient(circle at 85% 35%, rgba(247, 170, 199, 0.12) 0%, transparent 45%),
    radial-gradient(circle at 15% 70%, rgba(248, 215, 194, 0.16) 0%, transparent 50%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0%, transparent 100%);

  color: var(--text-primary, var(--app-text, #ffffff));
  overflow: hidden;
  position: relative;
}

// ============================================================================
// Embedded Mode Support
// ============================================================================

.mobile-container.embedded {
  .app-layout {
    height: 100% !important;
    max-height: 100% !important;
  }
}

// ============================================================================
// Content Area
// ============================================================================

.app-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;

  // Focus outline when content area is focusable
  &:focus {
    outline: none;
  }

  // Custom scrollbar for WebKit browsers
  &::-webkit-scrollbar {
    width: var(--scrollbar-width, 4px);
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: var(--scrollbar-radius, 2px);

    &:hover {
      background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
    }
  }

  // No scroll variant
  &.no-scroll {
    overflow: hidden;
  }
}

// ============================================================================
// Reduced Motion Support
// ============================================================================

@media (prefers-reduced-motion: reduce) {
  .app-content {
    scroll-behavior: auto;
  }
}
</style>
