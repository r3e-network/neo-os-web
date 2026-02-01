<template>
  <NeoCard variant="erobo" class="recent-vaults">
    <text class="section-title">{{ title }}</text>
    <view v-if="vaults.length === 0" class="empty-state">
      <text class="empty-text">{{ emptyText }}</text>
    </view>
    <view v-else class="vault-list">
      <view v-for="vault in vaults" :key="vault.id" class="vault-item" @click="$emit('select', vault.id)">
        <view class="vault-meta">
          <text class="vault-id">#{{ vault.id }}</text>
          <text class="vault-bounty">{{ formatGas(vault.bounty) }} GAS</text>
        </view>
        <text class="vault-creator mono">{{ vault.creator ? shortenAddress(vault.creator) : formatDate(vault.created) }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

interface Vault {
  id: string;
  creator?: string;
  bounty: number;
  created?: number;
}

defineProps<{
  t: (key: string) => string;
  title: string;
  emptyText: string;
  vaults: Vault[];
}>();

defineEmits<{
  (e: "select", id: string): void;
}>();

const shortenAddress = (addr: string): string => {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
};

const formatGas = (value: number): string => {
  return value.toFixed(4);
};

const formatDate = (ts?: number): string => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString();
};
</script>

<style lang="scss" scoped>
.recent-vaults {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 8px;
}
.vault-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.vault-item {
  padding: 16px;
  border-radius: 16px;
  background: var(--vault-bg);
  cursor: pointer;
  transition: transform 0.1s;
}
.vault-meta {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
}
.vault-id {
  font-size: 14px;
}
.vault-bounty {
  font-size: 14px;
  color: var(--vault-accent);
}
.vault-creator {
  font-size: 12px;
  color: var(--vault-text-subtle);
  margin-top: 6px;
}
.empty-state {
  text-align: center;
  padding: 24px;
  opacity: 0.5;
}
.empty-text {
  font-size: 13px;
  font-style: italic;
}
.mono {
  font-family: monospace;
}
</style>
