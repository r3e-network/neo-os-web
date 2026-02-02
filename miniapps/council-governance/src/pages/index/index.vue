<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-council-governance" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <ActiveProposalsTab
      v-if="activeTab === 'active'"
      :proposals="activeProposals"
      :status="status"
      :loading="loadingProposals"
      :voting-power="votingPower"
      :is-candidate="isCandidate"
      :candidate-loaded="candidateLoaded"
      :t="t as any"
      @create="activeTab = 'create'"
      @select="selectProposal"
    />

    <HistoryProposalsTab
      v-if="activeTab === 'history'"
      :proposals="historyProposals"
      :t="t as any"
      @select="selectProposal"
    />

    <CreateProposalTab
      v-if="activeTab === 'create'"
      ref="createTabRef"
      :t="t as any"
      :status="status"
      @submit="createProposal"
    />

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

    <ProposalDetailsModal
      v-if="selectedProposal"
      :proposal="selectedProposal"
      :address="address"
      :is-candidate="isCandidate"
      :has-voted="!!hasVotedMap[selectedProposal.id]"
      :is-voting="isVoting"
      :t="t as any"
      @close="selectedProposal = null"
      @vote="castVote"
      @execute="executeProposal"
    />
    <Fireworks :active="status?.type === 'success'" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { ResponsiveLayout, NeoDoc, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import type { NavTab } from "@shared/components/NavBar.vue";
import ActiveProposalsTab from "./components/ActiveProposalsTab.vue";
import HistoryProposalsTab from "./components/HistoryProposalsTab.vue";
import CreateProposalTab from "./components/CreateProposalTab.vue";
import ProposalDetailsModal from "./components/ProposalDetailsModal.vue";

const { t } = useI18n();
const APP_ID = "miniapp-council-governance";

// Detect host URL for API calls (miniapp runs in iframe)
const getApiBase = () => {
  try {
    if (window.parent !== window) {
      const parentOrigin = document.referrer ? new URL(document.referrer).origin : "";
      if (parentOrigin) return parentOrigin;
    }
  } catch {
    // Fallback
  }
  return "";
};
const API_HOST = getApiBase();

const navTabs = computed(() => [
  { id: "active", icon: "vote", label: t("active") },
  { id: "create", icon: "file", label: t("create") },
  { id: "history", icon: "history", label: t("history") },
  { id: "docs", icon: "book", label: t("docs") },
]);
const activeTab = ref("active");

const { address, invokeContract, invokeRead, chainType, getContractAddress, appChainId, switchToAppChain } =
  useWallet() as WalletSDK;
const contractAddress = ref<string | null>(null);
const selectedProposal = ref<Proposal | null>(null);
const status = ref<{ msg: string; type: "success" | "error" | "info" } | null>(null);
const loadingProposals = ref(false);
const candidateLoaded = ref(false);
const isCandidate = ref(false);
const votingPower = ref(0);
const hasVotedMap = ref<Record<number, boolean>>({});
const isVoting = ref(false);
const createTabRef = ref<any>(null);
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

const STATUS_ACTIVE = 1;

interface Proposal {
  id: number;
  type: number;
  title: string;
  description: string;
  policyMethod?: string;
  policyValue?: string;
  yesVotes: number;
  noVotes: number;
  expiryTime: number;
  status: number;
}

type VoteChoice = "for" | "against";

const proposals = ref<Proposal[]>([]);
const STATUS_EXPIRED = 5;

const activeProposals = computed(() => proposals.value.filter((p) => resolveStatus(p) === STATUS_ACTIVE));
const historyProposals = computed(() => proposals.value.filter((p) => resolveStatus(p) !== STATUS_ACTIVE));

const resolveStatus = (proposal: Proposal) => {
  if (proposal.status === STATUS_ACTIVE && proposal.expiryTime < Date.now()) {
    return STATUS_EXPIRED;
  }
  return proposal.status;
};

const showStatus = (msg: string, type: "success" | "error" | "info" = "info") => {
  status.value = { msg, type };
  setTimeout(() => {
    status.value = null;
  }, 4000);
};

const ensureContractAddress = async (showMessage = true) => {
  if (!requireNeoChain(chainType, showMessage ? t : undefined, undefined, { silent: !showMessage })) {
    if (showMessage) {
      showStatus(t("wrongChain"), "error");
    }
    return false;
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) {
    if (showMessage) {
      showStatus(t("contractUnavailable"), "error");
    }
    return false;
  }
  return true;
};

const readMethod = async (operation: string, args: any[] = []) => {
  const hasHash = await ensureContractAddress(false);
  if (!hasHash) {
    throw new Error(t("contractUnavailable"));
  }
  const result = await invokeRead({ contractHash: contractAddress.value as string, operation, args });
  return parseInvokeResult(result);
};

const hasVoted = (proposalId: number) => Boolean(hasVotedMap.value[proposalId]);

const selectProposal = async (p: Proposal) => {
  selectedProposal.value = p;
  if (address.value) {
    await refreshHasVoted([p.id]);
  }
};

const castVote = async (proposalId: number, voteType: VoteChoice) => {
  if (isVoting.value) return;
  const proposal = activeProposals.value.find((p) => p.id === proposalId);
  if (!proposal || resolveStatus(proposal) !== STATUS_ACTIVE) return;
  const voter = address.value;
  if (!voter) {
    showStatus(t("connectWallet"), "error");
    return;
  }
  if (!isCandidate.value) {
    showStatus(t("notCandidate"), "error");
    return;
  }
  if (hasVoted(proposalId)) {
    showStatus(t("alreadyVoted"), "error");
    return;
  }
  const hasHash = await ensureContractAddress();
  if (!hasHash) return;

  try {
    isVoting.value = true;
    const support = voteType === "for";
    await invokeContract({
      scriptHash: contractAddress.value as string,
      operation: "vote",
      args: [
        { type: "Hash160", value: voter },
        { type: "Integer", value: proposalId },
        { type: "Boolean", value: support },
      ],
    });
    showStatus(t("voteRecorded"), "success");
    await loadProposals();
    await refreshHasVoted([proposalId]);
    selectedProposal.value = null;
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
  } finally {
    isVoting.value = false;
  }
};

const createProposal = async (proposalData: any) => {
  const title = proposalData.title.trim();
  const description = proposalData.description.trim();
  if (!title || !description) {
    showStatus(t("fillAllFields"), "error");
    return;
  }
  let policyValueNumber: number | null = null;
  if (proposalData.type === 1) {
    const rawPolicyValue = String(proposalData.policyValue).trim();
    if (!proposalData.policyMethod || !rawPolicyValue) {
      showStatus(t("policyFieldsRequired"), "error");
      return;
    }
    const parsed = Number(rawPolicyValue);
    if (!Number.isFinite(parsed)) {
      showStatus(t("invalidPolicyValue"), "error");
      return;
    }
    policyValueNumber = parsed;
  }
  if (!address.value) {
    showStatus(t("connectWallet"), "error");
    return;
  }
  if (!isCandidate.value) {
    showStatus(t("notCandidate"), "error");
    return;
  }
  const hasHash = await ensureContractAddress();
  if (!hasHash) return;

  const policyDataS =
    proposalData.type === 1 ? JSON.stringify({ method: proposalData.policyMethod, value: policyValueNumber }) : "";

  try {
    await invokeContract({
      scriptHash: contractAddress.value as string,
      operation: "createProposal",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: proposalData.type },
        { type: "String", value: title },
        { type: "String", value: description },
        { type: "ByteString", value: policyDataS },
        { type: "Integer", value: proposalData.duration },
      ],
    });
    showStatus(t("proposalSubmitted"), "success");
    if (createTabRef.value?.reset) {
      createTabRef.value.reset();
    }
    await loadProposals();
    activeTab.value = "active";
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
  }
};

const executeProposal = async (proposalId: number) => {
  if (!address.value) {
    showStatus(t("connectWallet"), "error");
    return;
  }
  const hasHash = await ensureContractAddress();
  if (!hasHash) return;

  try {
    await invokeContract({
      scriptHash: contractAddress.value as string,
      operation: "executeProposal",
      args: [{ type: "Integer", value: proposalId }],
    });
    showStatus(t("executed"), "success");
    await loadProposals();
    selectedProposal.value = null;
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
  }
};

const parseProposal = (data: Record<string, any>): Proposal => {
  const policyByteString = String(data.policyData || "");
  let policyMethod: string | undefined;
  let policyValue: string | undefined;
  if (policyByteString) {
    try {
      const parsed = JSON.parse(policyByteString);
      policyMethod = parsed.method;
      policyValue = parsed.value;
    } catch {
      policyValue = policyByteString;
    }
  }

  return {
    id: Number(data.id || 0),
    type: Number(data.type || 0),
    title: String(data.title || ""),
    description: String(data.description || ""),
    policyMethod,
    policyValue,
    yesVotes: Number(data.yesVotes || 0),
    noVotes: Number(data.noVotes || 0),
    expiryTime: Number(data.expiryTime || 0) * 1000,
    status: Number(data.status || 0),
  };
};

const CACHE_KEY = "council_proposals_cache";

const loadProposals = async () => {
  const hasHash = await ensureContractAddress();
  if (!hasHash) return;

  // 1. Load from cache first
  try {
    const cached = uni.getStorageSync(CACHE_KEY);
    if (cached) {
      proposals.value = JSON.parse(cached);
    }
  } catch {}

  try {
    loadingProposals.value = true;
    const count = Number((await readMethod("getProposalCount")) || 0);
    const list: Proposal[] = [];

    // Process in parallel to speed up initial load if many proposals exist
    const fetchProposal = async (id: number) => {
      const proposalData = await readMethod("getProposal", [{ type: "Integer", value: id }]);
      if (proposalData) {
        return parseProposal(proposalData);
      }
      return null;
    };

    // Parallel fetch for fresh data
    const results = await Promise.all(Array.from({ length: count }, (_, i) => i + 1).map(fetchProposal));

    list.push(...(results.filter((p) => p !== null) as Proposal[]));
    proposals.value = list.sort((a, b) => b.id - a.id);

    // 2. Save to cache
    uni.setStorageSync(CACHE_KEY, JSON.stringify(proposals.value));
  } catch (e: any) {
    if (proposals.value.length === 0) {
      showStatus(e.message || t("failedToLoadProposals"), "error");
    } else {
    }
  } finally {
    loadingProposals.value = false;
  }
};

const refreshCandidateStatus = async () => {
  if (!address.value) {
    isCandidate.value = false;
    votingPower.value = 0;
    candidateLoaded.value = true;
    return;
  }
  try {
    // Call API to check if address is in top 21 council members
    const res = await uni.request({
      url: `${API_HOST}/api/neo/council-members?chain_id=${currentChainId.value}&address=${address.value}`,
      method: "GET",
    });
    if (res.statusCode === 200 && res.data) {
      const data = res.data as { isCouncilMember?: boolean; chainId: string };
      isCandidate.value = Boolean(data.isCouncilMember);
      votingPower.value = isCandidate.value ? 1 : 0;
    } else {
      isCandidate.value = false;
      votingPower.value = 0;
    }
  } catch {
    isCandidate.value = false;
    votingPower.value = 0;
  } finally {
    candidateLoaded.value = true;
  }
};

const refreshHasVoted = async (proposalIds?: number[]) => {
  if (!address.value) return;
  const hasHash = await ensureContractAddress(false);
  if (!hasHash) return;
  const currentAddress = address.value;
  const currentHash = contractAddress.value as string;
  const ids = proposalIds ?? proposals.value.map((p) => p.id);
  const updates: Record<number, boolean> = { ...hasVotedMap.value };
  await Promise.all(
    ids.map(async (id) => {
      const res = await invokeRead({
        contractHash: currentHash,
        operation: "hasVoted",
        args: [
          { type: "Hash160", value: currentAddress },
          { type: "Integer", value: id },
        ],
      });
      updates[id] = Boolean(parseInvokeResult(res));
    }),
  );
  hasVotedMap.value = updates;
};

onMounted(async () => {
  await ensureContractAddress(false);
  await loadProposals();
  await refreshCandidateStatus();
  await refreshHasVoted();
});

watch(address, async () => {
  await refreshCandidateStatus();
  await refreshHasVoted();
});

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./council-governance-theme.scss";
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap");

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

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
