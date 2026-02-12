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
        <view class="app-container">
          <ProposalList
            :items="masks"
            :selectedId="selectedMaskId"
            :title="t('yourMasks')"
            :emptyText="t('noMasks')"
            :t="t"
            @select="selectedMaskId = $event"
          />
        </view>
      </template>

      <template #operation>
        <view class="app-container">
          <CreateProposal
            v-model="createForm"
            :identityHash="identityHash"
            :canCreate="canCreateMask"
            :isLoading="isCreating"
            :t="t"
            @create="handleCreateMask"
          />
        </view>
      </template>

      <template #tab-vote>
        <view class="app-container">
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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { useMasqueradeProposals } from "@/composables/useMasqueradeProposals";
import { useMasqueradeVoting, type VoteChoice } from "@/composables/useMasqueradeVoting";
import CreateProposal from "@/components/CreateProposal.vue";
import ProposalList from "@/components/ProposalList.vue";
import VoteForm from "@/components/VoteForm.vue";

const { t } = useI18n();
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

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "identity", labelKey: "identity", icon: "👤", default: true },
    { key: "vote", labelKey: "vote", icon: "🗳️" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
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

const appState = computed(() => ({
  totalMasks: masks.value.length,
  totalProposals: proposals.value.length,
}));

const sidebarItems = computed(() => [
  { label: t("yourMasks"), value: masks.value.length },
  { label: t("activeProposals"), value: proposals.value.length },
  { label: t("identity"), value: identityHash.value ? identityHash.value.slice(0, 8) + "..." : "--" },
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

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  background-color: var(--mask-bg);
  background-image:
    radial-gradient(circle at 50% 0%, var(--mask-glow), transparent 70%),
    linear-gradient(0deg, var(--mask-overlay), transparent 50%),
    radial-gradient(circle at 1px 1px, var(--mask-dot) 1px, transparent 0);
  background-size:
    auto,
    auto,
    20px 20px;
}

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.theme-masquerade :deep(.neo-card) {
  background: var(--mask-card) !important;
  border: 1px solid var(--mask-card-border) !important;
  border-radius: 16px !important;
  box-shadow: var(--mask-card-shadow) !important;
  backdrop-filter: blur(12px);
  color: var(--mask-text) !important;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--mask-gold), transparent);
    opacity: 0.3;
  }
}

.theme-masquerade :deep(.neo-button) {
  border-radius: 8px !important;
  font-family: "Cinzel", serif !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700 !important;

  &.variant-primary {
    background: linear-gradient(135deg, var(--mask-purple), var(--mask-velvet)) !important;
    border: 1px solid var(--mask-purple) !important;
    box-shadow: var(--mask-button-shadow) !important;
    color: var(--mask-button-text) !important;

    &:active {
      transform: scale(0.98);
      box-shadow: var(--mask-button-shadow-press) !important;
    }
  }

  &.variant-secondary {
    background: var(--mask-button-secondary-bg) !important;
    border: 1px solid var(--mask-button-secondary-border) !important;
    color: var(--mask-button-secondary-text) !important;
  }

  &.variant-danger {
    background: var(--mask-danger-bg) !important;
    border: 1px solid var(--mask-danger-border) !important;
    color: var(--mask-danger-text) !important;
  }
}

.theme-masquerade :deep(input),
.theme-masquerade :deep(.neo-input) {
  background: var(--mask-input-bg) !important;
  border: 1px solid var(--mask-input-border) !important;
  color: var(--mask-input-text) !important;
  border-radius: 8px !important;

  &:focus {
    border-color: var(--mask-purple) !important;
    box-shadow: 0 0 0 2px var(--mask-input-focus) !important;
  }
}


.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 11px;
  margin: 16px 24px 0;
  backdrop-filter: blur(10px);
  letter-spacing: 0.05em;

  &.success {
    background: var(--mask-success-bg);
    border: 1px solid var(--mask-success-border);
    color: var(--mask-success-text);
  }
  &.error {
    background: var(--mask-error-bg);
    border: 1px solid var(--mask-error-border);
    color: var(--mask-error-text);
  }
}
</style>
