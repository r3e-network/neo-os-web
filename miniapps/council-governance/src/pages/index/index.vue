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
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
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
  { immediate: true },
);

const {
  proposals, activeProposals, historyProposals, selectedProposal,
  loadingProposals, candidateLoaded, isCandidate, votingPower,
  hasVotedMap, isVoting,
  selectProposal, castVote, createProposal: submitProposal,
  executeProposal, refreshCandidateStatus, refreshHasVoted, init,
} = useGovernance(showStatus, currentChainId);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "market-list",
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
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap";
  link.media = "print";
  link.onload = () => { link.media = "all"; };
  document.head.appendChild(link);

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
/* Google Font loaded asynchronously via onMounted to avoid render-blocking */

:global(page) {
  background: var(--senate-bg);
}

.tab-content {
  padding: 32px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--senate-bg);
  /* Marble texture simulation */
  background-image:
    url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJ4Ij48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42IiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI3gpIiBvcGFjaXR5PSIwLjEiLz48L3N2Zz4="),
    linear-gradient(to bottom, var(--senate-marble-top), var(--senate-marble-bottom));
  min-height: 100vh;
}

/* Senate Component Overrides */
:deep(.neo-card) {
  background: var(--senate-card-bg) !important;
  border: 1px solid var(--senate-card-border) !important;
  border-top: 4px solid var(--senate-gold) !important;
  box-shadow: var(--senate-card-shadow) !important;
  border-radius: 2px !important;
  color: var(--senate-slate) !important;

  &.variant-danger {
    background: var(--senate-danger-bg) !important;
    border-color: var(--senate-danger-border) !important;
    color: var(--senate-danger-text) !important;
  }
}

:deep(.neo-button) {
  font-family: var(--senate-font) !important;
  border-radius: 2px !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700 !important;

  &.variant-primary {
    background: var(--senate-button-gradient) !important;
    color: var(--senate-gold) !important;
    border: 1px solid var(--senate-gold) !important;

    &:active {
      transform: translateY(1px);
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--senate-slate) !important;
    color: var(--senate-slate) !important;
  }
}

/* Typography Overrides */
:deep(text),
:deep(view) {
  font-family: "Times New Roman", serif;
}
:deep(.neo-card text.font-bold) {
  font-family: var(--senate-font) !important;
  color: var(--senate-slate) !important;
}


</style>
