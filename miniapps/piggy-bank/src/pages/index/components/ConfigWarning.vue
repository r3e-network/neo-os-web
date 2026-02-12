<template>
  <view v-if="issues.length > 0" class="config-warning">
    <text class="warning-title">{{ t("settings.missing_config") }}</text>
    <text v-for="issue in issues" :key="issue" class="warning-item"> • {{ issue }} </text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  issues: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
}>();
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;

.config-warning {
  margin: 0 20px 16px;
  border: 1px solid var(--piggy-warning-border);
  background: var(--piggy-warning-bg);
  padding: 12px 16px;
  border-radius: 12px;
}

.warning-title {
  font-weight: 700;
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.warning-item {
  display: block;
  font-size: 11px;
  opacity: 0.8;
}
</style>
