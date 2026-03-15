<template>
  <div class="sidebar-panel-content">
    <span v-if="title" class="sidebar-title">{{ title }}</span>
    <span v-if="description" class="sidebar-desc">{{ description }}</span>
    <div v-if="items.length" class="sidebar-items">
      <div v-for="item in items" :key="item.label" class="sidebar-item">
        <span class="sidebar-item-label">{{ item.label }}</span>
        <span class="sidebar-value">{{ item.value }}</span>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * SidebarPanel - Shared sidebar content for desktop layout
 *
 * Renders a title, optional description, and key-value stat items.
 * Uses DesktopLayout's built-in .sidebar-title / .sidebar-value styles.
 */
export interface SidebarItem {
  label: string;
  value: string | number;
}

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    items?: SidebarItem[];
  }>(),
  {
    title: "",
    description: "",
    items: () => [],
  }
);
</script>

<style lang="scss" scoped>
.sidebar-panel-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-tertiary, rgba(248, 250, 252, 0.5));
  margin-bottom: 4px;
}

.sidebar-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.sidebar-item-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, rgba(248, 250, 252, 0.55));
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

// Override .sidebar-value to be inline-sized for stat rows
.sidebar-item .sidebar-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
  text-align: right;
}
</style>
