<template>
  <view class="mb-4">
    <NeoInput v-model="localQuery" :placeholder="t('searchPlaceholder')" suffix=".neo" @input="onSearch" />
  </view>

  <NeoCard
    v-if="localQuery && searchResult"
    :variant="searchResult.available ? 'success' : 'danger'"
    class="result-card"
  >
    <view class="result-header">
      <view class="domain-title-row">
        <text class="result-domain">{{ localQuery }}.neo</text>
        <text v-if="localQuery.length <= 3" class="premium-badge">{{ t("premium") }}</text>
      </view>
      <text
        class="result-status font-bold uppercase"
        :class="searchResult.available ? 'text-green-700' : 'text-red-700'"
      >
        {{ searchResult.available ? t("available") : t("taken") }}
      </text>
    </view>
    <view v-if="searchResult.available" class="result-body">
      <view class="price-display">
        <text class="price-label">{{ t("registrationPrice") }}</text>
        <text class="price-value" :class="{ 'premium-price': localQuery.length <= 3 }">
          {{ searchResult.price }} GAS
        </text>
        <text class="price-period">{{ t("perYear") }}</text>
      </view>
      <NeoButton :disabled="loading" :loading="loading" @click="$emit('register')" block size="lg" variant="primary">
        {{ t("registerNow") }}
      </NeoButton>
    </view>
    <view v-else class="result-body taken-body">
      <view class="owner-info">
        <text class="owner-label">{{ t("owner") }}</text>
        <text class="owner-value">{{ formatAddress(searchResult.owner!) }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { SearchResult } from "@/types";

const props = defineProps<{
  searchQuery: string;
  searchResult: SearchResult | null;
  loading: boolean;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "search"): void;
  (e: "register"): void;
}>();

const localQuery = ref(props.searchQuery);

watch(
  () => props.searchQuery,
  (newVal) => {
    localQuery.value = newVal;
  }
);

watch(localQuery, (newVal) => {
  emit("update:searchQuery", newVal);
});

const onSearch = () => {
  emit("search");
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.result-card {
  margin-top: 24px;
  background: var(--dir-card-bg);
  border: 2px solid var(--dir-card-border);

  &.variant-success {
    border-color: var(--dir-green);
    box-shadow: 0 0 20px var(--dir-green);
  }
  &.variant-danger {
    border-color: var(--dir-danger);
    box-shadow: 0 0 20px var(--dir-danger);
  }
}

.result-header {
  padding: 20px;
  border-bottom: 1px dashed var(--dir-card-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.domain-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-domain {
  font-weight: 700;
  font-family: var(--dir-font);
  font-size: 20px;
  color: var(--dir-card-text);
  text-transform: uppercase;
}

.premium-badge {
  background: var(--dir-green);
  color: var(--dir-bg);
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid var(--dir-green);
}

.result-status {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 6px 14px;
  border: 1px solid;

  &.text-green-700 {
    background: transparent;
    color: var(--dir-green) !important;
    border-color: var(--dir-green);
    animation: blink 1s infinite;
  }
  &.text-red-700 {
    background: transparent;
    color: var(--dir-danger) !important;
    border-color: var(--dir-danger);
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
  }
}

.result-body {
  padding: 20px;
}

.price-display {
  background: var(--dir-price-bg);
  border: 1px solid var(--dir-price-border);
  padding: 24px;
  margin-bottom: 24px;
  text-align: center;
}

.price-label {
  @include stat-label;
  display: block;
  margin-bottom: 8px;
  color: var(--dir-card-text);
}

.price-value {
  font-weight: 700;
  font-size: 32px;
  font-family: var(--dir-font);
  color: var(--dir-card-text);

  &.premium-price {
    color: var(--dir-warning);
    text-shadow: var(--dir-warning-glow);
  }
}

.price-period {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 8px;
  color: var(--dir-text-muted);
}

.owner-info {
  background: var(--dir-danger-bg);
  border: 1px solid var(--dir-danger-border);
  padding: 16px;
  color: var(--dir-danger-text);
}

.owner-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  display: block;
  color: var(--dir-danger-text);
  margin-bottom: 4px;
}

.owner-value {
  font-family: var(--dir-font);
  font-size: 14px;
  font-weight: 600;
  color: var(--dir-danger-text);
}
</style>
