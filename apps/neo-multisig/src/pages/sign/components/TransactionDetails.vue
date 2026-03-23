<template>
  <NeoCard class="details-card">
    <span class="card-title">{{ t("detailsTitle") }}</span>
    <div class="detail-row">
      <span class="label">{{ t("detailId") }}</span>
      <button
        type="button"
        class="value copy"
        :aria-label="t('copy')"
        @click="$emit('copy', request.id)"
      >{{ request.id }} ({{ t("copy") }})</button>
    </div>
    <div class="detail-row">
      <span class="label">{{ t("detailMemo") }}</span>
      <span class="value">{{ request.memo || t("detailMemoNone") }}</span>
    </div>
    <div class="detail-row">
      <span class="label">{{ t("detailChain") }}</span>
      <span class="value">{{ chainLabel }}</span>
    </div>
    <div class="raw-data">
      <span class="label">{{ t("detailRawTx") }}</span>
      <textarea id="raw-transaction-hex" class="raw-input" :value="request.transaction_hex" disabled :aria-label="t('detailRawTx')" />
    </div>
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

.value.copy {
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
  color: var(--text-secondary);
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
