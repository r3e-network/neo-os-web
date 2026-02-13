<template>
  <view class="theme-masquerade">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="combinedStatus"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <ProposalList
            :items="masks"
            :selectedId="selectedMaskId"
            :title="t('yourMasks')"
            :emptyText="t('noMasks')"
            :t="t"
            @select="selectedMaskId = $event"
          />
        </ErrorBoundary>
      </template>

      <template #operation>
        <CreateProposal
          v-model="createForm"
          :identityHash="identityHash"
          :canCreate="canCreateMask"
          :isLoading="isCreating"
          :t="t"
          @create="handleCreateMask"
        />
      </template>

      <template #tab-vote>
        <VoteForm
          v-model="voteForm"
          :masks="masks"
          :selectedMaskId="selectedMaskId"
          :canVote="canVote && !!selectedMaskId"
          :t="t"
          @update:selectedMaskId="selectedMaskId = $event"
          @vote="handleVote"
        />

        <ProposalList
          :items="proposals"
          :selectedId="voteForm.proposalId"
          :title="t('activeProposals')"
          :emptyText="t('noActiveProposals')"
          :t="t"
          @select="voteForm.proposalId = $event"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useMasqueradeProposals } from "@/composables/useMasqueradeProposals";
import { useMasqueradeVoting, type VoteChoice } from "@/composables/useMasqueradeVoting";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import CreateProposal from "@/components/CreateProposal.vue";
import ProposalList from "@/components/ProposalList.vue";
import VoteForm from "@/components/VoteForm.vue";

const { t } = createUseI18n(messages)();
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

const activeTab = ref("identity");

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "identity", labelKey: "identity", icon: "👤", default: true },
    { key: "vote", labelKey: "vote", icon: "🗳️" },
  ],
});

const appState = computed(() => ({
  totalMasks: masks.value.length,
  totalProposals: proposals.value.length,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "yourMasks", value: () => masks.value.length },
  { labelKey: "activeProposals", value: () => proposals.value.length },
  { labelKey: "identity", value: () => (identityHash.value ? identityHash.value.slice(0, 8) + "..." : "--") },
]);

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

const { handleBoundaryError } = useHandleBoundaryError("masquerade-dao");

const resetAndReload = async () => {
  loadMasks(t);
  loadProposals(t);
};

const handleCreateMask = async () => {
  await createMask(t);
};

const handleVote = async (choice: number) => {
  if (!selectedMaskId.value) return;
  await submitVote(selectedMaskId.value, choice as VoteChoice, t);
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
  loadMasks(t);
  loadProposals(t);
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
