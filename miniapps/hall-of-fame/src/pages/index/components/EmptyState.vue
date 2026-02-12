<template>
  <NeoCard variant="erobo" class="empty-state-card">
    <view class="empty-state-content">
      <text class="empty-state-title">{{ title }}</text>
      <text v-if="subtitle" class="empty-state-subtitle">{{ subtitle }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.empty-state-card {
  text-align: center;
  border: 2px dashed var(--hof-empty-border) !important;
  background: transparent !important;
  box-shadow: none !important;
}

.empty-state-content {
  padding: 40px;
}

.empty-state-title {
  font-weight: 700;
  color: var(--text-muted);
  font-family: var(--hof-font);
  font-size: 18px;
}

.empty-state-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  display: block;
}
</style>
