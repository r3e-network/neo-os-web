<template>
  <view class="theme-breakup-contract">
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
        </ErrorBoundary>
      </template>

      <template #operation>
        <!-- Create Contract Tab -->
        <CreateContractForm
          v-model:partnerAddress="partnerAddress"
          v-model:stakeAmount="stakeAmount"
          v-model:duration="duration"
          v-model:title="contractTitle"
          v-model:terms="contractTerms"
          :address="address"
          :is-loading="isLoading"
          :t="t"
          @create="createContract"
        />
      </template>

      <template #tab-contracts>
        <ContractList :contracts="contracts" :address="address" :t="t" @sign="signContract" @break="breakContract" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import CreateContractForm from "./components/CreateContractForm.vue";
import ContractList from "./components/ContractList.vue";
import { useBreakupContract } from "./composables/useBreakupContract";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "create", labelKey: "tabCreate", icon: "💔", default: true },
    { key: "contracts", labelKey: "tabContracts", icon: "📋" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
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

const activeTab = ref<string>("create");

const {
  address,
  partnerAddress,
  stakeAmount,
  duration,
  contractTitle,
  contractTerms,
  appState,
  sidebarItems,
  contracts,
  status,
  isLoading,
  loadContracts,
  createContract,
  signContract,
  breakContract,
} = useBreakupContract(t);

const handleBoundaryError = (error: Error) => {
  console.error("[breakup-contract] boundary error:", error);
};

const resetAndReload = async () => {
  await loadContracts();
};

onMounted(() => {
  loadContracts();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./breakup-contract-theme.scss";

:global(page) {
  background: var(--heartbreak-bg);
}

.status-msg {
  color: var(--heartbreak-status-text);
  text-transform: uppercase;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-shadow: var(--heartbreak-status-shadow);
}
</style>
