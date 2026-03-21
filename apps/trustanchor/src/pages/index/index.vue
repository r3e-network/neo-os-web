<template>
  <MiniAppPage
    name="trustanchor"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <div class="hero-container">
        <span class="hero-label">{{ t("appName") }}</span>
        <span class="hero-description">{{ t("heroDescription") }}</span>

        <div class="hero-gauge" aria-hidden="true">
          <svg viewBox="0 0 200 120" class="gauge-svg">
            <path
              d="M20 100 A80 80 0 0 1 180 100"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              stroke-width="12"
              stroke-linecap="round"
            />
            <path
              d="M20 100 A80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#gaugeGrad)"
              stroke-width="12"
              stroke-linecap="round"
              :stroke-dasharray="gaugeCircumference"
              :stroke-dashoffset="gaugeOffset"
              class="gauge-fill"
            />
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-center">
            <span class="gauge-value">{{ formatNum(stats?.totalStaked ?? 0) }}</span>
            <span class="gauge-unit">{{ t("tokenNeo") }}</span>
          </div>
        </div>

        <HeroStatsStrip :items="heroStatsItems" compact />
      </div>

      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />

      <NeoCard variant="erobo" class="mb-4 px-1">
        <div class="section-header mb-4">
          <span class="section-title">{{ t("routingSummaryTitle") }}</span>
        </div>
        <span class="section-desc">{{ t("routingSummaryDesc") }}</span>
      </NeoCard>

      <NeoCard variant="erobo" class="px-1">
        <div class="section-header mb-4">
          <span class="section-title">{{ t("rebalanceTitle") }}</span>
        </div>
        <span class="section-desc">{{ t("rebalanceDesc") }}</span>
      </NeoCard>
    </template>

    <template #operation>
      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
        compact
        :t="t"
      />
      <NeoCard v-else variant="erobo" :title="t('stake')" class="mb-4 px-1">
        <div v-if="address" class="stake-form">
          <div class="input-group mb-4">
            <div class="input-row">
              <NeoInput type="number" v-model="stakeAmount" :label="t('stake')" :placeholder="t('amount')" required />
              <NeoButton variant="primary" :loading="isStaking" @click="handleStake">
                {{ t("stake") }}
              </NeoButton>
            </div>
          </div>

          <div class="input-group mb-4">
            <div class="input-row">
              <NeoInput type="number" v-model="unstakeAmount" :label="t('unstake')" :placeholder="t('amount')" required />
              <NeoButton variant="secondary" :loading="isUnstaking" @click="handleUnstake">
                {{ t("unstake") }}
              </NeoButton>
            </div>
          </div>

          <div class="claim-panel">
            <div class="claim-panel__copy">
              <span class="claim-panel__label">{{ t("pendingRewards") }}</span>
              <span class="claim-panel__value">{{ formatNum(pendingRewards) }} {{ t("tokenGas") }}</span>
            </div>
            <NeoButton variant="primary" :loading="isClaiming" :disabled="pendingRewards <= 0" @click="handleClaim">
              {{ t("claim") }}
            </NeoButton>
          </div>

          <div class="claim-panel claim-panel--withdraw">
            <div class="claim-panel__copy">
              <span class="claim-panel__label">{{ t("pendingWithdrawLabel") }}</span>
              <span class="claim-panel__value">{{ formatNum(pendingWithdraw) }} {{ t("tokenNeo") }}</span>
              <span class="claim-panel__hint">{{ t("withdrawQueueDesc") }}</span>
            </div>
            <NeoButton variant="secondary" :disabled="pendingWithdraw <= 0" @click="handleClaimPendingWithdraw">
              {{ t("claimPendingWithdraw") }}
            </NeoButton>
          </div>
        </div>

        <div v-else class="connect-prompt">
          <NeoButton variant="primary" @click="connect">
            {{ t("connectWallet") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>

    <template #tab-routing>
      <AgentAccountsTab :agents="agentAccounts" />
    </template>

    <template #tab-architecture>
      <ArchitectureTab :stats="stats" :slot-count="agentAccounts.length" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { formatNumber } from "@shared/utils/format";
import {
  MiniAppPage,
  StatsDisplay,
  NeoButton,
  NeoCard,
  NeoInput,
  ContractAvailabilityCard,
  HeroStatsStrip,
} from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useTrustAnchor } from "./composables/useTrustAnchor";
import ArchitectureTab from "./components/ArchitectureTab.vue";
import AgentAccountsTab from "./components/AgentAccountsTab.vue";
import { TRUSTANCHOR_AGENT_ACCOUNTS } from "./data/agentAccounts";

const formatNum = (n: number | string) => formatNumber(n, 2);

const {
  stats,
  myStake,
  pendingRewards,
  pendingWithdraw,
  loadAll,
  stake,
  unstake,
  claimRewards,
  claimPendingWithdraw,
} = useTrustAnchor((key: string) => t(key));

const agentAccounts = TRUSTANCHOR_AGENT_ACCOUNTS;

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "trustanchor",
  messages,
  template: {
    tabs: [
      { key: "overview", labelKey: "tabOverview", icon: "layout", default: true },
      { key: "routing", labelKey: "tabRouting", icon: "grid" },
      { key: "architecture", labelKey: "tabArchitecture", icon: "layers" },
    ],
    docSubtitleKey: "docsSubtitle",
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "myStake", value: () => `${formatNum(myStake.value)} ${t("tokenNeo")}` },
    { labelKey: "pendingRewards", value: () => `${formatNum(pendingRewards.value)} ${t("tokenGas")}` },
    { labelKey: "agentAccountsLabel", value: () => agentAccounts.length },
    { labelKey: "defaultIngressLabel", value: () => 21 },
  ],
});

const { address, connect } = useWallet() as WalletSDK;
const { ensureSafe: ensureContractSafe } = useContractAddress(t);

const isClaiming = ref(false);
const isStaking = ref(false);
const isUnstaking = ref(false);
const stakeAmount = ref("");
const unstakeAmount = ref("");
const contractReady = ref(false);

const appState = computed(() => ({
  myStake: myStake.value,
  pendingRewards: pendingRewards.value,
  pendingWithdraw: pendingWithdraw.value,
  agentAccounts: agentAccounts.length,
  defaultIngressAgent: 21,
}));

const GAUGE_ARC = Math.PI * 80;
const gaugeCircumference = GAUGE_ARC;
const MAX_STAKED = 10_000_000;
const gaugePercent = computed(() => {
  const total = stats.value?.totalStaked ?? 0;
  return Math.min(total / MAX_STAKED, 1);
});
const gaugeOffset = computed(() => GAUGE_ARC - gaugePercent.value * GAUGE_ARC);

const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { label: t("agentAccountsLabel"), value: agentAccounts.length, icon: "🧱" },
  { label: t("defaultIngressLabel"), value: 21, icon: "↘" },
  { label: t("noAgentContractsLabel"), value: 0, icon: "∅" },
]);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("zeroFee"), value: t("zeroFeeDesc"), variant: "success" },
  { label: t("verificationAccountsTitle"), value: t("verificationAccountsDesc"), variant: "erobo" },
  { label: t("verificationScriptTitle"), value: t("verificationScriptDesc"), variant: "accent" },
  { label: t("rebalanceTitle"), value: t("rebalanceMetricDesc"), variant: "erobo" },
]);

const ensureContractReady = async () => {
  contractReady.value = await ensureContractSafe({ silentChainCheck: true });
  return contractReady.value;
};

const handleStake = async () => {
  const amount = parseInt(stakeAmount.value, 10);
  if (!amount || amount <= 0) return;
  isStaking.value = true;
  try {
    await stake(amount);
    stakeAmount.value = "";
  } finally {
    isStaking.value = false;
  }
};

const handleUnstake = async () => {
  const amount = parseInt(unstakeAmount.value, 10);
  if (!amount || amount <= 0) return;
  isUnstaking.value = true;
  try {
    await unstake(amount);
    unstakeAmount.value = "";
  } finally {
    isUnstaking.value = false;
  }
};

const handleClaim = async () => {
  if (pendingRewards.value <= 0) return;
  isClaiming.value = true;
  try {
    await claimRewards();
  } finally {
    isClaiming.value = false;
  }
};

const handleClaimPendingWithdraw = async () => {
  if (pendingWithdraw.value <= 0) return;
  try {
    await claimPendingWithdraw();
  } catch (_e: unknown) {
    /* non-critical: claim pending withdraw */
  }
};

const resetAndReload = async () => {
  try {
    if (!(await ensureContractReady())) return;
    await loadAll();
  } catch (_e: unknown) {
    /* non-critical: reload trustanchor data */
  }
};

onMounted(async () => {
  try {
    await resetAndReload();
  } catch (_e: unknown) {
    /* non-critical: initial data load */
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./trustanchor-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.hero-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}

.hero-label {
  font-size: 28px;
  font-weight: 900;
}

.hero-description {
  max-width: 700px;
  font-size: 14px;
  line-height: 1.7;
  opacity: 0.82;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: 800;
}

.section-desc {
  font-size: 14px;
  opacity: 0.82;
  line-height: 1.7;
  display: block;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 12px;
}

.claim-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.claim-panel__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.claim-panel__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.6;
}

.claim-panel__value {
  font-size: 18px;
  font-weight: 800;
}

.claim-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.claim-amount {
  font-size: 24px;
  font-weight: bold;
}

.connect-prompt {
  display: flex;
  justify-content: center;
  padding: 20px;
}

@media (max-width: 767px) {
  .input-row {
    flex-direction: column;
    gap: 8px;
  }
  .claim-section {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
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
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, transparent 100%);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-gauge {
  position: relative;
  width: 200px;
  height: 120px;
}

.gauge-svg {
  width: 100%;
  height: 100%;
}

.gauge-fill {
  transition: stroke-dashoffset 0.8s ease;
}

.gauge-center {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-value {
  font-size: 22px;
  font-weight: 700;
}

.gauge-unit {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
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

  &--accent {
    color: #34d399;
  }
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.1));
}

/* ── Trust Anchor Hero Enhancements ── */
@keyframes anchor-drop-sway {
  0% {
    transform: translateY(-8px) rotate(-3deg);
    opacity: 0.8;
  }
  30% {
    transform: translateY(2px) rotate(1deg);
    opacity: 1;
  }
  50% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  70% {
    transform: translateY(0) rotate(-1deg);
  }
  100% {
    transform: translateY(-8px) rotate(-3deg);
    opacity: 0.8;
  }
}

@keyframes anchor-chain-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes anchor-deep-blue-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes anchor-gauge-glow {
  0%,
  100% {
    filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.2));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.5));
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(30, 58, 138, 0.12), rgba(17, 24, 39, 0.08), rgba(16, 185, 129, 0.06));
  background-size: 200% 200%;
  animation: anchor-deep-blue-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(30, 58, 138, 0.1),
    inset 0 1px 0 rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(30, 58, 138, 0.12);
}

.hero-gauge {
  animation: anchor-drop-sway 6s ease-in-out infinite;
}

.gauge-svg {
  animation: anchor-gauge-glow 4s ease-in-out infinite;
}

.gauge-value {
  background: linear-gradient(
    90deg,
    var(--text-primary, #fff) 40%,
    rgba(52, 211, 153, 0.9) 50%,
    var(--text-primary, #fff) 60%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: anchor-chain-shimmer 5s linear infinite;
}

.hero-stats-row {
  box-shadow: 0 0 20px rgba(30, 58, 138, 0.1);
  background: linear-gradient(135deg, rgba(30, 58, 138, 0.06), rgba(255, 255, 255, 0.02));
}
</style>
