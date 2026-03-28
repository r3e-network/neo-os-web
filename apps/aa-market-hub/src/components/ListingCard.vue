<template>
  <NeoCard
    variant="erobo"
    class="listing-card"
    :class="{ 'listing-card--selected': isSelected }"
  >
    <div class="listing-card__header">
      <div>
        <div class="listing-card__title">
          <span>#{{ listing.id }}</span>
          <span class="chip" :class="`chip--${listing.status}`">{{ listing.status }}</span>
          <span v-if="listing.isMine" class="chip chip--mine">{{ t("mine") }}</span>
          <span v-if="hasPendingPayment" class="chip chip--pending">{{ t("pendingRefund") }}</span>
        </div>
        <p class="listing-card__subtitle">{{ listing.title || t("untitledListing") }}</p>
      </div>
      <NeoButton variant="secondary" type="button" @click="$emit('select', listing)" :aria-label="isSelected ? t('selected') : t('selectListing')">
        {{ isSelected ? t("selected") : t("selectListing") }}
      </NeoButton>
    </div>

    <div class="row"><span class="label">{{ t("priceLabel") }}</span><span class="value">{{ listing.priceGas }} {{ t("tokenGas") }}</span></div>
    <div class="row"><span class="label">{{ t("aaContractLabel") }}</span><span class="value">{{ listing.aaContractHash }}</span></div>
    <div class="row"><span class="label">{{ t("accountIdLabel") }}</span><span class="value">{{ listing.accountIdHash }}</span></div>
    <div class="row"><span class="label">{{ t("sellerLabel") }}</span><span class="value">{{ listing.seller || t("notAvailable") }}</span></div>
    <div class="row"><span class="label">{{ t("buyerLabel") }}</span><span class="value">{{ listing.buyer || t("notAvailable") }}</span></div>
    <div v-if="listing.metadataUri" class="row">
      <span class="label">{{ t("metadataLabel") }}</span>
      <a class="value value--link" :href="listing.metadataUri" target="_blank" rel="noopener noreferrer" :aria-label="t('viewMetadata')">{{ listing.metadataUri }}</a>
    </div>
    <div v-if="hasPendingPayment" class="row">
      <span class="label">{{ t("myPendingPayment") }}</span>
      <span class="value">{{ formatGasFractionsLocal(listing.myPendingPayment) }} {{ t("tokenGas") }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton, NeoCard } from "@shared/components";
import { formatGasFractions, type MarketListing } from "../utils/aa-market";

const props = defineProps<{
  listing: MarketListing;
  isSelected: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  select: [listing: MarketListing];
}>();

const hasPendingPayment = computed(() => BigInt(props.listing.myPendingPayment || "0") > 0n);
const formatGasFractionsLocal = formatGasFractions;
</script>

<style scoped>
.listing-card {
  padding: 16px;
  border: 1px solid transparent;
}

.listing-card--selected {
  border-color: rgba(159, 157, 243, 0.45);
  box-shadow: 0 0 0 1px rgba(159, 157, 243, 0.24);
}

.listing-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.listing-card__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
}

.listing-card__subtitle {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

.row {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 10px;
  padding: 7px 0;
}

.label {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.value {
  font-size: 13px;
  word-break: break-all;
}

.value--link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.3);
}

.chip {
  --market-active: #8ef0aa;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: rgba(255, 255, 255, 0.08);
}

.chip--active {
  background: rgba(34, 197, 94, 0.16);
  color: var(--market-active);
}

.chip--sold {
  background: rgba(59, 130, 246, 0.16);
  color: var(--text-primary);
}

.chip--cancelled {
  background: rgba(248, 113, 113, 0.16);
  color: var(--text-primary);
}

.chip--mine {
  background: rgba(250, 204, 21, 0.16);
  color: var(--text-primary);
}

.chip--pending {
  background: rgba(244, 114, 182, 0.16);
  color: var(--text-primary);
}
</style>
