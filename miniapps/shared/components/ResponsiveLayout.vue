<template>
  <component
    :is="layoutComponent"
    :title="title"
    :tabs="tabs"
    :active-tab="activeTab"
    :allow-scroll="allowScroll"
    :theme="theme"
    :show-top-nav="showTopNav"
    :show-back="showBack"
    @tab-change="$emit('tab-change', $event)"
    @back="$emit('back')"
  >
    <template #top-bar-actions>
      <slot name="top-bar-actions" />
    </template>
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import AppLayout from "./AppLayout.vue";
import DesktopLayout from "./DesktopLayout.vue";
import type { NavTab } from "./NavBar.vue";

/**
 * ResponsiveLayout Component
 *
 * Automatically switches between mobile (AppLayout) and desktop (DesktopLayout)
 * based on screen size. Provides a seamless experience across all devices.
 *
 * @example
 * ```vue
 * <ResponsiveLayout
 *   title="My App"
 *   :tabs="navTabs"
 *   active-tab="home"
 *   :desktop-breakpoint="1024"
 * >
 *   <template #top-bar-actions>
 *     <button>Settings</button>
 *   </template>
 *   <!-- Content -->
 * </ResponsiveLayout>
 * ```
 */
const props = withDefaults(
  defineProps<{
    /** Page title */
    title?: string;
    /** Navigation tabs */
    tabs?: NavTab[];
    /** Currently active tab ID */
    activeTab?: string;
    /** Whether content area should be scrollable */
    allowScroll?: boolean;
    /** Optional theme class name */
    theme?: string;
    /** Whether to show top navigation bar (mobile only) */
    showTopNav?: boolean;
    /** Whether to show back button (mobile only) */
    showBack?: boolean;
    /** Screen width breakpoint for desktop mode (default: 1024px) */
    desktopBreakpoint?: number;
  }>(),
  {
    title: "",
    tabs: () => [],
    activeTab: "",
    allowScroll: true,
    theme: "",
    showTopNav: false,
    showBack: false,
    desktopBreakpoint: 1024,
  },
);

const emit = defineEmits<{
  /** Emitted when navigating back */
  (e: "back"): void;
  /** Emitted when a tab is clicked */
  (e: "tab-change", tabId: string): void;
}>();

// State for responsive detection
const isDesktop = ref(false);
const isClient = ref(false);

// Check if we're on client side
const checkClientSide = (): boolean => {
  return typeof window !== "undefined";
};

/**
 * Determine current screen size and update layout mode
 */
const checkScreenSize = (): void => {
  if (!isClient.value) return;

  const width = window.innerWidth;
  isDesktop.value = width >= props.desktopBreakpoint;
};

/**
 * Handle window resize with debouncing for performance
 */
let resizeTimer: number | undefined;
const handleResize = (): void => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    checkScreenSize();
  }, 150); // Debounce by 150ms
};

/**
 * Select appropriate layout component based on screen size
 */
const layoutComponent = computed(() => (isDesktop.value ? DesktopLayout : AppLayout));

/**
 * Watch for breakpoint changes and log for debugging
 */
watch(isDesktop, (newValue, oldValue) => {
  if (oldValue !== newValue && isClient.value) {
    console.log(`[ResponsiveLayout] Layout mode changed: ${newValue ? "desktop" : "mobile"} (${window.innerWidth}px)`);
  }
});

// Lifecycle hooks
onMounted(() => {
  isClient.value = checkClientSide();
  if (isClient.value) {
    checkScreenSize();
    window.addEventListener("resize", handleResize);
  }
});

onUnmounted(() => {
  if (isClient.value) {
    window.removeEventListener("resize", handleResize);
    clearTimeout(resizeTimer);
  }
});
</script>
