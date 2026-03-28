<template>
  <NeoCard variant="erobo" :title="t('createListingTitle')" class="operation-card">
    <div class="stack">
      <NeoInput
        :modelValue="aaContractHash"
        @update:modelValue="aaContractHash = $event"
        :label="t('aaContractInput')"
        :hint="t('aaContractHint')"
        :placeholder="t('aaContractHashPlaceholder')"
      />
      <NeoInput
        :modelValue="accountIdHash"
        @update:modelValue="accountIdHash = $event"
        :label="t('accountIdInput')"
        :hint="t('accountIdHint')"
        :placeholder="t('accountIdHashPlaceholder')"
      />
      <NeoInput :modelValue="priceGas" @update:modelValue="priceGas = $event" :label="t('priceInput')" :placeholder="t('pricePlaceholder')" />
      <NeoInput :modelValue="listingTitle" @update:modelValue="listingTitle = $event" :label="t('titleInput')" :placeholder="t('titlePlaceholder')" />
      <NeoInput
        :modelValue="metadataUri"
        @update:modelValue="metadataUri = $event"
        type="textarea"
        :label="t('metadataInput')"
        :placeholder="t('metadataPlaceholder')"
      />
      <NeoButton variant="primary" type="button" :loading="isSubmitting" :disabled="!canCreateListing" @click="handleCreate" :aria-label="t('createListingCta')">
        {{ t("createListingCta") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, inject } from "vue";
import { NeoButton, NeoCard, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  isSubmitting: boolean;
  canCreateListing: boolean;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const aaContractHash = ref("");
const accountIdHash = ref("");
const priceGas = ref("");
const listingTitle = ref("");
const metadataUri = ref("");

const handleCreate = async () => {
  const handler = actions.get("createListing");
  if (handler) {
    await handler(
      aaContractHash.value,
      accountIdHash.value,
      priceGas.value,
      listingTitle.value,
      metadataUri.value,
    );
    accountIdHash.value = "";
    priceGas.value = "";
    listingTitle.value = "";
    metadataUri.value = "";
  }
};
</script>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
