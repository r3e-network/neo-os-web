<template>
  <MiniAppPage
    name="council-governance"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="init"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo" compact>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ activeProposals.length }}</span>
                <span class="hero-stat-label">{{ t("active") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ votingPower }}</span>
                <span class="hero-stat-label">{{ t("votingPower") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ proposals.length }}</span>
                <span class="hero-stat-label">{{ t("totalProposals") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <ActiveProposalsTab
        :proposals="activeProposals"
        :status="status"
        :loading="loadingProposals"
        :voting-power="votingPower"
        :is-candidate="isCandidate"
        :candidate-loaded="candidateLoaded"
        :t="t"
        @create="activeTab = 'create'"
        @select="selectProposal"
      />
    </template>

    <template #tab-history>
      <HistoryProposalsTab :proposals="historyProposals" :t="t" @select="selectProposal" />
    </template>

    <template #tab-create>
      <CreateProposalTab ref="createTabRef" :t="t" :status="status" @submit="createProposal" />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('quickActions')">
        <NeoButton size="sm" variant="primary" class="op-btn" @click="activeTab = 'create'">
          {{ t("createProposal") }}
        </NeoButton>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>

  <ProposalDetailsModal
    v-if="selectedProposal"
    :proposal="selectedProposal"
    :address="address"
    :is-candidate="isCandidate"
    :has-voted="!!hasVotedMap[selectedProposal.id]"
    :is-voting="isVoting"
    :t="t"
    @close="selectedProposal = null"
    @vote="castVote"
    @execute="executeProposal"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
import { useGovernance } from "@/composables/useGovernance";
import ActiveProposalsTab from "./components/ActiveProposalsTab.vue";
import CreateProposalTab from "./components/CreateProposalTab.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "council-governance",
    messages,
    template: {
      tabs: [
        { key: "active", labelKey: "active", icon: "\u{1F3DB}\uFE0F", default: true },
        { key: "create", labelKey: "create", icon: "\u{1F4DD}" },
        { key: "history", labelKey: "history", icon: "\u{1F4DC}" },
      ],
      fireworks: true,
    },
    sidebarItems: [
      { labelKey: "active", value: () => activeProposals.value.length },
      { labelKey: "history", value: () => historyProposals.value.length },
      { labelKey: "totalProposals", value: () => proposals.value.length },
      { labelKey: "votingPower", value: () => votingPower.value },
    ],
  });

const { address, appChainId } = useWallet() as WalletSDK;

const currentChainId = ref<"neo-n3-mainnet" | "neo-n3-testnet">("neo-n3-testnet");

watch(
  () => appChainId.value,
  (value) => {
    if (value === "neo-n3-mainnet" || value === "neo-n3-testnet") {
      currentChainId.value = value;
    }
  },
  { immediate: true },
);

const {
  proposals,
  activeProposals,
  historyProposals,
  selectedProposal,
  loadingProposals,
  candidateLoaded,
  isCandidate,
  votingPower,
  hasVotedMap,
  isVoting,
  selectProposal,
  castVote,
  createProposal: submitProposal,
  executeProposal,
  refreshCandidateStatus,
  refreshHasVoted,
  init,
} = useGovernance(setStatus, currentChainId);

const activeTab = ref("active");
const createTabRef = ref<InstanceType<typeof CreateProposalTab> | null>(null);

const appState = computed(() => ({
  activeProposals: activeProposals.value.length,
  totalProposals: proposals.value.length,
}));
const createProposal = async (proposalData: {
  type: number;
  title: string;
  description: string;
  policyMethod?: string;
  policyValue?: string;
  duration: number;
}) => {
  const success = await submitProposal(proposalData);
  if (success) {
    if (createTabRef.value?.reset) createTabRef.value.reset();
    activeTab.value = "active";
  }
};

onMounted(async () => {
  await init();
});

watch(address, async () => {
  await refreshCandidateStatus();
  await refreshHasVoted();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./council-governance-theme.scss" as *;

:global(body) {
  background: var(--senate-bg);
}

.hero-container {
  margin-bottom: 20px;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

.op-btn {
  width: 100%;
}

/* ── Council Governance Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(100, 80, 220, 0.12) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes gavel-swing {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 0.85;
  }
  15% {
    transform: rotate(12deg) scale(1.05);
    opacity: 1;
  }
  30% {
    transform: rotate(-3deg) scale(1);
    opacity: 0.9;
  }
  45% {
    transform: rotate(6deg) scale(1.02);
    opacity: 0.95;
  }
  60% {
    transform: rotate(0deg) scale(1);
    opacity: 0.85;
  }
}

@keyframes vote-count-glow {
  0%,
  100% {
    box-shadow:
      0 0 12px rgba(100, 80, 220, 0.12),
      0 0 24px rgba(100, 80, 220, 0.05);
  }
  50% {
    box-shadow:
      0 0 20px rgba(100, 80, 220, 0.25),
      0 0 40px rgba(100, 80, 220, 0.1);
  }
}

.hero-stat {
  background: linear-gradient(135deg, rgba(100, 80, 220, 0.1) 0%, rgba(159, 157, 243, 0.06) 100%);
  box-shadow: 0 0 12px rgba(159, 157, 243, 0.08);
  animation: vote-count-glow 4s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 22px rgba(100, 80, 220, 0.3);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.5s;
}

.hero-stat:nth-child(3) {
  animation-delay: 1s;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(100, 80, 220, 0.3);
}

:deep(.hero-icon) {
  animation: gavel-swing 5s ease-in-out infinite;
  transform-origin: 70% 90%;
}
</style>
