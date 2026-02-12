<template>
  <NeoCard class="mb-6" variant="erobo">
    <template #header-extra>
      <text class="section-icon">🔎</text>
    </template>

    <NeoInput
      :modelValue="queryInput"
      @update:modelValue="$emit('update:queryInput', $event)"
      :label="t('queryLabel')"
      :placeholder="t('queryPlaceholder')"
      class="mb-4"
    />

    <NeoButton
      variant="primary"
      block
      @click="$emit('query')"
      :loading="isLoading"
      :disabled="!queryInput.trim()"
      class="mb-4"
    >
      {{ t("queryRecord") }}
    </NeoButton>

    <view v-if="queryResult" class="result-card-neo">
      <view class="result-header">
        <text class="result-title">{{ t("queryResult") }}</text>
        <view class="result-badge">{{ t("resultHit") }}</view>
      </view>
      <view class="result-info">
        <view class="result-row">
          <text class="result-label">{{ t("recordId") }}</text>
          <text class="result-val">#{{ queryResult.id }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">{{ t("rating") }}</text>
          <text class="result-val">{{ queryResult.rating }} / 5</text>
        </view>
        <view class="result-row">
          <text class="result-label">{{ t("totalQueries") }}</text>
          <text class="result-val">{{ queryResult.queryCount }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">{{ t("hashLabel") }}</text>
          <text class="result-val word-break mono">{{ queryResult.dataHash }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

export interface RecordItem {
  id: number;
  dataHash: string;
  rating: number;
  queryCount: number;
  createTime: number;
  active: boolean;
  date: string;
  hashShort: string;
  category?: number;
}

defineProps<{
  queryInput: string;
  queryResult: RecordItem | null;
  isLoading: boolean;
  t: (key: string, ...args: unknown[]) => string;
}>();

defineEmits(["update:queryInput", "query"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.section-icon {
  font-size: 20px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.result-card-neo {
  background: rgba(159, 157, 243, 0.1);
  border: 1px solid rgba(159, 157, 243, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  position: relative;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.result-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.result-badge {
  background: var(--noir-status-active);
  color: var(--noir-text);
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-label {
  font-size: 10px;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-weight: 600;
}

.result-val {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  &.mono {
    font-family: $font-mono;
    font-size: 11px;
  }
}

.word-break {
  word-break: break-all;
}
</style>
