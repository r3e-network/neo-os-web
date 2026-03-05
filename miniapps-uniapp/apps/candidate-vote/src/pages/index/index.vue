<template>
  <MiniAppPage
    name="candidate-vote"
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
  </MiniAppPage>

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
</template>

<script setup lang="ts">
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import CandidateList from "./components/CandidateList.vue";
import { useCandidateVotePage } from "./composables/useCandidateVotePage";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "candidate-vote",
  messages,
  template: {
    tabs: [
      { key: "vote", labelKey: "vote", icon: "\uD83D\uDCCB", default: true },
      { key: "info", labelKey: "info", icon: "\uD83D\uDCCA" },
    ],
  },
  sidebarItems: [
    { labelKey: "candidates", value: () => candidates.value.length },
    { labelKey: "totalVotes", value: () => formatVotes(totalNetworkVotes.value) },
    { labelKey: "blockHeight", value: () => blockHeight.value || "\u2014" },
    { labelKey: "yourVote", value: () => (normalizedUserVotedPublicKey.value ? t("active") : t("none")) },
  ],
});

const {
  address,
  candidates,
  totalNetworkVotes,
  blockHeight,
  candidatesLoading,
  formatVotes,
  normalizePublicKey,
  isLoading,
  status,
  normalizedUserVotedPublicKey,
  selectedCandidate,
  showDetailModal,
  detailCandidate,
  detailRank,
  governancePortalUrl,
  appState,
  selectCandidate,
  openCandidateDetail,
  closeCandidateDetail,
  onVote,
  handleVoteFromModal,
  resetAndReload,
} = useCandidateVotePage(t);
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
