<template>
  <NeoCard class="details-card">
    <text class="card-title">{{ t("detailsTitle") }}</text>
    <view class="detail-row">
      <text class="label">{{ t("detailId") }}</text>
      <text
        class="value copy"
        role="button"
        :aria-label="t('copy')"
        tabindex="0"
        @click="$emit('copy', request.id)"
        @keydown.enter="$emit('copy', request.id)"
        >{{ request.id }} ({{ t("copy") }})</text
      >
    </view>
    <view class="detail-row">
      <text class="label">{{ t("detailMemo") }}</text>
      <text class="value">{{ request.memo || t("detailMemoNone") }}</text>
    </view>
    <view class="detail-row">
      <text class="label">{{ t("detailChain") }}</text>
      <text class="value">{{ chainLabel }}</text>
    </view>
    <view class="raw-data">
      <text class="label">{{ t("detailRawTx") }}</text>
      <textarea class="raw-input" :value="request.transaction_hex" disabled />
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { MultisigRequest } from "../../../services/api";

defineProps<{
  request: MultisigRequest;
  chainLabel: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  copy: [value: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.details-card {
  margin-bottom: 24px;
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  display: block;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.label {
  color: var(--text-secondary);
}

.value {
  font-family: $font-mono;
  text-align: right;
}

.raw-data {
  margin-top: 16px;
}

.raw-input {
  width: 100%;
  height: 80px;
  background: var(--multisig-input-bg);
  border: 1px solid var(--multisig-border);
  border-radius: 8px;
  padding: 8px;
  font-size: 10px;
  font-family: $font-mono;
  color: var(--text-secondary);
}
</style>
