import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import type { GovernanceCandidate } from "../utils";
import { useCandidateData } from "./useCandidateData";
import { useVoting } from "./useVoting";

export function useCandidateVotePage(t: (key: string) => string) {
  const wallet = useWallet() as WalletSDK;
  const { address, chainId, appChainId } = wallet;

  const preferredChainId = computed(() => appChainId.value || chainId.value || "neo-n3-testnet");

  const governancePortalUrl = computed(() =>
    preferredChainId.value === "neo-n3-testnet"
      ? "https://governance.neo.org/testnet#/"
      : "https://governance.neo.org/#/"
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

  // Handlers
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

  const resetAndReload = async () => {
    await Promise.all([loadCandidates(), loadUserVote()]);
  };

  // Lifecycle
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

  return {
    // Wallet
    address,
    // Candidate data
    candidates,
    totalNetworkVotes,
    blockHeight,
    candidatesLoading,
    formatVotes,
    normalizePublicKey,
    // Voting
    isLoading,
    status,
    normalizedUserVotedPublicKey,
    // Selection & modal
    selectedCandidate,
    showDetailModal,
    detailCandidate,
    detailRank,
    governancePortalUrl,
    // Computed
    appState,
    // Handlers
    selectCandidate,
    openCandidateDetail,
    closeCandidateDetail,
    onVote,
    handleVoteFromModal,
    resetAndReload,
  };
}
