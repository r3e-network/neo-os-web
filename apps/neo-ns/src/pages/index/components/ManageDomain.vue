<template>
  <div class="manage-view">
    <NeoCard class="mb-4">
      <div class="manage-header mb-4">
        <span class="manage-title text-xl font-bold">{{ t("manageTitle") }}: {{ domain.name }}</span>
        <NeoButton size="sm" variant="secondary" type="button" @click="$emit('cancel')" :aria-label="t('cancelManage')">{{ t("cancelManage") }}</NeoButton>
      </div>

      <div class="manage-details mb-4">
        <span class="detail-label">{{ t("currentOwner") }}:</span>
        <span class="detail-value mono">{{ formatAddress(domain.owner) }}</span>
        <span class="detail-label mt-2">{{ t("targetAddress") }}:</span>
        <span class="detail-value mono">{{ domain.target ? formatAddress(domain.target) : t("notSet") }}</span>
        <span class="detail-label mt-2">{{ t("currentExpiry") }}:</span>
        <span class="detail-expiry">{{ formatDate(domain.expiry) }}</span>
      </div>

      <div class="manage-actions-group">
        <div class="action-card mb-4">
          <span class="action-title mb-2 block font-bold">{{ t("setTarget") }}</span>
          <NeoInput v-model="targetInput" :placeholder="t('targetAddress')" class="mb-2" />
          <NeoButton :loading="loading" :disabled="loading" block type="button" @click="$emit('setTarget', targetInput)" :aria-label="t('setTarget')">{{
            t("setTarget")
          }}</NeoButton>
        </div>

        <div class="action-card">
          <span class="action-title mb-2 block font-bold text-red-500">{{ t("transferDomain") }}</span>
          <NeoInput v-model="transferInput" :placeholder="t('receiverAddress')" class="mb-2" />
          <NeoButton
            :loading="loading"
            :disabled="loading"
            block
            variant="danger"
            type="button"
            @click="$emit('transfer', transferInput)"
            :aria-label="t('transferDomain')"
            >{{ t("transferDomain") }}</NeoButton
          >
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { Domain } from "@/types";

const props = defineProps<{
  domain: Domain | null;
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en");
}
</script>

<style lang="scss" scoped>
.manage-view {
  animation: fadeIn 0.3s ease;
}

.manage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--dir-card-border);
  padding-bottom: 12px;
}

.manage-title {
  color: var(--dir-card-text);
  text-transform: uppercase;
}

.manage-details {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 12px;
  color: var(--dir-text-muted);
  opacity: 0.7;
  text-transform: uppercase;
  display: block;
}

.detail-value,
.detail-expiry {
  font-size: 16px;
  color: var(--dir-card-text);
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.mono {
  font-family: var(--dir-font);
}

.manage-actions-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-card {
  border: 1px dashed var(--dir-card-border);
  padding: 16px;
}

.action-title {
  color: var(--dir-card-text);
  text-transform: uppercase;
  font-size: 12px;
}

.text-red-500 {
  color: var(--dir-danger-text) !important;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
