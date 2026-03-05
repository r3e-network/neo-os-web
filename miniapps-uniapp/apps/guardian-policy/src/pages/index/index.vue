<template>
  <MiniAppPage
    name="guardian-policy"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="() => gp.refreshData()"
  >
    <template #content>
      <!-- Policy Rules -->
      <PoliciesList :policies="gp.policies" @claim="gp.requestClaim" />
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
        @fetchPrice="onFetchPrice"
        @create="gp.createPolicy"
      />
    </template>

    <template #tab-stats>
      <StatsTab :grid-items="guardianStats" />

      <!-- Action History -->
      <ActionHistory :action-history="gp.actionHistory" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useWallet, useEvents, useDatafeed } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useGuardianPolicyContract } from "@/composables/useGuardianPolicyContract";

import PoliciesList from "./components/PoliciesList.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "guardian-policy",
    messages,
    template: {
      tabs: [
        { key: "main", labelKey: "main", icon: "📋", default: true },
        { key: "stats", labelKey: "stats", icon: "📊" },
      ],
    },
    sidebarItems: [
      { labelKey: "sidebarPolicies", value: () => gp.stats.value.totalPolicies },
      { labelKey: "sidebarActive", value: () => gp.stats.value.activePolicies },
      { labelKey: "sidebarClaimed", value: () => gp.stats.value.claimedPolicies },
    ],
  });
const wallet = useWallet() as WalletSDK;
const { address } = wallet;
const { list: listEvents } = useEvents();
const { getPrice, isLoading: isFetchingPrice } = useDatafeed();
const APP_ID = "miniapp-guardianpolicy";
const { processPayment } = usePaymentFlow(APP_ID);
const { ensure: ensureContractAddress } = useContractAddress(t);
const { listAllEvents } = useAllEvents(listEvents, APP_ID);

const gp = useGuardianPolicyContract(wallet, ensureContractAddress, listAllEvents, processPayment, setStatus, t);

const appState = computed(() => ({
  totalPolicies: gp.stats.value.totalPolicies,
  activePolicies: gp.stats.value.activePolicies,
  claimedPolicies: gp.stats.value.claimedPolicies,
}));
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
