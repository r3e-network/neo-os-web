<template>
  <view class="sidebar" role="navigation" aria-label="Main navigation">
    <!-- Logo/Brand Area -->
    <view class="sidebar-header">
      <text class="brand-name">NeoHub</text>
      <text class="brand-tagline">Miniapps</text>
    </view>

    <!-- Navigation Tabs -->
    <view class="sidebar-nav" role="tablist" aria-label="Navigation tabs">
      <view
        v-for="tab in tabs"
        :key="tab.id"
        :class="['nav-item', activeTab === tab.id && 'active']"
        role="tab"
        :id="`tab-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1"
        :aria-label="tab.label"
        :aria-selected="activeTab === tab.id ? 'true' : 'false'"
        :aria-controls="`tabpanel-${tab.id}`"
        @click="emit('tab-change', tab.id)"
        @keydown.enter="emit('tab-change', tab.id)"
        @keydown.space.prevent="emit('tab-change', tab.id)"
      >
        <view class="nav-icon-wrapper">
          <AppIcon :name="tab.icon" :size="20" />
        </view>
        <text class="nav-label">{{ tab.label }}</text>
        <view v-if="activeTab === tab.id" class="nav-indicator" aria-hidden="true" />
      </view>
    </view>

    <view v-if="hasSidebarSlot" class="sidebar-panel" role="complementary" aria-label="Sidebar details">
      <slot name="desktop-sidebar" />
    </view>

    <!-- Sidebar Footer -->
    <view class="sidebar-footer">
      <view class="footer-status" role="status" aria-live="polite">
        <view class="status-dot online" aria-hidden="true" />
        <text class="status-text">Connected</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, useSlots } from "vue";
import AppIcon from "./AppIcon.vue";
import type { NavTab } from "./NavBar.vue";

defineProps<{
  tabs: NavTab[];
  activeTab: string;
}>();

const emit = defineEmits<{
  (e: "tab-change", tabId: string): void;
}>();

const slots = useSlots();
const hasSidebarSlot = computed(() => Boolean(slots["desktop-sidebar"]));
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;
@use "../styles/theme-base.scss" as *;

.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100%;
  border-right: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(30, 41, 59, 0.95);

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

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-4, 16px) var(--spacing-3, 12px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1, 4px);

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

  &:focus-visible {
    border-color: var(--accent-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  &:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
    color: var(--text-primary, #f8fafc);
  }

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

.sidebar-panel {
  margin: 0 var(--spacing-3, 12px);
  padding: var(--spacing-3, 12px);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  flex-shrink: 0;
  max-height: min(34vh, 280px);
  overflow: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;

  :deep(.sidebar-title) {
    display: block;
    margin-bottom: var(--spacing-2, 8px);
    font-size: var(--font-size-sm, 12px);
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--text-tertiary, rgba(248, 250, 252, 0.6));
  }

  :deep(.sidebar-value) {
    display: block;
    font-size: var(--font-size-xl, 18px);
    font-weight: 700;
    color: var(--text-primary, #f8fafc);
  }
}

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

// === Responsive: mobile horizontal nav ===
@media (max-width: 768px) {
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

    &::after {
      display: none;
    }
  }

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

  .sidebar-panel,
  .sidebar-footer {
    display: none;
  }
}

// Tablet
@media (max-width: 1024px) and (min-width: 769px) {
  .sidebar {
    width: 240px;
    min-width: 240px;
  }
}

// Light theme
:global(.theme-light) .sidebar,
[data-theme="light"] .sidebar {
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

:global(.theme-light) .nav-item,
[data-theme="light"] .nav-item {
  &.active {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.08));
    border-color: rgba(139, 92, 246, 0.15);
    color: #7c3aed;
  }
}

:global(.theme-light) .footer-status,
[data-theme="light"] .footer-status {
  background: rgba(15, 23, 42, 0.03);
  border-color: rgba(15, 23, 42, 0.08);
}

:global(.theme-light) .status-dot.online,
[data-theme="light"] .status-dot.online {
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  .nav-indicator {
    transition: none;
    opacity: 1;
  }
}
</style>
