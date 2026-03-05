<template>
  <MiniAppPage
    name="red-envelope"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="!!luckyMessage"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadEnvelopes"
  >
    <!-- Create Tab (default) - LEFT panel -->
    <template #content>
      <LuckyOverlay :lucky-message="luckyMessage" @close="luckyMessage = null" />
      <OpeningModal
        :visible="showOpeningModal"
        :envelope="openingEnvelope"
        :is-connected="!!address"
        :is-opening="!!openingId"
        :eligibility="address ? { isEligible, neoBalance, holdingDays, reason: eligibilityReason } : null"
        @connect="handleConnect"
        @open="() => openingEnvelope && openEnvelope(openingEnvelope)"
        @close="showOpeningModal = false"
      />
    </template>
    <template #operation>
      <CreateForm
        :is-loading="isLoading"
        v-model:name="name"
        v-model:description="description"
        v-model:amount="amount"
        v-model:count="count"
        v-model:expiryHours="expiryHours"
        v-model:minNeoRequired="minNeoRequired"
        v-model:minHoldDays="minHoldDays"
        v-model:envelopeType="envelopeType"
        @create="create"
      />
    </template>

    <!-- Claim Tab -->
    <template #tab-claim>
      <ClaimPool :pools="pools" @claim="handleClaimFromPool" />
    </template>

    <!-- My Envelopes Tab -->
    <template #tab-myEnvelopes>
      <LuckyOverlay :lucky-message="luckyMessage" @close="luckyMessage = null" />
      <OpeningModal
        :visible="showOpeningModal"
        :envelope="openingEnvelope"
        :claim="openingClaim"
        :is-connected="!!address"
        :is-opening="!!openingId"
        :eligibility="
          openingClaim ? null : address ? { isEligible, neoBalance, holdingDays, reason: eligibilityReason } : null
        "
        @connect="handleConnect"
        @open="() => openingEnvelope && openEnvelope(openingEnvelope)"
        @open-claim="handleOpenClaim"
        @close="showOpeningModal = false"
      />
      <TransferModal
        :visible="showTransferModal"
        :envelope="transferringEnvelope"
        @transfer="handleTransfer"
        @close="showTransferModal = false"
      />

      <MyEnvelopes
        :envelopes="envelopes"
        :claims="claims"
        :current-address="address || ''"
        @open="openFromList"
        @transfer="startTransfer"
        @reclaim="reclaimEnvelope"
        @open-claim="openClaimFromList"
        @transfer-claim="startTransferClaim"
        @reclaim-pool="handleReclaimPool"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { useRedEnvelopeCreation } from "@/composables/useRedEnvelopeCreation";
import { useRedEnvelopeOpen } from "@/composables/useRedEnvelopeOpen";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";
import { useNeoEligibility } from "@/composables/useNeoEligibility";
import { useEnvelopeActions } from "./composables/useEnvelopeActions";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";

import LuckyOverlay from "./components/LuckyOverlay.vue";
import OpeningModal from "./components/OpeningModal.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "red-envelope",
  messages,
  template: {
    tabs: [
      { key: "create", labelKey: "createTab", icon: "\uD83E\uDDE7", default: true },
      { key: "claim", labelKey: "claimTabLabel", icon: "\uD83C\uDFAF" },
      { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "\uD83C\uDF81" },
    ],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "sidebarEnvelopes", value: () => envelopes.value.length },
    { labelKey: "sidebarClaims", value: () => claims.value.length },
    { labelKey: "sidebarPools", value: () => pools.value.length },
  ],
});

const activeTab = ref<string>("create");

// Use composables
const {
  name,
  description,
  amount,
  count,
  expiryHours,
  minNeoRequired,
  minHoldDays,
  status,
  setStatus,
  clearStatus,
  isLoading,
  defaultBlessing,
  ensureContractAddress: ensureCreationContract,
} = useRedEnvelopeCreation();

const {
  envelopes,
  loadingEnvelopes,
  contractAddress,
  ensureContractAddress: ensureOpenContract,
  loadEnvelopeDetails,
  loadEnvelopes,
  claims,
  pools,
  loadingPools,
  claimFromPool,
  openClaim,
  transferClaim,
  reclaimPool,
} = useRedEnvelopeOpen();

const {
  isEligible,
  neoBalance,
  holdingDays,
  reason: eligibilityReason,
  checking: checkingEligibility,
  checkEligibility,
} = useNeoEligibility();

const envelopeType = ref<EnvelopeType>("spreading");

const {
  luckyMessage,
  openingId,
  showOpeningModal,
  openingEnvelope,
  showTransferModal,
  transferringEnvelope,
  openingClaim,
  handleConnect,
  create,
  openEnvelope,
  openFromList,
  startTransfer,
  handleTransfer,
  reclaimEnvelope,
  handleClaimFromPool,
  openClaimFromList,
  handleOpenClaim,
  startTransferClaim,
  handleReclaimPool,
  address,
} = useEnvelopeActions({
  status,
  setStatus,
  clearStatus,
  isLoading,
  defaultBlessing,
  ensureCreationContract,
  ensureOpenContract,
  loadEnvelopes,
  loadEnvelopeDetails,
  claimFromPool,
  openClaim,
  transferClaim,
  reclaimPool,
  checkEligibility,
  isEligible,
  eligibilityReason,
  name,
  description,
  amount,
  count,
  expiryHours,
  minNeoRequired,
  minHoldDays,
  envelopeType,
});

const appState = computed(() => ({
  envelopeCount: envelopes.value.length,
  hasLucky: !!luckyMessage.value,
}));

onMounted(async () => {
  await loadEnvelopes();

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      const found = envelopes.value.find((e) => e.id === id);
      if (found) {
        openFromList(found);
        activeTab.value = "myEnvelopes";
      } else {
        const contract = await ensureOpenContract();
        const env = await loadEnvelopeDetails(contract, id);
        if (env) {
          openingEnvelope.value = env;
          showOpeningModal.value = true;
          activeTab.value = "myEnvelopes";
        }
      }
    }
  }
});

watch(activeTab, async (tab) => {
  if (tab === "myEnvelopes") {
    await loadEnvelopes();
  } else if (tab === "claim") {
    await loadEnvelopes();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./red-envelope-theme.scss";

:global(page) {
  background: var(--bg-primary);
}
</style>
