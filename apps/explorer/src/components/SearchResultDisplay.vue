<template>
  <div v-if="result" class="result-section">
    <span class="section-title">{{ t("searchResult") }}</span>

    <!-- Transaction Result -->
    <NeoCard v-if="result.type === 'transaction'" variant="erobo" class="result-card">
      <div class="result-rows">
        <div class="result-row">
          <span class="label">{{ t("hash") }}</span>
          <span class="value mono">{{ result.data?.hash }}</span>
        </div>
        <div class="result-row">
          <span class="label">{{ t("block") }}</span>
          <span class="value mono">{{ result.data?.blockIndex }}</span>
        </div>
        <div class="result-row">
          <span class="label">{{ t("time") }}</span>
          <span class="value">{{ formatTime(result.data?.blockTime) }}</span>
        </div>
        <div class="result-row">
          <span class="label">{{ t("sender") }}</span>
          <span class="value mono">{{ result.data?.sender }}</span>
        </div>
      </div>
    </NeoCard>

    <!-- Address Result -->
    <NeoCard v-else-if="result.type === 'address'" :title="t('address')" variant="erobo" class="result-card">
      <div class="result-rows">
        <div class="result-row">
          <span class="label">{{ t("addressLabel") }}</span>
          <span class="value mono">{{ result.data?.address }}</span>
        </div>
        <div class="result-row">
          <span class="label">{{ t("transactionsLabel") }}</span>
          <span class="value mono">{{ result.data?.txCount }}</span>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  result: Record<string, unknown> | null;
  formatTime: (time: unknown) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.section-title {
  @include stat-label;
  color: var(--matrix-success, rgba(0, 229, 153, 1));
  margin-bottom: 12px;
  display: block;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.result-card {
  margin-bottom: 12px;
}

.result-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  @include card-base(12px, 12px);
  backdrop-filter: blur(5px);
  transition: background 0.2s;
  &:hover { background: var(--bg-card, rgba(255, 255, 255, 0.05)); }
}

.label {
  @include stat-label;
  font-weight: 600;
  margin-bottom: 4px;
  display: block;
}

.value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.mono {
  font-family: $font-mono;
}
</style>
