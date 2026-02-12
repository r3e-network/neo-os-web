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
        <view class="app-container">
          <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
            <text class="status-msg font-bold">{{ status.msg }}</text>
          </NeoCard>
        </view>
      </template>

      <template #operation>
        <view class="app-container">
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
        </view>
      </template>

      <template #tab-contracts>
        <view class="app-container">
          <ContractList :contracts="contracts" :address="address" :t="t" @sign="signContract" @break="breakContract" />
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
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

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: radial-gradient(circle at 20% 20%, var(--heartbreak-radial) 0%, var(--heartbreak-bg) 100%);
  min-height: 100vh;
  position: relative;

  /* Broken glass shards overlay (simulated with gradients) */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.1;
    background-image:
      linear-gradient(45deg, transparent 48%, var(--heartbreak-shard) 49%, transparent 51%),
      linear-gradient(-45deg, transparent 40%, var(--heartbreak-shard) 41%, transparent 42%);
    background-size: 200px 200px;
    pointer-events: none;
  }
}

.status-msg {
  color: var(--heartbreak-status-text);
  text-transform: uppercase;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-shadow: var(--heartbreak-status-shadow);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 10;
}


/* Neon Heartbreak Component Overrides */
:deep(.neo-card) {
  background: var(--heartbreak-card-bg) !important;
  border: 1px solid var(--heartbreak-card-border) !important;
  border-left: 4px solid var(--heartbreak-accent) !important;
  box-shadow: var(--heartbreak-card-shadow) !important;
  border-radius: 2px !important; /* Sharp edges */
  color: var(--heartbreak-text) !important;
  backdrop-filter: blur(10px);

  &.variant-danger {
    background: var(--heartbreak-card-danger-bg) !important;
    border-color: var(--heartbreak-card-danger-border) !important;
  }
}

:deep(.neo-button) {
  border-radius: 0 !important;
  text-transform: uppercase;
  font-weight: 800 !important;
  letter-spacing: 0.1em;
  border: 1px solid var(--heartbreak-accent) !important;

  &.variant-primary {
    background: linear-gradient(135deg, var(--heartbreak-accent) 0%, var(--heartbreak-accent-dark) 100%) !important;
    color: var(--heartbreak-status-text) !important;
    box-shadow: var(--heartbreak-button-shadow) !important;

    &:active {
      transform: translate(2px, 2px);
      box-shadow: var(--heartbreak-button-shadow-press) !important;
    }
  }
}

:deep(.neo-input) {
  background: var(--heartbreak-input-bg) !important;
  border-bottom: 2px solid var(--heartbreak-accent) !important;
  border-radius: 0 !important;
  color: var(--heartbreak-status-text) !important;
}

// Desktop sidebar
</style>
