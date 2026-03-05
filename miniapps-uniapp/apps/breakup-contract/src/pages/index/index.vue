<template>
  <MiniAppPage
    name="breakup-contract"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadContracts"
  >
    <template #content>
      <ContractList :contracts="contracts" :address="address" @sign="signContract" @break="breakContract" />
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
        @create="createContract"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import ContractList from "./components/ContractList.vue";
import { useBreakupContract } from "./composables/useBreakupContract";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "breakup-contract",
  messages,
  template: {
    tabs: [{ key: "create", labelKey: "tabCreate", icon: "💔", default: true }],
  },
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
