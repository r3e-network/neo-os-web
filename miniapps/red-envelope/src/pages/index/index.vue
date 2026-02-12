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

      <!-- Create Tab (default) -->
      <template #content>
        <view class="app-container">
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

          <AppStatus :status="status" />
        </view>
      </template>

      <template #operation>
        <view class="app-container">
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
        </view>
      </template>

      <!-- Claim Tab -->
      <template #tab-claim>
        <view class="app-container">
          <AppStatus :status="status" />
          <ClaimPool :pools="pools" :t="t" @claim="handleClaimFromPool" />
        </view>
      </template>

      <!-- My Envelopes Tab -->
      <template #tab-myEnvelopes>
        <view class="app-container">
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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { useRedEnvelopeCreation } from "@/composables/useRedEnvelopeCreation";
import { useRedEnvelopeOpen } from "@/composables/useRedEnvelopeOpen";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";
import { useNeoEligibility } from "@/composables/useNeoEligibility";
import { useEnvelopeActions } from "./composables/useEnvelopeActions";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";

import LuckyOverlay from "./components/LuckyOverlay.vue";
import OpeningModal from "./components/OpeningModal.vue";
import AppStatus from "./components/AppStatus.vue";
import CreateForm from "./components/CreateForm.vue";
import MyEnvelopes from "./components/MyEnvelopes.vue";
import TransferModal from "./components/TransferModal.vue";
import ClaimPool from "./components/ClaimPool.vue";

const { t } = useI18n();

const activeTab = ref<string>("create");

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "create", labelKey: "createTab", icon: "🧧", default: true },
    { key: "claim", labelKey: "claimTabLabel", icon: "🎯" },
    { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "🎁" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

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

const sidebarItems = computed(() => [
  { label: "Envelopes", value: envelopes.value.length },
  { label: "Claims", value: claims.value.length },
  { label: "Pools", value: pools.value.length },
]);

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

.app-container {
  padding: 80px 20px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: radial-gradient(circle at 50% 30%, var(--red-envelope-accent) 0%, var(--red-envelope-base) 100%);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: -20%;
    left: 50%;
    transform: translateX(-50%);
    width: 150%;
    height: 50%;
    background: radial-gradient(circle, var(--red-envelope-glow) 0%, transparent 70%);
    opacity: 0.6;
    z-index: 0;
    filter: blur(40px);
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      radial-gradient(var(--red-envelope-gold) 1px, transparent 1px),
      radial-gradient(var(--red-envelope-gold) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position:
      0 0,
      20px 20px;
    opacity: var(--red-envelope-pattern-opacity);
    pointer-events: none;
    z-index: 0;
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
}
</style>
