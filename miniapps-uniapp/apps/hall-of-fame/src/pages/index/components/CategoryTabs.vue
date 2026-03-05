<template>
  <view class="category-tabs-glass">
    <view
      v-for="c in categories"
      :key="c.id"
      class="category-tab-glass"
      :class="{ active: activeCategory === c.id }"
      @click="$emit('select', c.id)"
    >
      <text>{{ c.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  categories: { id: string; label: string }[];
  activeCategory: string;
}>();

defineEmits<{
  select: [id: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.category-tabs-glass {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  border-bottom: 1px solid var(--hof-divider);
  padding-bottom: 16px;
}

.category-tab-glass {
  padding: 8px 16px;
  background: transparent;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-muted);
  font-family: var(--hof-font);
  letter-spacing: 0.05em;

  &.active {
    color: var(--hof-accent);
    border-bottom: 2px solid var(--hof-accent);
  }
}
</style>
