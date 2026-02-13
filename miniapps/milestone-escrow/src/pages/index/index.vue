<template>
  <view class="theme-milestone-escrow">
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
          <view class="escrows-header">
            <text class="section-title">{{ t("escrowsTab") }}</text>
            <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="refreshEscrows">
              {{ t("refresh") }}
            </NeoButton>
          </view>

          <view v-if="!address" class="empty-state">
            <NeoCard variant="erobo" class="p-6 text-center">
              <text class="mb-3 block text-sm">{{ t("walletNotConnected") }}</text>
              <NeoButton size="sm" variant="primary" @click="connectWallet">
                {{ t("connectWallet") }}
              </NeoButton>
            </NeoCard>
          </view>

          <EscrowList
            v-else
            :creator-escrows="creatorEscrows"
            :beneficiary-escrows="beneficiaryEscrows"
            :approving-id="approvingId"
            :cancelling-id="cancellingId"
            :claiming-id="claimingId"
            :status-label-func="statusLabel"
            :format-amount-func="formatAmount"
            :format-address-func="formatAddress"
            @approve="approveMilestone"
            @cancel="cancelEscrow"
            @claim="claimMilestone"
          />
        </ErrorBoundary>
      </template>

      <template #operation>
        <EscrowForm @create="onCreateEscrow" ref="escrowFormRef" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoCard, NeoButton, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import EscrowForm from "./components/EscrowForm.vue";
import EscrowList from "./components/EscrowList.vue";
import { useEscrowContract } from "@/composables/useEscrowContract";

const { t } = createUseI18n(messages)();

const {
  address,
  status,
  isRefreshing,
  approvingId,
  claimingId,
  cancellingId,
  creatorEscrows,
  beneficiaryEscrows,
  formatAmount,
  formatAddress,
  statusLabel,
  refreshEscrows,
  connectWallet,
  handleCreateEscrow,
  approveMilestone,
  claimMilestone,
  cancelEscrow,
} = useEscrowContract();

const escrowFormRef = ref<InstanceType<typeof EscrowForm> | null>(null);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "create", labelKey: "createTab", icon: "➕", default: true },
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
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const activeTab = ref("create");

const appState = computed(() => ({
  creatorEscrows: creatorEscrows.value.length,
  beneficiaryEscrows: beneficiaryEscrows.value.length,
}));

const sidebarItems = computed(() => [
  { label: t("createTab"), value: creatorEscrows.value.length },
  { label: t("escrowsTab"), value: beneficiaryEscrows.value.length },
  { label: t("statusActive"), value: creatorEscrows.value.filter((e) => e.status === "active").length },
  { label: t("statusCompleted"), value: creatorEscrows.value.filter((e) => e.status === "completed").length },
]);

const onCreateEscrow = async (data: {
  name: string;
  beneficiary: string;
  asset: string;
  notes: string;
  milestones: Array<{ amount: string }>;
}) => {
  await handleCreateEscrow(data, escrowFormRef.value);
};

const handleBoundaryError = (error: Error) => {
  console.error("[milestone-escrow] boundary error:", error);
};
const resetAndReload = async () => {
  if (address.value) {
    await refreshEscrows();
  }
};

onMounted(() => {
  if (address.value) {
    refreshEscrows();
  }
});

watch(activeTab, (next) => {
  if (next === "escrows" && address.value) {
    refreshEscrows();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./milestone-escrow-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--escrow-bg-start) 0%, var(--escrow-bg-end) 100%);
  color: var(--escrow-text);
}

.escrows-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.empty-state {
  margin-top: 10px;
}
</style>
