/**
 * useGovernance — Domain composable for Council Governance miniapp
 *
 * Migrated to PlatformServices pattern:
 *   - useContractInteraction(hash) -> chain.read() / chain.invoke()
 *   - useWallet() -> chain.ensureWallet() / chain.address
 *   - useStatusMessage() -> eventBus.emit()
 *
 * The API call for council member lookup is preserved as-is since it
 * queries the platform backend, not the blockchain.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";

// ============================================================================
// Constants
// ============================================================================

const STATUS_ACTIVE = 1;
const STATUS_EXPIRED = 5;

// ============================================================================
// Types
// ============================================================================

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

export interface UseGovernanceOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
  currentChainId: { value: string };
}

// ============================================================================
// Helpers
// ============================================================================

const parseProposal = (data: Record<string, unknown>): Proposal => {
  const policyByteString = String(data.policyData || "");
  let policyMethod: string | undefined;
  let policyValue: string | undefined;
  if (policyByteString) {
    try {
      const parsed = JSON.parse(policyByteString);
      policyMethod = parsed.method;
      policyValue = parsed.value;
    } catch (_e) {
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

// ============================================================================
// Composable
// ============================================================================

export function useGovernance({ chain, eventBus, t, currentChainId }: UseGovernanceOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const proposals = ref<Proposal[]>([]);
  const selectedProposal = ref<Proposal | null>(null);
  const loadingProposals = ref(false);
  const candidateLoaded = ref(false);
  const isCandidate = ref(false);
  const votingPower = ref(0);
  const hasVotedMap = ref<Record<number, boolean>>({});
  const isVoting = ref(false);

  // ── Computed ─────────────────────────────────────────────────────────
  const activeProposals = computed(() =>
    proposals.value.filter((p) => resolveStatus(p) === STATUS_ACTIVE),
  );
  const historyProposals = computed(() =>
    proposals.value.filter((p) => resolveStatus(p) !== STATUS_ACTIVE),
  );

  // ── API Base (for council member lookup) ─────────────────────────────
  const getApiBase = () => {
    try {
      if (window.parent !== window) {
        const parentOrigin = document.referrer ? new URL(document.referrer).origin : "";
        if (parentOrigin) return parentOrigin;
      }
    } catch (_e) {
      console.warn("[useGovernance] getApiBase failed:", _e instanceof Error ? _e.message : String(_e));
    }
    return "";
  };
  const API_HOST = getApiBase();

  // ── Contract Read Helper ────────────────────────────────────────────

  const readMethod = async (
    operation: string,
    args: { type: string; value: unknown }[] = [],
  ) => {
    return chain.read(
      operation,
      args as { type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array"; value: string | number | boolean }[],
    );
  };

  // ── Proposal Selection ──────────────────────────────────────────────

  const selectProposal = async (p: Proposal) => {
    selectedProposal.value = p;
    if (chain.address.value) await refreshHasVoted([p.id]);
  };

  // ── Voting ──────────────────────────────────────────────────────────

  const castVote = async (proposalId: number, voteType: VoteChoice) => {
    if (isVoting.value) return;
    const proposal = activeProposals.value.find((p) => p.id === proposalId);
    if (!proposal || resolveStatus(proposal) !== STATUS_ACTIVE) return;
    const voter = chain.address.value;
    if (!voter) {
      eventBus.emit("governance:error", { message: t("connectWallet") });
      return;
    }
    if (!isCandidate.value) {
      eventBus.emit("governance:error", { message: t("notCandidate") });
      return;
    }
    if (hasVotedMap.value[proposalId]) {
      eventBus.emit("governance:error", { message: t("alreadyVoted") });
      return;
    }

    try {
      isVoting.value = true;
      await chain.ensureWallet();
      await chain.invoke("vote", [
        { type: "Hash160", value: voter },
        { type: "Integer", value: proposalId },
        { type: "Boolean", value: voteType === "for" },
      ]);
      eventBus.emit("governance:voted", { action: t("voteRecorded") });
      await loadProposals();
      await refreshHasVoted([proposalId]);
      selectedProposal.value = null;
    } catch (e) {
      eventBus.emit("governance:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
    } finally {
      isVoting.value = false;
    }
  };

  // ── Proposal Creation ───────────────────────────────────────────────

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
    if (!title || !description) {
      eventBus.emit("governance:error", { message: t("fillAllFields") });
      return false;
    }

    let policyValueNumber: number | null = null;
    if (proposalData.type === 1) {
      const rawPolicyValue = String(proposalData.policyValue).trim();
      if (!proposalData.policyMethod || !rawPolicyValue) {
        eventBus.emit("governance:error", { message: t("policyFieldsRequired") });
        return false;
      }
      const parsed = Number(rawPolicyValue);
      if (!Number.isFinite(parsed)) {
        eventBus.emit("governance:error", { message: t("invalidPolicyValue") });
        return false;
      }
      policyValueNumber = parsed;
    }
    if (!chain.address.value) {
      eventBus.emit("governance:error", { message: t("connectWallet") });
      return false;
    }
    if (!isCandidate.value) {
      eventBus.emit("governance:error", { message: t("notCandidate") });
      return false;
    }

    const policyDataS =
      proposalData.type === 1
        ? JSON.stringify({ method: proposalData.policyMethod, value: policyValueNumber })
        : "";

    try {
      await chain.ensureWallet();
      await chain.invoke("createProposal", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: proposalData.type },
        { type: "String", value: title },
        { type: "String", value: description },
        { type: "ByteArray", value: policyDataS },
        { type: "Integer", value: proposalData.duration },
      ]);
      eventBus.emit("governance:proposalCreated", { action: t("proposalSubmitted") });
      await loadProposals();
      return true;
    } catch (e) {
      eventBus.emit("governance:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      return false;
    }
  };

  // ── Proposal Execution ──────────────────────────────────────────────

  const executeProposal = async (proposalId: number) => {
    if (!chain.address.value) {
      eventBus.emit("governance:error", { message: t("connectWallet") });
      return;
    }

    try {
      await chain.ensureWallet();
      await chain.invoke("executeProposal", [
        { type: "Integer", value: proposalId },
      ]);
      eventBus.emit("governance:executed", { action: t("executed") });
      await loadProposals();
      selectedProposal.value = null;
    } catch (e) {
      eventBus.emit("governance:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
    }
  };

  // ── Data Loading ────────────────────────────────────────────────────

  const loadProposals = async () => {
    try {
      loadingProposals.value = true;
      const count = Number((await readMethod("getProposalCount")) || 0);
      const results = await Promise.all(
        Array.from({ length: count }, (_, i) => i + 1).map(async (id) => {
          const data = await readMethod("getProposal", [{ type: "Integer", value: id }]);
          return data ? parseProposal(data as Record<string, unknown>) : null;
        }),
      );
      proposals.value = (results.filter(Boolean) as Proposal[]).sort((a, b) => b.id - a.id);
    } catch (e) {
      if (proposals.value.length === 0) {
        eventBus.emit("governance:error", {
          message: e instanceof Error ? e.message : t("failedToLoadProposals"),
        });
      }
    } finally {
      loadingProposals.value = false;
    }
  };

  const refreshCandidateStatus = async () => {
    if (!chain.address.value) {
      isCandidate.value = false;
      votingPower.value = 0;
      candidateLoaded.value = true;
      return;
    }
    try {
      const res = await uni.request({
        url: `${API_HOST}/api/neo/council-members?chain_id=${currentChainId.value}&address=${chain.address.value}`,
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
    } catch (_e) {
      isCandidate.value = false;
      votingPower.value = 0;
    } finally {
      candidateLoaded.value = true;
    }
  };

  const refreshHasVoted = async (proposalIds?: number[]) => {
    if (!chain.address.value) return;
    const currentAddress = chain.address.value;
    const ids = proposalIds ?? proposals.value.map((p) => p.id);
    const updates: Record<number, boolean> = { ...hasVotedMap.value };
    await Promise.all(
      ids.map(async (id) => {
        updates[id] = Boolean(
          await chain.read("hasVoted", [
            { type: "Hash160", value: currentAddress },
            { type: "Integer", value: id },
          ]),
        );
      }),
    );
    hasVotedMap.value = updates;
  };

  // ── Lifecycle ───────────────────────────────────────────────────────

  const init = async () => {
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

export type UseGovernanceReturn = ReturnType<typeof useGovernance>;
