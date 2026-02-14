<template>
  <view class="theme-breakup-contract">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
          <ContractList :contracts="contracts" :address="address" :t="t" @sign="signContract" @break="breakContract" />
        
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
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import CreateContractForm from "./components/CreateContractForm.vue";
import ContractList from "./components/ContractList.vue";
import { useBreakupContract } from "./composables/useBreakupContract";

const { t } = createUseI18n(messages)();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "create", labelKey: "tabCreate", icon: "💔", default: true },
  ],
});

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

const { handleBoundaryError } = useHandleBoundaryError("breakup-contract");
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
