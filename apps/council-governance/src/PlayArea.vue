<template>
  <div class="council-play-area">
    <GovernanceHeroStats
      :t="t"
      :active-count="activeProposals.length"
      :voting-power="votingPower"
      :total-proposals="proposals.length"
    />

    <ActiveProposalsTab
      :proposals="activeProposals"
      :status="null"
      :loading="loadingProposals"
      :voting-power="votingPower"
      :is-candidate="isCandidate"
      :candidate-loaded="candidateLoaded"
      :t="t"
      @create="handleCreateTab"
      @select="selectProposal"
    />

    <QuickActionsCard :t="t" @create="handleCreateTab" />

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
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import ActiveProposalsTab from "./pages/index/components/ActiveProposalsTab.vue";
import ProposalDetailsModal from "./pages/index/components/ProposalDetailsModal.vue";
import GovernanceHeroStats from "./components/GovernanceHeroStats.vue";
import QuickActionsCard from "./components/QuickActionsCard.vue";
import type { Proposal } from "./composables/useGovernance";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const proposals = computed(() => (props.state.proposals?.value ?? []) as Proposal[]);
const activeProposals = computed(() => (props.state.activeProposals?.value ?? []) as Proposal[]);
const selectedProposal = computed({
  get: () => (props.state.selectedProposal?.value ?? null) as Proposal | null,
  set: () => { /* managed by composable */ },
});
const loadingProposals = computed(() => Boolean(props.state.loadingProposals?.value ?? false));
const candidateLoaded = computed(() => Boolean(props.state.candidateLoaded?.value ?? false));
const isCandidate = computed(() => Boolean(props.state.isCandidate?.value ?? false));
const votingPower = computed(() => Number(props.state.votingPower?.value ?? 0));
const hasVotedMap = computed(() => (props.state.hasVotedMap?.value ?? {}) as Record<number, boolean>);
const isVoting = computed(() => Boolean(props.state.isVoting?.value ?? false));
const address = computed(() => String(props.state.address?.value ?? ""));

const selectProposal = async (p: Proposal) => {
  if (props.state.selectedProposal) {
    (props.state.selectedProposal as Ref<Proposal | null>).value = p;
  }
};

const castVote = async (proposalId: number, voteType: "for" | "against") => {
  const handler = actions.get("castVote");
  if (handler) await handler(proposalId, voteType);
};

const executeProposal = async (proposalId: number) => {
  const handler = actions.get("executeProposal");
  if (handler) await handler(proposalId);
};

const handleCreateTab = () => {
  // Navigate to create tab — emitted via platform tab change
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/council-governance-theme.scss" as *;

:global(body) {
  background: var(--senate-bg);
}

.council-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
