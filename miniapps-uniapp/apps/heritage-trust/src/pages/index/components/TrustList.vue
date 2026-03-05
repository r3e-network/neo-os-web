<template>
  <view class="trust-list">
    <view class="section-header">
      <text class="section-title">{{ title }}</text>
      <text class="count-badge">{{ trusts.length }}</text>
    </view>
    <ItemList :items="trusts" item-key="id">
      <template #empty>
        <NeoCard variant="erobo" class="p-8 text-center opacity-60">
          <text class="mb-2 block">{{ emptyIcon }}</text>
          <text class="text-xs">{{ emptyText }}</text>
        </NeoCard>
      </template>
      <template #item="{ item: trust }">
        <TrustCard
          :trust="trust"
          @heartbeat="$emit('heartbeat', trust)"
          @claimYield="$emit('claimYield', trust)"
          @execute="$emit('execute', trust)"
          @claimReleased="$emit('claimReleased', trust)"
        />
      </template>
    </ItemList>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import TrustCard, { type Trust } from "./TrustCard.vue";

defineProps<{
  trusts: Trust[];
  title: string;
  emptyText: string;
  emptyIcon: string;
}>();

defineEmits<{
  heartbeat: [trust: Trust];
  claimYield: [trust: Trust];
  execute: [trust: Trust];
  claimReleased: [trust: Trust];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.trust-list {
  margin-bottom: 32px;
}

.section-header {
  @include section-header;
}

.section-title {
  @include section-title;
  font-weight: 800;
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
