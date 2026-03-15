<template>
  <component
    :is="layoutComponent"
    :title="title"
    :tabs="resolvedTabs"
    :active-tab="activeTab"
    :allow-scroll="allowScroll"
    :theme="theme"
    :show-top-nav="showTopNav"
    :show-back="showBack"
    @tab-change="handleTabChange"
    @back="$emit('back')"
  >
    <template #top-bar-actions>
      <slot name="top-bar-actions" />
    </template>
    <template #desktop-sidebar>
      <slot name="desktop-sidebar" />
    </template>
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import AppLayout from "./AppLayout.vue";
import DesktopLayout from "./DesktopLayout.vue";
import type { NavTab } from "./NavBar.vue";

export interface NavItem {
  id?: string;
  key?: string;
  label: string;
  icon: string;
}

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
    /** Legacy alias for tabs (backward compatibility) */
    navItems?: NavItem[];
    /** Currently active tab ID */
    activeTab?: string;
    /** Whether content area should be scrollable */
    allowScroll?: boolean;
    /** Optional theme class name */
    theme?: string;
    /** Whether to show top navigation bar (mobile only) */
    showTopNav?: boolean;
    /** Legacy desktop sidebar toggle (kept for backward compatibility) */
    showSidebar?: boolean;
    /** Legacy layout mode prop (kept for backward compatibility) */
    layout?: string;
    /** Whether to show back button (mobile only) */
    showBack?: boolean;
    /** Screen width breakpoint for desktop mode (default: 1024px) */
    desktopBreakpoint?: number;
  }>(),
  {
    title: "",
    tabs: () => [],
    navItems: () => [],
    activeTab: "",
    allowScroll: true,
    theme: "",
    showTopNav: false,
    showSidebar: false,
    layout: "default",
    showBack: false,
    desktopBreakpoint: 1024,
  }
);

const emit = defineEmits<{
  /** Emitted when navigating back */
  (e: "back"): void;
  /** Emitted when a tab is clicked */
  (e: "tab-change", tabId: string): void;
  /** Legacy tab change event alias */
  (e: "navigate", tabId: string): void;
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
 * Use new tabs prop or legacy navItems prop
 */
const resolvedTabs = computed<NavTab[]>(() => {
  if (props.tabs && props.tabs.length > 0) return props.tabs;
  if (props.navItems && props.navItems.length > 0) {
    return props.navItems
      .map((item) => ({ id: item.id ?? item.key ?? "", label: item.label, icon: item.icon }))
      .filter((item): item is NavTab => Boolean(item.id));
  }
  return [];
});

/**
 * Select appropriate layout component based on screen size
 */
const layoutComponent = computed(() => (isDesktop.value ? DesktopLayout : AppLayout));

/**
 * Emit both new and legacy navigation events
 */
const handleTabChange = (tabId: string): void => {
  emit("tab-change", tabId);
  emit("navigate", tabId);
};

/**
 * Watch for breakpoint changes
 */
watch(isDesktop, (newValue, oldValue) => {
  if (oldValue !== newValue && isClient.value) {
    // Breakpoint changed — layout will re-render automatically
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
