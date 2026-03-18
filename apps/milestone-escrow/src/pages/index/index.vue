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
      <div class="hero-container">
        <span class="hero-label">{{ t("appName") }}</span>
        <div class="hero-progress-track">
          <div class="hero-progress-fill" :style="{ width: progressPercent + '%' }" />
          <div
            v-for="(cp, i) in milestoneCheckpoints"
            :key="i"
            class="hero-checkpoint"
            :class="{ 'hero-checkpoint--done': cp.done }"
            :style="{ left: cp.position + '%' }"
          >
            <div class="checkpoint-dot" />
            <span class="checkpoint-label">{{ cp.label }}</span>
          </div>
        </div>
        <div class="hero-stats-row">
          <div class="hero-stat">
            <span class="hero-stat-label">{{ t("statusActive") }}</span>
            <span class="hero-stat-value">{{ activeCount }}</span>
          </div>
          <div class="hero-stat-divider" />
          <div class="hero-stat">
            <span class="hero-stat-label">{{ t("statusCompleted") }}</span>
            <span class="hero-stat-value">{{ completedCount }}</span>
          </div>
        </div>
      </div>

      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
      />
      <template v-else>
        <div class="escrows-header">
          <span class="section-title">{{ t("escrowsTab") }}</span>
          <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="refreshEscrows">
            {{ t("refresh") }}
          </NeoButton>
        </div>

        <div v-if="!address" class="empty-state">
          <NeoCard variant="erobo" class="p-6 text-center">
            <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
            <NeoButton size="sm" variant="primary" @click="connectWallet">
              {{ t("connectWallet") }}
            </NeoButton>
          </NeoCard>
        </div>

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
    </template>

    <template #operation>
      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
        compact
      />
      <EscrowForm v-else @create="onCreateEscrow" ref="escrowFormRef" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton, ContractAvailabilityCard } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { createMiniApp } from "@shared/utils/createMiniApp";
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
const activeTab = ref("create");
const contractReady = ref(false);
const { ensureSafe: ensureContractSafe } = useContractAddress(t);

const activeCount = computed(() => creatorEscrows.value.filter((e) => e.status === "active").length);
const completedCount = computed(() => creatorEscrows.value.filter((e) => e.status === "completed").length);
const totalEscrows = computed(() => creatorEscrows.value.length);

const progressPercent = computed(() => {
  if (totalEscrows.value === 0) return 0;
  return Math.round((completedCount.value / totalEscrows.value) * 100);
});

const milestoneCheckpoints = computed(() => {
  const total = totalEscrows.value || 4;
  const steps = Math.min(total, 5);
  return Array.from({ length: steps }, (_, i) => ({
    position: ((i + 1) / steps) * 100,
    done: i < completedCount.value,
    label: `M${i + 1}`,
  }));
});

const appState = computed(() => ({
  creatorEscrows: creatorEscrows.value.length,
  beneficiaryEscrows: beneficiaryEscrows.value.length,
}));
const ensureContractReady = async () => {
  contractReady.value = await ensureContractSafe({ silentChainCheck: true });
  return contractReady.value;
};

const resetAndReload = async () => {
  if (!(await ensureContractReady())) return;
  if (address.value) {
    await refreshEscrows();
  }
};

onMounted(async () => {
  if (!(await ensureContractReady())) return;
  if (address.value) {
    await refreshEscrows();
  }
});

watch(activeTab, (next) => {
  if (next === "escrows" && address.value && contractReady.value) {
    refreshEscrows();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./milestone-escrow-theme.scss" as *;

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

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(180deg, var(--escrow-bg-start, rgba(99, 102, 241, 0.06)) 0%, transparent 100%);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-progress-track {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 6px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 3px;
  margin: 24px 0 32px;
}

.hero-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #818cf8, #6366f1);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.hero-checkpoint {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.checkpoint-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border-subtle, rgba(255, 255, 255, 0.15));
  border: 2px solid var(--border-subtle, rgba(255, 255, 255, 0.2));
  transition: all 0.3s ease;
}

.hero-checkpoint--done .checkpoint-dot {
  background: #6366f1;
  border-color: #818cf8;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.checkpoint-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin-top: 10px;
}

.hero-checkpoint--done .checkpoint-label {
  opacity: 0.9;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg-card-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 24px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.1));
}

/* ── Milestone Escrow Hero Enhancements: Progress Tracking ── */
@keyframes checkpoint-pulse {
  0%,
  100% {
    box-shadow: 0 0 6px rgba(99, 102, 241, 0.3);
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    box-shadow:
      0 0 18px rgba(99, 102, 241, 0.6),
      0 0 36px rgba(99, 102, 241, 0.15);
    transform: translate(-50%, -50%) scale(1.15);
  }
}
@keyframes progress-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, 0.1) 0%, transparent 55%);
}
.hero-progress-fill {
  background: linear-gradient(90deg, #818cf8, #6366f1, #818cf8, #6366f1);
  background-size: 200% 100%;
  animation: progress-shimmer 3s linear infinite;
}
.hero-checkpoint--done .checkpoint-dot {
  animation: checkpoint-pulse 2.5s ease-in-out infinite;
}
.hero-stats-row {
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.12);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(99, 102, 241, 0.25);
    transform: translateY(-2px);
  }
}
.hero-stat-value {
  box-shadow: none;
  background: linear-gradient(180deg, rgba(129, 140, 248, 0.08), transparent);
}
.hero-label {
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.1);
}
</style>
