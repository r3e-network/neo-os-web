<template>
  <NeoCard variant="erobo" :title="t('manageListingTitle')" class="operation-card">
    <div v-if="selectedListing" class="stack">
      <div class="selection-summary">
        <div class="selection-summary__title">{{ selectedListing.title || t("untitledListing") }}</div>
        <div class="selection-summary__meta">
          <span>#{{ selectedListing.id }}</span>
          <span>{{ selectedListing.priceGas }} {{ t("tokenGas") }}</span>
          <span>{{ selectedListing.status }}</span>
        </div>
      </div>

      <NeoInput
        :modelValue="nextPriceGas"
        @update:modelValue="nextPriceGas = $event"
        :label="t('newPriceInput')"
        :hint="t('newPriceHint')"
        :placeholder="t('newPricePlaceholder')"
        :disabled="!canManage"
      />

      <NeoButton
        v-if="canManage"
        variant="primary"
        type="button"
        :loading="isSubmitting"
        :disabled="!nextPriceGas.trim()"
        @click="handleUpdatePrice"
        :aria-label="t('updatePriceCta')"
      >
        {{ t("updatePriceCta") }}
      </NeoButton>

      <NeoButton
        v-if="canManage"
        variant="secondary"
        type="button"
        :loading="isSubmitting"
        @click="handleCancel"
        :aria-label="t('cancelListingCta')"
      >
        {{ t("cancelListingCta") }}
      </NeoButton>

      <NeoInput
        v-if="canBuy"
        :modelValue="newBackupOwner"
        @update:modelValue="newBackupOwner = $event"
        :label="t('newBackupOwnerInput')"
        :hint="t('newBackupOwnerHint')"
        :placeholder="t('newBackupOwnerPlaceholder')"
      />

      <NeoButton
        v-if="canBuy"
        variant="primary"
        type="button"
        :loading="isSubmitting"
        @click="handleBuy"
        :aria-label="t('buyListingCta')"
      >
        {{ t("buyListingCta") }}
      </NeoButton>

      <NeoButton
        v-if="hasPendingRefund"
        variant="secondary"
        type="button"
        :loading="isSubmitting"
        @click="handleRefund"
        :aria-label="t('refundPendingCta')"
      >
        {{ t("refundPendingCta") }}
      </NeoButton>
    </div>

    <p v-else class="hint-text">
      {{ t("selectListingHint") }}
    </p>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, inject, watch } from "vue";
import { NeoButton, NeoCard, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import type { MarketListing } from "../utils/aa-market";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedListing: MarketListing | null;
  isSubmitting: boolean;
  canManage: boolean;
  canBuy: boolean;
  hasPendingRefund: boolean;
  walletAddress: string;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const nextPriceGas = ref("");
const newBackupOwner = ref("");

watch(() => props.selectedListing, (listing) => {
  if (listing) {
    nextPriceGas.value = listing.priceGas;
    newBackupOwner.value = props.walletAddress;
  }
});

const handleUpdatePrice = async () => {
  const handler = actions.get("updatePrice");
  if (handler) await handler(nextPriceGas.value);
};

const handleCancel = async () => {
  const handler = actions.get("cancelSelected");
  if (handler) await handler();
};

const handleBuy = async () => {
  const handler = actions.get("buySelected");
  if (handler) await handler(newBackupOwner.value);
};

const handleRefund = async () => {
  const handler = actions.get("refundSelected");
  if (handler) await handler();
};
</script>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.selection-summary {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.selection-summary__title {
  font-size: 14px;
  font-weight: 700;
}

.selection-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.hint-text {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
