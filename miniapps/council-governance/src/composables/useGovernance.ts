import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const STATUS_ACTIVE = 1;
const STATUS_EXPIRED = 5;
const CACHE_KEY = "council_proposals_cache";

export interface Proposal {
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

export type VoteChoice = "for" | "against";

const parseProposal = (data: Record<string, unknown>): Proposal => {
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

export const resolveStatus = (proposal: Proposal) => {
  if (proposal.status === STATUS_ACTIVE && proposal.expiryTime < Date.now()) {
    return STATUS_EXPIRED;
  }
  return proposal.status;
};

export function useGovernance(
  showStatus: (msg: string, type: string) => void,
  currentChainId: { value: string },
) {
  const { t } = createUseI18n(messages)();
  const { address, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;

  const contractAddress = ref<string | null>(null);
  const proposals = ref<Proposal[]>([]);
  const selectedProposal = ref<Proposal | null>(null);
  const loadingProposals = ref(false);
  const candidateLoaded = ref(false);
  const isCandidate = ref(false);
  const votingPower = ref(0);
  const hasVotedMap = ref<Record<number, boolean>>({});
  const isVoting = ref(false);

  const activeProposals = computed(() => proposals.value.filter((p) => resolveStatus(p) === STATUS_ACTIVE));
  const historyProposals = computed(() => proposals.value.filter((p) => resolveStatus(p) !== STATUS_ACTIVE));

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

  const ensureContractAddress = async (showMessage = true) => {
    if (!requireNeoChain(chainType, showMessage ? t : undefined, undefined, { silent: !showMessage })) {
      if (showMessage) showStatus(t("wrongChain"), "error");
      return false;
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) {
      if (showMessage) showStatus(t("contractUnavailable"), "error");
      return false;
    }
    return true;
  };

  const readMethod = async (operation: string, args: { type: string; value: unknown }[] = []) => {
    const hasHash = await ensureContractAddress(false);
    if (!hasHash) throw new Error(t("contractUnavailable"));
    const result = await invokeRead({ scriptHash: contractAddress.value as string, operation, args });
    return parseInvokeResult(result);
  };

  const selectProposal = async (p: Proposal) => {
    selectedProposal.value = p;
    if (address.value) await refreshHasVoted([p.id]);
  };

  const castVote = async (proposalId: number, voteType: VoteChoice) => {
    if (isVoting.value) return;
    const proposal = activeProposals.value.find((p) => p.id === proposalId);
    if (!proposal || resolveStatus(proposal) !== STATUS_ACTIVE) return;
    const voter = address.value;
    if (!voter) { showStatus(t("connectWallet"), "error"); return; }
    if (!isCandidate.value) { showStatus(t("notCandidate"), "error"); return; }
    if (hasVotedMap.value[proposalId]) { showStatus(t("alreadyVoted"), "error"); return; }
    const hasHash = await ensureContractAddress();
    if (!hasHash) return;

    try {
      isVoting.value = true;
      await invokeContract({
        scriptHash: contractAddress.value as string,
        operation: "vote",
        args: [
          { type: "Hash160", value: voter },
          { type: "Integer", value: proposalId },
          { type: "Boolean", value: voteType === "for" },
        ],
      });
      showStatus(t("voteRecorded"), "success");
      await loadProposals();
      await refreshHasVoted([proposalId]);
      selectedProposal.value = null;
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isVoting.value = false;
    }
  };

  const createProposal = async (proposalData: {
    type: number;
    title: string;
    description: string;
    policyMethod?: string;
    policyValue?: string;
    duration: number;
  }) => {
    const title = proposalData.title.trim();
    const description = proposalData.description.trim();
    if (!title || !description) { showStatus(t("fillAllFields"), "error"); return false; }

    let policyValueNumber: number | null = null;
    if (proposalData.type === 1) {
      const rawPolicyValue = String(proposalData.policyValue).trim();
      if (!proposalData.policyMethod || !rawPolicyValue) {
        showStatus(t("policyFieldsRequired"), "error"); return false;
      }
      const parsed = Number(rawPolicyValue);
      if (!Number.isFinite(parsed)) { showStatus(t("invalidPolicyValue"), "error"); return false; }
      policyValueNumber = parsed;
    }
    if (!address.value) { showStatus(t("connectWallet"), "error"); return false; }
    if (!isCandidate.value) { showStatus(t("notCandidate"), "error"); return false; }
    const hasHash = await ensureContractAddress();
    if (!hasHash) return false;

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
      await loadProposals();
      return true;
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
      return false;
    }
  };

  const executeProposal = async (proposalId: number) => {
    if (!address.value) { showStatus(t("connectWallet"), "error"); return; }
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
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const loadProposals = async () => {
    const hasHash = await ensureContractAddress();
    if (!hasHash) return;

    try {
      const cached = uni.getStorageSync(CACHE_KEY);
      if (cached) proposals.value = JSON.parse(cached);
    } catch { /* non-critical */ }

    try {
      loadingProposals.value = true;
      const count = Number((await readMethod("getProposalCount")) || 0);
      const results = await Promise.all(
        Array.from({ length: count }, (_, i) => i + 1).map(async (id) => {
          const data = await readMethod("getProposal", [{ type: "Integer", value: id }]);
          return data ? parseProposal(data) : null;
        }),
      );
      proposals.value = (results.filter(Boolean) as Proposal[]).sort((a, b) => b.id - a.id);
      uni.setStorageSync(CACHE_KEY, JSON.stringify(proposals.value));
    } catch (e: unknown) {
      if (proposals.value.length === 0) {
        showStatus(formatErrorMessage(e, t("failedToLoadProposals")), "error");
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
          scriptHash: currentHash,
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

  const init = async () => {
    await ensureContractAddress(false);
    await loadProposals();
    await refreshCandidateStatus();
    await refreshHasVoted();
  };

  return {
    proposals,
    activeProposals,
    historyProposals,
    selectedProposal,
    loadingProposals,
    candidateLoaded,
    isCandidate,
    votingPower,
    hasVotedMap,
    isVoting,
    selectProposal,
    castVote,
    createProposal,
    executeProposal,
    loadProposals,
    refreshCandidateStatus,
    refreshHasVoted,
    init,
  };
}
