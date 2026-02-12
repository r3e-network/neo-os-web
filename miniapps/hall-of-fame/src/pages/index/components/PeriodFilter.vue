<template>
  <view class="period-filter-glass">
    <view
      v-for="p in periods"
      :key="p.id"
      class="period-btn-glass"
      :class="{ active: activePeriod === p.id }"
      @click="$emit('select', p.id)"
    >
      <text>{{ p.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  periods: { id: string; label: string }[];
  activePeriod: string;
}>();

defineEmits<{
  select: [id: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.period-filter-glass {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.period-btn-glass {
  padding: 4px 12px;
  border: 1px solid var(--hof-divider);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;

  &.active {
    background: var(--hof-accent);
    color: var(--hof-button-text);
    border-color: var(--hof-accent);
  }
}
</style>
