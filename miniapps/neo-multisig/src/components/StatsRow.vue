<template>
  <view class="stats-row">
    <view class="stat-card">
      <text class="stat-value">{{ total }}</text>
      <text class="stat-label">{{ totalLabel }}</text>
    </view>
    <view class="stat-card">
      <text class="stat-value">{{ pending }}</text>
      <text class="stat-label">{{ pendingLabel }}</text>
    </view>
    <view class="stat-card">
      <text class="stat-value">{{ completed }}</text>
      <text class="stat-label">{{ completedLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  total: number;
  pending: number;
  completed: number;
  totalLabel: string;
  pendingLabel: string;
  completedLabel: string;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.stats-row {
  position: relative;
  z-index: 10;
  display: flex;
  gap: 12px;
}

.stat-card {
  flex: 1;
  background: var(--multi-card-soft);
  border: 1px solid var(--multi-border-soft);
  border-radius: 14px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 800;
  color: var(--multi-accent);
  margin-bottom: 4px;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: var(--multi-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

@media (max-width: 767px) {
  .stats-row {
    flex-direction: column;
    gap: 8px;
  }
  .stat-card {
    padding: 12px;
  }
}
</style>
