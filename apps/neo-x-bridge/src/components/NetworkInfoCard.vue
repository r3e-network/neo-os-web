<template>
  <NeoCard variant="erobo" class="network-card">
    <div class="network-header">
      <span class="network-name">{{ networkName }}</span>
      <span class="chain-id">{{ t("chainId") }}: {{ chainId }}</span>
    </div>
    <div class="network-detail">
      <span class="detail-label">{{ t("bridgeUrl") }}</span>
      <span class="detail-value">{{ bridgeUrl }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  networkName: string;
  chainId: string;
  bridgeUrl: string;
}>();
</script>

<style lang="scss" scoped>
.network-card {
  width: 100%;
}

.network-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.network-name {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.chain-id {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
}

.network-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
}

.detail-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}
</style>
