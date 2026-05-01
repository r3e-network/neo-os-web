/**
 * useGovernance — Domain composable for Council Governance miniapp (OS Services)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (StorageProxy, PaymentProxy, BadgeProxy) via edge functions,
 * so this file contains zero contract hashes, parameter encoding, or
 * event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getProposalCount")
 *     chain.read("getProposal", [...])
 *     chain.read("hasVoted", [...])
 *     chain.invoke("createProposal", [...])
 *     chain.invoke("vote", [...])
 *     chain.invoke("executeProposal", [...])
 *
 *   AFTER (OS proxy):
 *     storageService.get("proposalCount")              — load proposal count
 *     storageService.get(`proposal:${id}`)             — load proposal details
 *     storageService.get(`voted:${address}:${id}`)     — check vote status
 *     storageService.list("proposal:")                 — list all proposals
 *     paymentService.deposit(amount, memo)             — deposit for proposal creation
 *     badgeService.award(badgeId, user)                — award governance badges
 *
 * The API call for council member lookup is preserved as-is since it
 * queries the platform backend, not the blockchain.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { getParentOrigin } from "@shared/utils/iframe";

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
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Current chain ID for API calls */
  currentChainId: Observable<string>;
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
      policyValue = parsed.get();
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

export function useGovernance({
  storageService,
  paymentService,
  badgeService,
  t,
  currentChainId,
}: UseGovernanceOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const proposals = createObservable<Proposal[]>([]);
  const selectedProposal = createObservable<Proposal | null>(null);
  const loadingProposals = createObservable(false);
  const candidateLoaded = createObservable(false);
  const isCandidate = createObservable(false);
  const votingPower = createObservable(0);
  const hasVotedMap = createObservable<Record<number, boolean>>({});
  const isVoting = createObservable(false);
  const address = createObservable("");

  // ── Computed ─────────────────────────────────────────────────────────
  const activeProposals = createDerived(
    () => proposals.get().filter((p) => resolveStatus(p) === STATUS_ACTIVE),
    [proposals],
  );
  const historyProposals = createDerived(
    () => proposals.get().filter((p) => resolveStatus(p) !== STATUS_ACTIVE),
    [proposals],
  );

  // ── API Base (for council member lookup) ─────────────────────────────
  const parentOrigin = getParentOrigin();
  const API_HOST = parentOrigin !== window.location.origin ? parentOrigin : "";

  // ── Proposal Selection ──────────────────────────────────────────────

  const selectProposal = async (p: Proposal) => {
    selectedProposal.set(p);
    if (address.get()) await refreshHasVoted([p.id]);
  };

  // ── Voting (via OS services) ────────────────────────────────────────

  const castVote = async (proposalId: number, voteType: VoteChoice) => {
    if (isVoting.get()) return;
    const proposal = activeProposals.get().find((p) => p.id === proposalId);
    if (!proposal || resolveStatus(proposal) !== STATUS_ACTIVE) return;
    if (!address.get()) {
      throw new Error(t("connectWallet"));
    }
    if (!isCandidate.get()) {
      throw new Error(t("notCandidate"));
    }
    if (hasVotedMap.get()[proposalId]) {
      throw new Error(t("alreadyVoted"));
    }

    try {
      isVoting.set(true);

      // Vote via StorageProxy — the edge function handles the contract invocation
      await storageService.set(`vote:${proposalId}`, {
        voter: address.get(),
        proposalId,
        voteFor: voteType === "for",
      });

      // Award governance badge (fire-and-forget)
      badgeService.award("governance-voter", address.get()).catch(() => {});

      await loadProposals();
      await refreshHasVoted([proposalId]);
      selectedProposal.set(null);
    } catch (e) {
      throw e;
    } finally {
      isVoting.set(false);
    }
  };

  // ── Proposal Creation (via OS services) ─────────────────────────────

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
      throw new Error(t("fillAllFields"));
    }

    let policyValueNumber: number | null = null;
    if (proposalData.type === 1) {
      const rawPolicyValue = String(proposalData.policyValue).trim();
      if (!proposalData.policyMethod || !rawPolicyValue) {
        throw new Error(t("policyFieldsRequired"));
      }
      const parsed = Number(rawPolicyValue);
      if (!Number.isFinite(parsed)) {
        throw new Error(t("invalidPolicyValue"));
      }
      policyValueNumber = parsed;
    }
    if (!address.get()) {
      throw new Error(t("connectWallet"));
    }
    if (!isCandidate.get()) {
      throw new Error(t("notCandidate"));
    }

    const policyDataS =
      proposalData.type === 1
        ? JSON.stringify({ method: proposalData.policyMethod, value: policyValueNumber })
        : "";

    try {
      // Create proposal via StorageProxy — the edge function handles
      // the createProposal contract invocation
      await storageService.set("proposal:new", {
        creator: address.get(),
        type: proposalData.type,
        title,
        description,
        policyData: policyDataS,
        duration: proposalData.duration,
      });

      // Award proposal-creator badge (fire-and-forget)
      badgeService.award("proposal-creator", address.get()).catch(() => {});

      await loadProposals();
      return true;
    } catch (e) {
      throw e;
    }
  };

  // ── Proposal Execution (via OS services) ────────────────────────────

  const executeProposal = async (proposalId: number) => {
    if (!address.get()) {
      throw new Error(t("connectWallet"));
    }

    try {
      // Execute proposal via StorageProxy — the edge function handles
      // the executeProposal contract invocation
      await storageService.set(`proposal:execute:${proposalId}`, {
        executor: address.get(),
        proposalId,
      });

      await loadProposals();
      selectedProposal.set(null);
    } catch (e) {
      throw e;
    }
  };

  // ── Data Loading (via OS services) ──────────────────────────────────

  /**
   * Load all proposals via StorageProxy.
   * The edge function reads proposal count and details from the contract.
   */
  const loadProposals = async () => {
    try {
      loadingProposals.set(true);

      const raw = await storageService.list("proposal:");
      if (raw && typeof raw === "object") {
        const results: Proposal[] = [];
        for (const [, value] of Object.entries(raw)) {
          if (value && typeof value === "object") {
            const proposal = parseProposal(value as Record<string, unknown>);
            if (proposal.id > 0) {
              results.push(proposal);
            }
          }
        }
        proposals.set(results.sort((a, b) => b.id - a.id));
      }
    } catch (e) {
      if (proposals.get().length === 0) {
        console.warn("[useGovernance] loadProposals failed:", e instanceof Error ? e.message : String(e));
      }
    } finally {
      loadingProposals.set(false);
    }
  };

  const refreshCandidateStatus = async () => {
    if (!address.get()) {
      isCandidate.set(false);
      votingPower.set(0);
      candidateLoaded.set(true);
      return;
    }
    try {
      const res = await fetch(
        `${API_HOST}/api/neo/council-members?chain_id=${currentChainId.get()}&address=${address.get()}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { isCouncilMember?: boolean; chainId: string };
        isCandidate.set(Boolean(data.isCouncilMember));
        votingPower.set(isCandidate.get() ? 1 : 0);
      } else {
        isCandidate.set(false);
        votingPower.set(0);
      }
    } catch (_e) {
      isCandidate.set(false);
      votingPower.set(0);
    } finally {
      candidateLoaded.set(true);
    }
  };

  /**
   * Check vote status via StorageProxy.
   * The edge function reads hasVoted from the contract.
   */
  const refreshHasVoted = async (proposalIds?: number[]) => {
    if (!address.get()) return;
    const ids = proposalIds ?? proposals.get().map((p) => p.id);
    const updates: Record<number, boolean> = { ...hasVotedMap.get() };
    await Promise.all(
      ids.map(async (id) => {
        try {
          const result = await storageService.get(`voted:${address.get()}:${id}`);
          updates[id] = Boolean(result);
        } catch {
          updates[id] = false;
        }
      }),
    );
    hasVotedMap.set(updates);
  };

  // ── Lifecycle ───────────────────────────────────────────────────────

  const init = async () => {
    await loadProposals();
    await refreshCandidateStatus();
    await refreshHasVoted();
  };

  /**
   * Set the wallet address. Called from main.ts to track the
   * connected wallet address from the platform's chain service.
   */
  const setAddress = (addr: string) => {
    address.set(addr);
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
    address,
    selectProposal,
    castVote,
    createProposal,
    executeProposal,
    loadProposals,
    refreshCandidateStatus,
    refreshHasVoted,
    setAddress,
    init,
  };
}

export type UseGovernanceReturn = ReturnType<typeof useGovernance>;
