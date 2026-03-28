<template>
  <NeoCard variant="erobo-neo" class="search-card">
    <div class="search-box">
      <NeoInput
        :modelValue="searchQuery"
        @update:modelValue="$emit('update:searchQuery', $event)"
        :placeholder="t('searchPlaceholder')"
        @confirm="$emit('search')"
        class="search-input"
      />
      <NeoButton
        type="button"
        variant="primary"
        block
        :loading="isSearching"
        @click="$emit('search')"
      >
        {{ t("search") }}
      </NeoButton>
    </div>

    <div class="network-toggle">
      <NeoButton
        :variant="selectedNetwork === 'mainnet' ? 'success' : 'secondary'"
        size="sm"
        class="toggle-btn"
        @click="$emit('update:selectedNetwork', 'mainnet')"
      >
        {{ t("mainnet") }}
      </NeoButton>
      <NeoButton
        :variant="selectedNetwork === 'testnet' ? 'warning' : 'secondary'"
        size="sm"
        class="toggle-btn"
        @click="$emit('update:selectedNetwork', 'testnet')"
      >
        {{ t("testnet") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  searchQuery: string;
  selectedNetwork: "mainnet" | "testnet";
  isSearching: boolean;
}>();

defineEmits<{
  "update:searchQuery": [value: string];
  "update:selectedNetwork": [value: "mainnet" | "testnet"];
  search: [];
}>();
</script>

<style lang="scss" scoped>
.search-card {
  width: 100%;
}

.search-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.network-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 16px;
}
</style>
