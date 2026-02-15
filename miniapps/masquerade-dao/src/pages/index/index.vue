<template>
  <MiniAppPage
    name="masquerade-dao"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="combinedStatus"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <ProposalList
        :items="masks"
        :selectedId="selectedMaskId"
        :title="t('yourMasks')"
        :emptyText="t('noMasks')"
        @select="selectedMaskId = $event"
      />
    </template>

    <template #operation>
      <CreateProposal
        v-model="createForm"
        :identityHash="identityHash"
        :canCreate="canCreateMask"
        :isLoading="isCreating"
        @create="handleCreateMask"
      />
    </template>

    <template #tab-vote>
      <VoteForm
        v-model="voteForm"
        :masks="masks"
        :selectedMaskId="selectedMaskId"
        :canVote="canVote && !!selectedMaskId"
        @update:selectedMaskId="selectedMaskId = $event"
        @vote="handleVote"
      />

      <ProposalList
        :items="proposals"
        :selectedId="voteForm.proposalId"
        :title="t('activeProposals')"
        :emptyText="t('noActiveProposals')"
        @select="voteForm.proposalId = $event"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useMasqueradeProposals } from "@/composables/useMasqueradeProposals";
import { useMasqueradeVoting } from "@/composables/useMasqueradeVoting";
import ProposalList from "@/components/ProposalList.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "masquerade-dao",
  messages,
  template: {
    tabs: [
      { key: "identity", labelKey: "identity", icon: "👤", default: true },
      { key: "vote", labelKey: "vote", icon: "🗳️" },
    ],
  },
  sidebarItems: [
    { labelKey: "yourMasks", value: () => masks.value.length },
    { labelKey: "activeProposals", value: () => proposals.value.length },
    { labelKey: "identity", value: () => (identityHash.value ? identityHash.value.slice(0, 8) + "..." : "--") },
  ],
});
const APP_ID = "miniapp-masqueradedao";

const {
  masks,
  proposals,
  selectedMaskId,
  identitySeed,
  identityHash,
  maskType,
  status: maskStatus,
  isLoading: isCreating,
  canCreateMask,
  loadMasks,
  loadProposals,
  createMask,
} = useMasqueradeProposals(APP_ID);

const { proposalId, status: voteStatus, isLoading: isVoting, canVote, submitVote } = useMasqueradeVoting(APP_ID);

const appState = computed(() => ({
  totalMasks: masks.value.length,
  totalProposals: proposals.value.length,
}));

const combinedStatus = computed(() => maskStatus.value || voteStatus.value || null);

const createForm = computed({
  get: () => ({ identitySeed: identitySeed.value, maskType: maskType.value }),
  set: (val) => {
    identitySeed.value = val.identitySeed;
    maskType.value = val.maskType;
  },
});

const voteForm = computed({
  get: () => ({ proposalId: proposalId.value }),
  set: (val) => {
    proposalId.value = val.proposalId;
  },
});

const resetAndReload = async () => {
  loadMasks();
  loadProposals();
};

const handleCreateMask = async () => {
  await createMask();
};

const handleVote = async (choice: number) => {
  if (!selectedMaskId.value) return;
  await submitVote(selectedMaskId.value, choice as VoteChoice);
};

watch(identitySeed, async (value) => {
  if (value) {
    const { sha256Hex } = await import("@shared/utils/hash");
    identityHash.value = await sha256Hex(value);
  } else {
    identityHash.value = "";
  }
});

onMounted(() => {
  loadMasks();
  loadProposals();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./masquerade-dao-theme.scss";

:global(page) {
  background: var(--bg-primary);
}
</style>
