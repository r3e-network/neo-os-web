<template>
  <view class="theme-red-envelope">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="!!luckyMessage"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Create Tab (default) - LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <LuckyOverlay :lucky-message="luckyMessage" :t="t" @close="luckyMessage = null" />
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
        </ErrorBoundary>
      </template>
      <template #operation>
        <CreateForm
          :is-loading="isLoading"
          :t="t"
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
        <ClaimPool :pools="pools" :t="t" @claim="handleClaimFromPool" />
      </template>

      <!-- My Envelopes Tab -->
      <template #tab-myEnvelopes>
        <LuckyOverlay :lucky-message="luckyMessage" :t="t" @close="luckyMessage = null" />
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
          :t="t"
          @open="openFromList"
          @transfer="startTransfer"
          @reclaim="reclaimEnvelope"
          @open-claim="openClaimFromList"
          @transfer-claim="startTransferClaim"
          @reclaim-pool="handleReclaimPool"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useRedEnvelopeCreation } from "@/composables/useRedEnvelopeCreation";
import { useRedEnvelopeOpen } from "@/composables/useRedEnvelopeOpen";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";
import { useNeoEligibility } from "@/composables/useNeoEligibility";
import { useEnvelopeActions } from "./composables/useEnvelopeActions";
import { MiniAppTemplate, ErrorBoundary, SidebarPanel } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";

import LuckyOverlay from "./components/LuckyOverlay.vue";
import OpeningModal from "./components/OpeningModal.vue";
import CreateForm from "./components/CreateForm.vue";
import MyEnvelopes from "./components/MyEnvelopes.vue";
import TransferModal from "./components/TransferModal.vue";
import ClaimPool from "./components/ClaimPool.vue";

const { t } = createUseI18n(messages)();

const activeTab = ref<string>("create");

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "create", labelKey: "createTab", icon: "🧧", default: true },
    { key: "claim", labelKey: "claimTabLabel", icon: "🎯" },
    { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "🎁" },
  ],
  fireworks: true,
});

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
  fetchEnvelopeDetails,
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
  fetchEnvelopeDetails,
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

const sidebarItems = createSidebarItems(t, [
  { labelKey: "sidebarEnvelopes", value: () => envelopes.value.length },
  { labelKey: "sidebarClaims", value: () => claims.value.length },
  { labelKey: "sidebarPools", value: () => pools.value.length },
]);

const { handleBoundaryError } = useHandleBoundaryError("red-envelope");
const resetAndReload = async () => {
  await loadEnvelopes();
};

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
        const env = await fetchEnvelopeDetails(contract, id);
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
