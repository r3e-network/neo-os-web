<template>
  <view class="theme-candidate-vote">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <!-- Candidate List -->
          <CandidateList
            :candidates="candidates"
            :selected-candidate="selectedCandidate"
            :user-voted-public-key="normalizedUserVotedPublicKey"
            :total-votes="totalNetworkVotes"
            :is-loading="candidatesLoading"
            @select="selectCandidate"
            @view-details="openCandidateDetail"
          />
        </ErrorBoundary>
      </template>

      <template #operation>
        <!-- Vote Form -->
        <NeoCard variant="erobo-neo">
          <view class="vote-form">
            <NeoCard v-if="selectedCandidate" variant="erobo-neo" flat class="selected-candidate-card">
              <text class="selected-label">{{ t("votingFor") }}</text>
              <view class="candidate-badge">
                <view class="logo-name-row">
                  <image
                    v-if="selectedCandidate.logo"
                    class="candidate-logo-sm"
                    :src="selectedCandidate.logo"
                    mode="aspectFit"
                    :alt="selectedCandidate.name || t('candidateLogo')"
                  />
                  <text class="candidate-name">{{ selectedCandidate.name || selectedCandidate.address }}</text>
                </view>
                <text v-if="selectedCandidate.description" class="candidate-desc">
                  {{ selectedCandidate.description }}
                </text>
                <view class="details-grid">
                  <view class="detail-item">
                    <text class="detail-label">{{ t("publicKey") }}</text>
                    <text class="detail-value mono">{{ selectedCandidate.publicKey }}</text>
                  </view>
                  <view class="detail-item">
                    <text class="detail-label">{{ t("address") }}</text>
                    <text class="detail-value mono">{{ selectedCandidate.address }}</text>
                  </view>
                </view>
              </view>
            </NeoCard>

            <NeoCard v-else variant="warning" flat class="no-candidate-card">
              <text class="warning-text text-center">{{ t("selectCandidateFirst") }}</text>
            </NeoCard>

            <NeoButton
              variant="primary"
              size="lg"
              block
              :disabled="!selectedCandidate || !address || isLoading"
              :loading="isLoading"
              @click="onVote"
            >
              {{ t("voteNow") }}
            </NeoButton>

            <view v-if="!address" class="connect-hint">
              <text class="hint-text">{{ t("connectWallet") }}</text>
            </view>
          </view>
        </NeoCard>
      </template>

      <template #tab-info>
        <InfoTab :address="address" />
      </template>
    </MiniAppTemplate>

    <!-- Candidate Detail Modal -->
    <CandidateDetailModal
      v-if="showDetailModal"
      :candidate="detailCandidate"
      :rank="detailRank"
      :total-votes="totalNetworkVotes"
      :is-user-voted="
        detailCandidate ? normalizePublicKey(detailCandidate.publicKey) === normalizedUserVotedPublicKey : false
      "
      :can-vote="!!address && !isLoading"
      :governance-portal-url="governancePortalUrl"
      @close="closeCandidateDetail"
      @vote="handleVoteFromModal"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import type { GovernanceCandidate } from "./utils";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import CandidateList from "./components/CandidateList.vue";
import CandidateDetailModal from "./components/CandidateDetailModal.vue";
import InfoTab from "./components/InfoTab.vue";
import { useCandidateData } from "./composables/useCandidateData";
import { useVoting } from "./composables/useVoting";

const { t } = useI18n();
const wallet = useWallet() as WalletSDK;
const { address, chainId, appChainId } = wallet;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "vote", labelKey: "vote", icon: "\uD83D\uDCCB", default: true },
    { key: "info", labelKey: "info", icon: "\uD83D\uDCCA" },
    { key: "docs", labelKey: "docs", icon: "\uD83D\uDCD6" },
  ],
  features: {
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

const activeTab = ref("vote");
const preferredChainId = computed(() => appChainId.value || chainId.value || "neo-n3-testnet");

const governancePortalUrl = computed(() =>
  preferredChainId.value === "neo-n3-testnet" ? "https://governance.neo.org/testnet#/" : "https://governance.neo.org/#/"
);

// Composables
const {
  candidates,
  totalNetworkVotes,
  blockHeight,
  candidatesLoading,
  formatVotes,
  normalizePublicKey,
  loadCandidates: loadCandidatesRaw,
} = useCandidateData(() => preferredChainId.value);

// Selection state
const selectedCandidate = ref<GovernanceCandidate | null>(null);

const loadCandidates = async (force = false) => {
  const result = await loadCandidatesRaw(force, selectedCandidate.value);
  if (result?.updatedSelection !== undefined) {
    selectedCandidate.value = result.updatedSelection;
  }
};

const { isLoading, status, normalizedUserVotedPublicKey, loadUserVote, handleVote } = useVoting(
  wallet,
  t,
  normalizePublicKey,
  loadCandidates
);

// Modal state
const showDetailModal = ref(false);
const detailCandidate = ref<GovernanceCandidate | null>(null);
const detailRank = ref(1);

const appState = computed(() => ({
  candidateCount: candidates.value.length,
  totalNetworkVotes: totalNetworkVotes.value,
}));

const sidebarItems = computed(() => [
  { label: t("candidates"), value: candidates.value.length },
  { label: t("totalVotes"), value: formatVotes(totalNetworkVotes.value) },
  { label: t("blockHeight"), value: blockHeight.value || "\u2014" },
  { label: t("yourVote"), value: normalizedUserVotedPublicKey.value ? t("active") : t("none") },
]);

const selectCandidate = (candidate: GovernanceCandidate) => {
  selectedCandidate.value = candidate;
};

const openCandidateDetail = (candidate: GovernanceCandidate, rank: number) => {
  detailCandidate.value = candidate;
  detailRank.value = rank;
  showDetailModal.value = true;
};

const closeCandidateDetail = () => {
  showDetailModal.value = false;
  detailCandidate.value = null;
};

const onVote = () => handleVote(selectedCandidate.value);

const handleVoteFromModal = async (candidate: GovernanceCandidate) => {
  selectedCandidate.value = candidate;
  closeCandidateDetail();
  await handleVote(selectedCandidate.value);
};

const handleBoundaryError = (error: Error) => {
  console.error("[candidate-vote] boundary error:", error);
};

const resetAndReload = async () => {
  await Promise.all([loadCandidates(), loadUserVote()]);
};

onMounted(async () => {
  await Promise.all([loadCandidates(), loadUserVote()]);
});

watch(address, () => {
  loadUserVote();
});
watch(preferredChainId, () => {
  loadCandidates();
  loadUserVote();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./candidate-vote-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.vote-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.selected-candidate-card {
  padding: 16px;
  border-radius: 16px !important;
}

.selected-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--candidate-accent);
  letter-spacing: 0.1em;
  display: block;
  margin-bottom: 8px;
}

.candidate-badge {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.logo-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.candidate-logo-sm {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--candidate-logo-bg);
}

.candidate-name {
  font-weight: 700;
  font-size: 18px;
  color: var(--text-primary);
  font-family: $font-family;
}

.candidate-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-top: 4px;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.details-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0.7;
}

.detail-value {
  font-size: 11px;
  color: var(--text-primary);
  &.mono {
    font-family: var(--font-family-mono, monospace);
    word-break: break-all;
  }
}

.warning-text {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--candidate-warning);
}

.connect-hint {
  text-align: center;
  padding: 8px;
}

.hint-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.no-candidate-card {
  background: var(--candidate-warning-bg) !important;
  border: 1px dashed var(--candidate-warning-border) !important;
}
</style>
