<template>
  <NeoCard variant="erobo-neo" class="mb-6">
    <view class="search-box-neo mb-4">
      <NeoInput
        :modelValue="searchQuery"
        @update:modelValue="$emit('update:searchQuery', $event)"
        :placeholder="t('searchPlaceholder')"
        @confirm="$emit('search')"
        class="mb-2 flex-1"
      />
      <NeoButton variant="primary" block @click="$emit('search')" :loading="isLoading">
        {{ t("search") }}
      </NeoButton>
    </view>

    <view class="network-toggle flex gap-2">
      <NeoButton
        :variant="selectedNetwork === 'mainnet' ? 'success' : 'secondary'"
        size="sm"
        class="flex-1"
        @click="$emit('update:selectedNetwork', 'mainnet')"
      >
        {{ t("mainnet") }}
      </NeoButton>
      <NeoButton
        :variant="selectedNetwork === 'testnet' ? 'warning' : 'secondary'"
        size="sm"
        class="flex-1"
        @click="$emit('update:selectedNetwork', 'testnet')"
      >
        {{ t("testnet") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

defineProps<{
  searchQuery: string;
  selectedNetwork: "mainnet" | "testnet";
  isLoading: boolean;
  t: (key: string, ...args: unknown[]) => string;
}>();

defineEmits(["update:searchQuery", "update:selectedNetwork", "search"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.search-box-neo {
  display: flex;
  flex-direction: column;
}
.mb-2 {
  margin-bottom: 8px;
}
.mb-4 {
  margin-bottom: 16px;
}
.mb-6 {
  margin-bottom: 24px;
}
.network-toggle {
  margin-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.flex-1 {
  flex: 1;
}
</style>
