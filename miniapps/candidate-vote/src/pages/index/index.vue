<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-candidate-vote" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <!-- Vote Tab -->
    <view v-if="activeTab === 'vote'" class="tab-content scrollable">
      <NeoCard
        v-if="status"
        :variant="status.type === 'error' ? 'danger' : 'success'"
        class="mb-4 text-center font-bold"
      >
        <text>{{ status.msg }}</text>
      </NeoCard>

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

      <!-- Vote Form -->
      <NeoCard variant="erobo-neo">
        <view class="vote-form">
          <NeoCard v-if="selectedCandidate" variant="erobo-neo" flat class="selected-candidate-card glass-panel">
            <text class="selected-label">{{ t("votingFor") }}</text>
            <view class="candidate-badge">
              <!-- Logo and Name Row -->
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

              <!-- Description -->
              <text v-if="selectedCandidate.description" class="candidate-desc">
                {{ selectedCandidate.description }}
              </text>

              <!-- Address Details -->
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
            @click="handleVote"
          >
            {{ t("voteNow") }}
          </NeoButton>

          <view v-if="!address" class="connect-hint">
            <text class="hint-text">{{ t("connectWallet") }}</text>
          </view>
        </view>
      </NeoCard>
    </view>

    <!-- Info Tab -->
    <InfoTab v-if="activeTab === 'info'" :address="address" />

    <!-- Docs Tab -->
    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>

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
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import type { GovernanceCandidate } from "./utils";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { ResponsiveLayout, NeoDoc, NeoCard, NeoButton, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import CandidateList from "./components/CandidateList.vue";
import CandidateDetailModal from "./components/CandidateDetailModal.vue";
import InfoTab from "./components/InfoTab.vue";
import { fetchCandidates } from "./utils";

const { t } = useI18n();

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

const { address, connect, invokeContract, invokeRead, chainType, chainId, appChainId, switchToAppChain } =
  useWallet() as WalletSDK;

const navTabs = computed<NavTab[]>(() => [
  { id: "vote", icon: "checkbox", label: t("vote") },
  { id: "info", icon: "info", label: t("info") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("vote");
const isLoading = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

// Candidate state
const candidates = ref<GovernanceCandidate[]>([]);
const selectedCandidate = ref<GovernanceCandidate | null>(null);
const totalNetworkVotes = ref("0");
const blockHeight = ref(0);
const candidatesLoading = ref(false);

// Modal state
const showDetailModal = ref(false);
const detailCandidate = ref<GovernanceCandidate | null>(null);
const detailRank = ref(1);

// User's voted candidate
const userVotedPublicKey = ref<string | null>(null);

const getCacheKey = (network: "mainnet" | "testnet") => `candidate_vote_candidates_cache_${network}`;

const preferredChainId = computed(() => appChainId.value || chainId.value || "neo-n3-testnet");

const governancePortalUrl = computed(() =>
  preferredChainId.value === "neo-n3-testnet"
    ? "https://governance.neo.org/testnet#/"
    : "https://governance.neo.org/#/",
);

const showStatus = (msg: string, type: string) => {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
};

const shortenAddress = (addr: string): string => {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const normalizePublicKey = (value: unknown) => String(value || "").replace(/^0x/i, "");

const readCache = (key: string) => {
  const uniApi = (globalThis as any)?.uni;
  if (uniApi?.getStorageSync) {
    return uniApi.getStorageSync(key);
  }
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(key);
  }
  return null;
};

const writeCache = (key: string, value: string) => {
  const uniApi = (globalThis as any)?.uni;
  if (uniApi?.setStorageSync) {
    uniApi.setStorageSync(key, value);
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, value);
  }
};

const formatVotes = (votes: string): string => {
  const num = BigInt(votes || "0");
  if (num >= BigInt(1e12)) {
    return (Number(num / BigInt(1e10)) / 100).toFixed(2) + "T";
  }
  if (num >= BigInt(1e9)) {
    return (Number(num / BigInt(1e7)) / 100).toFixed(2) + "B";
  }
  if (num >= BigInt(1e6)) {
    return (Number(num / BigInt(1e4)) / 100).toFixed(2) + "M";
  }
  if (num >= BigInt(1e3)) {
    return (Number(num / BigInt(10)) / 100).toFixed(2) + "K";
  }
  return votes || "0";
};

const normalizedUserVotedPublicKey = computed(() => {
  const normalized = normalizePublicKey(userVotedPublicKey.value);
  return normalized || null;
});

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

const handleVoteFromModal = async (candidate: GovernanceCandidate) => {
  selectedCandidate.value = candidate;
  closeCandidateDetail();
  await handleVote();
};

// Get user's current vote from chain
const loadUserVote = async () => {
  if (!requireNeoChain(chainType, t)) return;
  if (!address.value) {
    userVotedPublicKey.value = null;
    return;
  }
  try {
    const result = await invokeRead({
      scriptHash: NEO_CONTRACT,
      operation: "GetAccountState",
      args: [{ type: "Hash160", value: address.value }],
    });
    // Result contains voteTo field with the public key user voted for
    // Neo AccountState: [Balance, Height, VoteTo]
    const parsed = parseInvokeResult(result);
    let voteValue: unknown = null;
    if (Array.isArray(parsed)) {
      voteValue = parsed[2];
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      // Handle various response shapes
      voteValue = record.voteTo ?? record.VoteTo ?? record.vote_to;
    }
    const normalized = normalizePublicKey(voteValue);
    userVotedPublicKey.value = normalized || null;
  } catch (e) {
    userVotedPublicKey.value = null;
  }
};

const loadCandidates = async (force = false) => {
  // Try cache first
  const network = preferredChainId.value === "neo-n3-testnet" ? "testnet" : "mainnet";
  const cacheKey = getCacheKey(network);

  try {
    const cached = readCache(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      candidates.value = parsed.candidates || [];
      totalNetworkVotes.value = parsed.totalVotes || "0";

      const lastFetch = parsed.timestamp || 0;
      const now = Date.now();
      // If cache is fresh (less than 5 minutes) and we have data, skip fetch unless forced
      if (!force && now - lastFetch < 5 * 60 * 1000 && candidates.value.length > 0) {
        return;
      }
    }
  } catch {}

  candidatesLoading.value = true;
  try {
    const targetChain = preferredChainId.value === "neo-n3-testnet" ? "neo-n3-testnet" : "neo-n3-mainnet";
    const response = await fetchCandidates(targetChain);
    candidates.value = response.candidates;
    totalNetworkVotes.value = response.totalVotes || "0";
    blockHeight.value = response.blockHeight || 0;

    if (selectedCandidate.value) {
      const match = candidates.value.find(
        (candidate) =>
          normalizePublicKey(candidate.publicKey) === normalizePublicKey(selectedCandidate.value?.publicKey),
      );
      selectedCandidate.value = match || null;
    }

    writeCache(
      cacheKey,
      JSON.stringify({
        candidates: candidates.value,
        totalVotes: totalNetworkVotes.value,
        blockHeight: blockHeight.value,
        timestamp: Date.now(),
      }),
    );
  } catch (e: any) {
    if (candidates.value.length === 0) {
      showStatus(t("failedToLoad") || "Failed to load candidates", "error");
    }
  } finally {
    candidatesLoading.value = false;
  }
};

const handleVote = async () => {
  if (isLoading.value || !selectedCandidate.value) return;
  if (!requireNeoChain(chainType, t)) return;

  if (!address.value) {
    await connect();
  }
  if (!address.value) {
    showStatus(t("connectWallet"), "error");
    return;
  }

  isLoading.value = true;
  try {
    // Call the native NEO contract's vote method
    // vote(account, voteTo) - voteTo is the public key of the candidate
    await invokeContract({
      scriptHash: NEO_CONTRACT,
      operation: "Vote",
      args: [
        { type: "Hash160", value: address.value },
        { type: "PublicKey", value: selectedCandidate.value.publicKey },
      ],
    });

    showStatus(t("voteSuccess"), "success");
    // Refresh candidates (force refresh) and user vote to show updated state
    await Promise.all([loadCandidates(true), loadUserVote()]);
  } catch (e: any) {
    showStatus(e.message || t("voteFailed"), "error");
  } finally {
    isLoading.value = false;
  }
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

// Theme-aware styles
.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100vh;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

:deep(.neo-card) {
  // Use CSS variables for theme switching
  &.variant-erobo-neo {
    background: var(--candidate-card-bg) !important;
    border: 1px solid var(--candidate-card-border) !important;
    backdrop-filter: blur(10px);
  }
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
    font-family: monospace;
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

// Custom Vote Button Style (Gradient Pill works for both themes)
:deep(.neo-button) {
  &.variant-primary {
    background: var(--candidate-cta-gradient) !important;
    border: none !important;
    color: var(--candidate-cta-text) !important;
    font-weight: 800 !important;
    border-radius: 99px !important;
    box-shadow: var(--candidate-cta-shadow);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 16px !important;
    height: 56px;

    &:active {
      transform: scale(0.98);
      box-shadow: var(--candidate-cta-shadow-press);
    }

    &[disabled] {
      background: var(--candidate-disabled-bg) !important;
      color: var(--candidate-disabled-text) !important;
      box-shadow: none;
    }
  }
}

.no-candidate-card {
  background: var(--candidate-warning-bg) !important;
  border: 1px dashed var(--candidate-warning-border) !important;
}


// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
