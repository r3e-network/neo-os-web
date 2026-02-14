<template>
  <view class="theme-guardian-policy">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
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
        <MiniAppTabStats variant="erobo-neo" class="mb-6" :stats="guardianStats" />

        <!-- Action History -->
        <ActionHistory :action-history="gp.actionHistory" :t="t" />
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useWallet, useEvents, useDatafeed } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell, MiniAppTabStats, type StatItem } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createPrimaryStatsTemplateConfig, createSidebarItems } from "@shared/utils";
import { useGuardianPolicyContract } from "@/composables/useGuardianPolicyContract";

import PoliciesList from "./components/PoliciesList.vue";
import CreatePolicyForm from "./components/CreatePolicyForm.vue";
import ActionHistory from "./components/ActionHistory.vue";

const { t } = createUseI18n(messages)();
const wallet = useWallet() as WalletSDK;
const { address } = wallet;
const { list: listEvents } = useEvents();
const { getPrice, isLoading: isFetchingPrice } = useDatafeed();
const APP_ID = "miniapp-guardianpolicy";
const { processPayment } = usePaymentFlow(APP_ID);
const { ensure: ensureContractAddress } = useContractAddress(t);
const { status, setStatus } = useStatusMessage();
const { listAllEvents } = useAllEvents(listEvents, APP_ID);

const gp = useGuardianPolicyContract(wallet, ensureContractAddress, listAllEvents, processPayment, setStatus, t);

const templateConfig = createPrimaryStatsTemplateConfig({ key: "main", labelKey: "main", icon: "📋", default: true });

const appState = computed(() => ({
  totalPolicies: gp.stats.value.totalPolicies,
  activePolicies: gp.stats.value.activePolicies,
  claimedPolicies: gp.stats.value.claimedPolicies,
}));

const guardianStats = computed<StatItem[]>(() => {
  const stats = gp.stats.value ?? { totalPolicies: 0, activePolicies: 0, claimedPolicies: 0, totalCoverage: 0 };
  return [
    { label: t("totalPolicies"), value: stats.totalPolicies },
    { label: t("activePoliciesCount"), value: stats.activePolicies },
    { label: t("claimedPolicies"), value: stats.claimedPolicies },
    { label: t("totalCoverage"), value: `${stats.totalCoverage} GAS`, variant: "accent" },
  ];
});

const sidebarItems = createSidebarItems(t, [
  { labelKey: "sidebarPolicies", value: () => gp.stats.value.totalPolicies },
  { labelKey: "sidebarActive", value: () => gp.stats.value.activePolicies },
  { labelKey: "sidebarClaimed", value: () => gp.stats.value.claimedPolicies },
]);

const { handleBoundaryError } = useHandleBoundaryError("guardian-policy");
const resetAndReload = () => {
  gp.refreshData();
};

const onFetchPrice = () => gp.fetchPrice(getPrice);

watch(
  address,
  () => {
    gp.refreshData();
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./guardian-policy-theme.scss";

@include page-background(var(--ops-bg));
</style>
