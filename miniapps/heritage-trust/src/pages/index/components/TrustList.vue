<template>
  <view class="trust-list">
    <view class="section-header">
      <text class="section-title">{{ title }}</text>
      <text class="count-badge">{{ trusts.length }}</text>
    </view>
    <view v-if="trusts.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-8 text-center opacity-60">
        <text class="block mb-2">{{ emptyIcon }}</text>
        <text class="text-xs">{{ emptyText }}</text>
      </NeoCard>
    </view>
    <view v-for="trust in trusts" :key="trust.id">
      <TrustCard
        :trust="trust"
        :t="t"
        @heartbeat="$emit('heartbeat', trust)"
        @claimYield="$emit('claimYield', trust)"
        @execute="$emit('execute', trust)"
        @claimReleased="$emit('claimReleased', trust)"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import TrustCard, { type Trust } from "./TrustCard.vue";

defineProps<{
  trusts: Trust[];
  title: string;
  emptyText: string;
  emptyIcon: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  heartbeat: [trust: Trust];
  claimYield: [trust: Trust];
  execute: [trust: Trust];
  claimReleased: [trust: Trust];
}>();
</script>

<style lang="scss" scoped>
.trust-list {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.section-title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--heritage-section-title);
}

.count-badge {
  background: var(--heritage-badge-bg);
  color: var(--heritage-badge-text);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

.empty-state {
  margin-bottom: 24px;
}

.text-xs {
  font-size: 12px;
}

.mb-2 {
  margin-bottom: 8px;
}

.p-8 {
  padding: 32px;
}

.block {
  display: block;
}
</style>
