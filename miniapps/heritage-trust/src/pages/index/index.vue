<template>
  <MiniAppPage
    name="heritage-trust"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadData"
  >
    <!-- Main Tab — LEFT panel: trust dashboard -->
    <template #content>
      <view class="mine-dashboard">
        <TrustList
          :trusts="myCreatedTrusts"
          :title="t('createdTrusts')"
          :empty-text="t('noTrusts')"
          empty-icon="📜"
          @heartbeat="heartbeatTrust"
          @claimYield="claimYield"
          @execute="executeTrust"
          @claimReleased="claimReleased"
        />

        <BeneficiaryManager
          :beneficiary-trusts="myBeneficiaryTrusts"
          @heartbeat="heartbeatTrust"
          @claimYield="claimYield"
          @execute="executeTrust"
          @claimReleased="claimReleased"
        />
      </view>
    </template>

    <!-- Main Tab — RIGHT panel: create form -->
    <template #operation>
      <TrustCreate :is-loading="isLoading" @create="handleCreate" />
    </template>

    <template #tab-stats>
      <NeoCard variant="erobo">
        <StatsDisplay :items="trustStatsItems" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";

import { useHeritageTrusts } from "@/composables/useHeritageTrusts";
import { useHeritageBeneficiaries } from "@/composables/useHeritageBeneficiaries";
import TrustList from "./components/TrustList.vue";
import BeneficiaryManager from "./components/BeneficiaryManager.vue";

const {
  isLoading,
  isLoadingData,
  myCreatedTrusts,
  myBeneficiaryTrusts,
  stats,
  status,
  setStatus,
  clearStatus,
  loadData,
  heartbeatTrust,
  claimYield,
  claimReleased,
  executeTrust,
  createTrust,
} = useHeritageTrusts();

const { saveTrustName } = useHeritageBeneficiaries();

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "heritage-trust",
  messages,
  template: {
    tabs: [
      { key: "main", labelKey: "createTrust", icon: "➕", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "createdTrusts", value: () => myCreatedTrusts.value.length },
    { labelKey: "sidebarBeneficiary", value: () => myBeneficiaryTrusts.value.length },
    { labelKey: "sidebarActive", value: () => myCreatedTrusts.value.filter((tr) => tr.active !== false).length },
  ],
});

const appState = computed(() => ({
  totalTrusts: myCreatedTrusts.value.length,
  beneficiaryTrusts: myBeneficiaryTrusts.value.length,
}));

const trustStatsItems = computed<StatsDisplayItem[]>(() => [
  { label: t("totalTrusts"), value: stats.value.totalTrusts },
  { label: t("totalNeoValue"), value: `${stats.value.totalNeoValue} NEO` },
  { label: t("activeTrusts"), value: stats.value.activeTrusts },
]);

const newTrust = ref({
  name: "",
  beneficiary: "",
  neoValue: "10",
  gasValue: "0",
  monthlyNeo: "1",
  monthlyGas: "0",
  releaseMode: "neoRewards",
  intervalDays: "30",
  notes: "",
});

const handleCreate = async () => {
  await createTrust(newTrust.value, saveTrustName, () => {
    newTrust.value = {
      name: "",
      beneficiary: "",
      neoValue: "10",
      gasValue: "0",
      monthlyNeo: "1",
      monthlyGas: "0",
      releaseMode: "neoRewards",
      intervalDays: "30",
      notes: "",
    };
  });
};

onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./heritage-trust-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--heritage-bg-start) 0%, var(--heritage-bg-end) 100%);
  min-height: 100vh;
  color: var(--heritage-text);
}

.mine-dashboard {
  display: flex;
  flex-direction: column;
}
</style>
