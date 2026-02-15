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
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
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
  { immediate: true }
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

const opStats = computed(() => [
  { label: t("active"), value: activeProposals.value.length },
  { label: t("votingPower"), value: votingPower.value },
]);

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
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./council-governance-theme.scss";

:global(page) {
  background: var(--senate-bg);
}

.op-btn {
  width: 100%;
}
</style>
