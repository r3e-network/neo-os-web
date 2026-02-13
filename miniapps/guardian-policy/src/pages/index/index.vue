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
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <!-- Policy Rules -->
          <PoliciesList :policies="gp.policies" :t="t" @claim="gp.requestClaim" />
        </ErrorBoundary>
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
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import { useGuardianPolicyContract } from "@/composables/useGuardianPolicyContract";

import PoliciesList from "./components/PoliciesList.vue";
import CreatePolicyForm from "./components/CreatePolicyForm.vue";
import StatsCard from "./components/StatsCard.vue";
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

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "main", labelKey: "main", icon: "📋", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
  ],
});

const activeTab = ref("main");

const appState = computed(() => ({
  totalPolicies: gp.stats.value.totalPolicies,
  activePolicies: gp.stats.value.activePolicies,
  claimedPolicies: gp.stats.value.claimedPolicies,
}));

const sidebarItems = computed(() => [
  { label: t("sidebarPolicies"), value: gp.stats.value.totalPolicies },
  { label: t("sidebarActive"), value: gp.stats.value.activePolicies },
  { label: t("sidebarClaimed"), value: gp.stats.value.claimedPolicies },
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
