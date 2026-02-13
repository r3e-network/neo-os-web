<template>
  <view class="theme-council-governance">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="status?.type === 'success'"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
      </template>

      <template #tab-history>
        <HistoryProposalsTab :proposals="historyProposals" :t="t" @select="selectProposal" />
      </template>

      <template #tab-create>
        <CreateProposalTab ref="createTabRef" :t="t" :status="status" @submit="createProposal" />
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('quickActions')">
          <NeoStats :stats="opStats" />
          <NeoButton size="sm" variant="primary" class="op-btn" @click="activeTab = 'create'">
            {{ t("createProposal") }}
          </NeoButton>
        </NeoCard>
      </template>
    </MiniAppTemplate>

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
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { useGovernance } from "@/composables/useGovernance";
import ActiveProposalsTab from "./components/ActiveProposalsTab.vue";
import HistoryProposalsTab from "./components/HistoryProposalsTab.vue";
import CreateProposalTab from "./components/CreateProposalTab.vue";
import ProposalDetailsModal from "./components/ProposalDetailsModal.vue";

const { t } = useI18n();
const { address, appChainId } = useWallet() as WalletSDK;
const { status, setStatus: showStatus } = useStatusMessage();

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
} = useGovernance(showStatus, currentChainId);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "active", labelKey: "active", icon: "\u{1F3DB}\uFE0F", default: true },
    { key: "create", labelKey: "create", icon: "\u{1F4DD}" },
    { key: "history", labelKey: "history", icon: "\u{1F4DC}" },
    { key: "docs", labelKey: "docs", icon: "\u{1F4D6}" },
  ],
  features: {
    fireworks: true,
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

const activeTab = ref("active");
const createTabRef = ref<InstanceType<typeof CreateProposalTab> | null>(null);

const appState = computed(() => ({
  activeProposals: activeProposals.value.length,
  totalProposals: proposals.value.length,
}));

const sidebarItems = computed(() => [
  { label: t("active"), value: activeProposals.value.length },
  { label: t("history"), value: historyProposals.value.length },
  { label: t("totalProposals"), value: proposals.value.length },
  { label: t("votingPower"), value: votingPower.value },
]);

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

const { handleBoundaryError } = useHandleBoundaryError("council-governance");
const resetAndReload = async () => {
  await init();
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
