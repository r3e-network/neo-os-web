<template>
  <NeoCard variant="erobo" :title="t('walletAndMarket')" class="operation-card">
    <div class="stack">
      <NeoInput :modelValue="modelValue" @update:modelValue="$emit('update:modelValue', $event)" :label="t('marketHash')" :placeholder="t('marketHashPlaceholder')" />
      <NeoButton variant="secondary" type="button" :loading="isWalletConnecting" @click="handleConnect" :aria-label="walletAddress ? t('walletConnected') : t('connectWallet')">
        {{ walletAddress ? t("walletConnected") : t("connectWallet") }}
      </NeoButton>
      <NeoButton variant="primary" type="button" :loading="isLoading" @click="$emit('loadListings')" :aria-label="t('loadListings')">{{ t("loadListings") }}</NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { NeoButton, NeoCard, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  modelValue: string;
  walletAddress: string;
  isWalletConnecting: boolean;
  isLoading: boolean;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  loadListings: [];
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleConnect = async () => {
  const handler = actions.get("connectWallet");
  if (handler) await handler();
};
</script>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
