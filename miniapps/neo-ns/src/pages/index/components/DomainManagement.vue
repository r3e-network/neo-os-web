<template>
  <NeoCard icon="folder">
    <view v-if="domains.length === 0" class="empty-state">
      <text>{{ t("noDomains") }}</text>
    </view>
    <view v-for="domain in domains" :key="domain.name" class="domain-item mb-4 pb-4 border-b border-gray-200">
      <view class="domain-card-header mb-2 flex justify-between">
        <view class="domain-info">
          <text class="domain-name font-bold text-lg">{{ domain.name }}</text>
          <text class="domain-expiry text-sm text-gray-500"
            >{{ t("expires") }}: {{ formatDate(domain.expiry) }}</text
          >
        </view>
        <view class="domain-status-indicator active"></view>
      </view>
      <view class="domain-actions flex gap-2">
        <NeoButton size="sm" variant="secondary" @click="$emit('manage', domain)">{{ t("manage") }}</NeoButton>
        <NeoButton size="sm" variant="primary" @click="$emit('renew', domain)">{{ t("renew") }}</NeoButton>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";

interface Domain {
  name: string;
  owner: string;
  expiry: number;
  target?: string;
}

defineProps<{
  t: (key: string) => string;
  domains: Domain[];
}>();

defineEmits<{
  (e: "manage", domain: Domain): void;
  (e: "renew", domain: Domain): void;
}>();

const formatDate = (ts: number): string => {
  return new Date(ts).toLocaleDateString();
};
</script>

<style lang="scss" scoped>
.domain-item {
  padding: 20px;
  margin-bottom: 16px;
}
.domain-info {
  margin-bottom: 16px;
  border-left: 3px solid var(--dir-card-border);
  padding-left: 16px;
}
.domain-name {
  font-weight: 700;
  font-size: 20px;
  display: block;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.domain-expiry {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
}
.domain-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.empty-state {
  text-align: center;
  padding: 48px;
  border: 1px dashed var(--dir-card-border);
}
</style>
