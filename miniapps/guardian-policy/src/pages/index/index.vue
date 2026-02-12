<template>
  <view class="theme-guardian-policy">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

        <!-- Policy Rules -->
        <PoliciesList :policies="gp.policies" :t="t" @claim="gp.requestClaim" />
      </template>

      <template #operation>
        <!-- Create New Policy -->
        <CreatePolicyForm
          v-model:assetType="gp.assetType"
          v-model:policyType="gp.policyType"
          v-model:coverage="gp.coverage"
          v-model:threshold="gp.threshold"
          v-model:startPrice="gp.startPrice"
          :premium="gp.premiumDisplay"
          :is-fetching-price="isFetchingPrice"
          :t="t"
          @fetchPrice="onFetchPrice"
          @create="gp.createPolicy"
        />
      </template>

      <template #tab-stats>
        <StatsCard :stats="gp.stats" :t="t" />

        <!-- Action History -->
        <ActionHistory :action-history="gp.actionHistory" :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useWallet, useEvents, useDatafeed } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useGuardianPolicyContract } from "@/composables/useGuardianPolicyContract";

import PoliciesList from "./components/PoliciesList.vue";
import CreatePolicyForm from "./components/CreatePolicyForm.vue";
import StatsCard from "./components/StatsCard.vue";
import ActionHistory from "./components/ActionHistory.vue";

const { t } = useI18n();
const wallet = useWallet() as WalletSDK;
const { address } = wallet;
const { list: listEvents } = useEvents();
const { getPrice, isLoading: isFetchingPrice } = useDatafeed();
const APP_ID = "miniapp-guardianpolicy";
const { processPayment } = usePaymentFlow(APP_ID);
const { ensure: ensureContractAddress } = useContractAddress(t);
const { status, setStatus } = useStatusMessage();
const { listAllEvents } = useAllEvents(listEvents, APP_ID);

const gp = useGuardianPolicyContract(
  wallet,
  ensureContractAddress,
  listAllEvents,
  processPayment,
  setStatus,
  t,
);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "main", icon: "📋", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
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

const activeTab = ref("main");

const appState = computed(() => ({
  totalPolicies: gp.stats.value.totalPolicies,
  activePolicies: gp.stats.value.activePolicies,
  claimedPolicies: gp.stats.value.claimedPolicies,
}));

const sidebarItems = computed(() => [
  { label: "Policies", value: gp.stats.value.totalPolicies },
  { label: "Active", value: gp.stats.value.activePolicies },
  { label: "Claimed", value: gp.stats.value.claimedPolicies },
]);

const onFetchPrice = () => gp.fetchPrice(getPrice);

watch(address, () => {
  gp.refreshData();
}, { immediate: true });
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./guardian-policy-theme.scss";

:global(page) {
  background: var(--ops-bg);
}

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--ops-bg);
  background-image: var(--ops-grid);
  background-size: 40px 40px;
  min-height: 100vh;
}

/* Ops Component Overrides */
:deep(.neo-card) {
  background: var(--ops-card-bg) !important;
  border: 1px solid var(--ops-card-border) !important;
  border-top: 2px solid var(--ops-blue) !important;
  border-radius: 4px !important;
  box-shadow: var(--ops-card-shadow) !important;
  color: var(--ops-text) !important;
  backdrop-filter: blur(10px);
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: -2px;
    left: -1px;
    width: 10px;
    height: 10px;
    border-top: 2px solid var(--ops-cyan);
    border-left: 2px solid var(--ops-cyan);
  }
  &::after {
    content: "";
    position: absolute;
    bottom: -2px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-bottom: 2px solid var(--ops-cyan);
    border-right: 2px solid var(--ops-cyan);
  }
}

:deep(.neo-button) {
  font-family: "Share Tech Mono", monospace !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 2px !important;

  &.variant-primary {
    background: var(--ops-button-primary-bg) !important;
    border: 1px solid var(--ops-blue) !important;
    color: var(--ops-blue) !important;
    box-shadow: var(--ops-button-primary-shadow) !important;

    &:active {
      background: var(--ops-button-primary-bg-pressed) !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--ops-button-secondary-border) !important;
    color: var(--ops-button-secondary-text) !important;
  }
}

/* Technical Font Overrides */
:deep(text),
:deep(view) {
  font-family: "Share Tech Mono", monospace; /* Fallback if not available */
}

/* Status Indicator */
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ops-cyan);
  box-shadow: var(--ops-cyan-glow);
  display: inline-block;
  margin-right: 8px;
}


// Desktop sidebar
</style>
