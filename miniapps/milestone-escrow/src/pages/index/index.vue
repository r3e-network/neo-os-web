<template>
  <MiniAppPage
    name="milestone-escrow"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
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
    </template>

    <template #operation>
      <EscrowForm @create="onCreateEscrow" ref="escrowFormRef" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import EscrowForm from "./components/EscrowForm.vue";
import EscrowList from "./components/EscrowList.vue";
import { useEscrowContract } from "@/composables/useEscrowContract";

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

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "milestone-escrow",
  messages,
  template: {
    tabs: [{ key: "create", labelKey: "createTab", icon: "➕", default: true }],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "createTab", value: () => creatorEscrows.value.length },
    { labelKey: "escrowsTab", value: () => beneficiaryEscrows.value.length },
    { labelKey: "statusActive", value: () => creatorEscrows.value.filter((e) => e.status === "active").length },
    { labelKey: "statusCompleted", value: () => creatorEscrows.value.filter((e) => e.status === "completed").length },
  ],
});

const escrowFormRef = ref<InstanceType<typeof EscrowForm> | null>(null);

const activeTab = ref("create");

const appState = computed(() => ({
  creatorEscrows: creatorEscrows.value.length,
  beneficiaryEscrows: beneficiaryEscrows.value.length,
}));

const onCreateEscrow = async (data: {
  name: string;
  beneficiary: string;
  asset: string;
  notes: string;
  milestones: Array<{ amount: string }>;
}) => {
  await handleCreateEscrow(data, escrowFormRef.value);
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
@use "@shared/styles/page-common" as *;
@import "./milestone-escrow-theme.scss";

@include page-background(
  linear-gradient(135deg, var(--escrow-bg-start) 0%, var(--escrow-bg-end) 100%),
  (
    color: var(--escrow-text),
  )
);

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
