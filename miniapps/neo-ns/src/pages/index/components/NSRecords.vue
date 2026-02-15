<template>
  <NeoCard class="mb-4">
    <view class="manage-header mb-4">
      <text class="manage-title text-xl font-bold">{{ t("manageTitle") }}: {{ domain.name }}</text>
      <NeoButton size="sm" variant="secondary" @click="$emit('cancel')">{{ t("cancelManage") }}</NeoButton>
    </view>

    <view class="manage-details mb-4">
      <text class="detail-label">{{ t("currentOwner") }}:</text>
      <text class="detail-value mono">{{ formatAddress(domain.owner) }}</text>
      <text class="detail-label mt-2">{{ t("targetAddress") }}:</text>
      <text class="detail-value mono">{{ domain.target ? formatAddress(domain.target) : t("notSet") }}</text>
      <text class="detail-label mt-2">{{ t("currentExpiry") }}:</text>
      <text class="detail-expiry">{{ formatDate(domain.expiry) }}</text>
    </view>

    <view class="manage-actions-group">
      <view class="action-card mb-4">
        <text class="action-title mb-2 block font-bold">{{ t("setTarget") }}</text>
        <NeoInput v-model="targetInput" :placeholder="t('targetAddress')" class="mb-2" />
        <NeoButton :loading="loading" :disabled="loading" block @click="$emit('setTarget', targetInput)">{{
          t("setTarget")
        }}</NeoButton>
      </view>

      <view class="action-card">
        <text class="action-title mb-2 block font-bold text-red-500">{{ t("transferDomain") }}</text>
        <NeoInput v-model="transferInput" :placeholder="t('receiverAddress')" class="mb-2" />
        <NeoButton
          :loading="loading"
          :disabled="loading"
          block
          variant="danger"
          @click="$emit('transfer', transferInput)"
          >{{ t("transferDomain") }}</NeoButton
        >
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { Domain } from "@/types";

const props = defineProps<{
  domain: Domain;
  loading: boolean;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "setTarget", address: string): void;
  (e: "transfer", address: string): void;
}>();

const targetInput = ref("");
const transferInput = ref("");

const formatDate = (ts: number): string => {
  return new Date(ts).toLocaleDateString();
};
</script>

<style lang="scss" scoped>
.manage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--dir-card-border);
  padding-bottom: 12px;
}
.manage-title {
  text-transform: uppercase;
}
.detail-label {
  font-size: 12px;
  opacity: 0.7;
  text-transform: uppercase;
  display: block;
}
.detail-value,
.detail-expiry {
  font-size: 16px;
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}
.mono {
  font-family: monospace;
}
.action-card {
  border: 1px dashed var(--dir-card-border);
  padding: 16px;
}
.action-title {
  text-transform: uppercase;
  font-size: 12px;
}
.text-red-500 {
  color: var(--ns-danger);
}
</style>
