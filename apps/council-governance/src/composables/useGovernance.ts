import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, ContractArg, TxResult } from "@shared/services";
import { MINIAPP_CONTRACTS } from "@shared/constants/rpc";
import { parseInvokeResult } from "@shared/utils/neo";
import { getHostOrigin } from "@shared/utils/runtime-origin";

const APP_ID = "miniapp-council-governance";

const STATUS_ACTIVE = 1;
const STATUS_PASSED = 2;
const STATUS_REJECTED = 3;
const STATUS_REVOKED = 4;
const STATUS_EXPIRED = 5;
const STATUS_EXECUTED = 6;

export type ProposalStatusKey =
  | "active"
  | "passed"
  | "rejected"
  | "revoked"
  | "expired"
  | "executed"
  | "pending";

export interface Proposal {
  id: number;
  type: number;
  title: string;
  description: string;
  policyMethod?: string;
  policyValue?: string;
  creator: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  quorumRequired: number;
  quorumReached: boolean;
  createTime: number;
  expiryTime: number;
  status: number;
  statusKey: ProposalStatusKey;
  statusString?: string;
}

export type VoteChoice = "for" | "against";

export interface UseGovernanceOptions {
  chainService: ChainService;
  t: (key: string, params?: Record<string, string | number>) => string;
  currentChainId: Observable<string>;
}

type NeoNetwork = "mainnet" | "testnet";

function resolveNetwork(chainId: string): NeoNetwork {
  return chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet";
}

function contractHashFor(chainId: string): string | undefined {
  return MINIAPP_CONTRACTS[resolveNetwork(chainId)]?.[APP_ID];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function asString(value: unknown, fallback = ""): string {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function toMsTimestamp(value: unknown): number {
  const n = asNumber(value, 0);
  if (n <= 0) return 0;
  return n < 10_000_000_000 ? n * 1000 : n;
}

function toBase64Utf8(value: string): string {
  if (!value) return "";
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeMaybeBase64(value: unknown): string {
  const text = asString(value);
  if (!text) return "";
  if (text.startsWith("0x")) return text;
  try {
    const decoded = atob(text);
    if (/^[\x09\x0a\x0d\x20-\x7e]*$/.test(decoded)) return decoded;
  } catch {
    /* not base64 */
  }
  return text;
}

function statusKeyFor(status: number, statusString: string | undefined, expiryTime: number): ProposalStatusKey {
  const normalized = String(statusString || "").toLowerCase();
  if (normalized.includes("executed")) return "executed";
  if (normalized.includes("revoked")) return "revoked";
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("pass")) return "passed";
  if (normalized.includes("expire")) return "expired";
  if (status === STATUS_ACTIVE) return expiryTime > 0 && expiryTime < Date.now() ? "expired" : "active";
  if (status === STATUS_PASSED) return "passed";
  if (status === STATUS_REJECTED) return "rejected";
  if (status === STATUS_REVOKED) return "revoked";
  if (status === STATUS_EXPIRED) return "expired";
  if (status === STATUS_EXECUTED) return "executed";
  return "pending";
}

function parsePolicyData(raw: unknown): Pick<Proposal, "policyMethod" | "policyValue"> {
  const text = decodeMaybeBase64(raw);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as { method?: unknown; value?: unknown };
    const method = asString(parsed.method);
    return {
      policyMethod: method || undefined,
      policyValue: parsed.value === undefined ? undefined : String(parsed.value),
    };
  } catch {
    return { policyValue: text };
  }
}

function parseProposal(raw: unknown): Proposal | null {
  const data = asRecord(raw);
  const id = asNumber(data.id, 0);
  if (!id) return null;

  const status = asNumber(data.status, 0);
  const statusString = asString(data.statusString);
  const expiryTime = toMsTimestamp(data.expiryTime);
  const policy = parsePolicyData(data.policyData);

  return {
    id,
    type: asNumber(data.type, 0),
    title: asString(data.title, `Proposal #${id}`),
    description: asString(data.description),
    creator: asString(data.creator),
    ...policy,
    yesVotes: asNumber(data.yesVotes, 0),
    noVotes: asNumber(data.noVotes, 0),
    totalVotes: asNumber(data.totalVotes, asNumber(data.yesVotes, 0) + asNumber(data.noVotes, 0)),
    quorumRequired: asNumber(data.quorumRequired, 0),
    quorumReached: asBoolean(data.quorumReached),
    createTime: toMsTimestamp(data.createTime),
    expiryTime,
    status,
    statusKey: statusKeyFor(status, statusString, expiryTime),
    statusString,
  };
}

export const resolveStatus = (proposal: Proposal) => proposal.statusKey;

export function useGovernance({
  chainService,
  t,
  currentChainId,
}: UseGovernanceOptions) {
  const proposals = createObservable<Proposal[]>([]);
  const selectedProposal = createObservable<Proposal | null>(null);
  const loadingProposals = createObservable(false);
  const candidateLoaded = createObservable(false);
  const isCandidate = createObservable(false);
  const votingPower = createObservable(0);
  const hasVotedMap = createObservable<Record<number, boolean>>({});
  const isVoting = createObservable(false);
  const address = createObservable("");
  const lastTx = createObservable<TxResult | null>(null);

  const activeProposals = createDerived(
    () => proposals.get().filter((p) => p.statusKey === "active"),
    [proposals],
  );
  const historyProposals = createDerived(
    () => proposals.get().filter((p) => p.statusKey !== "active"),
    [proposals],
  );
  const activeCount = createDerived(() => activeProposals.get().length, [proposals]);
  const historyCount = createDerived(() => historyProposals.get().length, [proposals]);

  const hostOrigin = getHostOrigin();
  const currentOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const API_HOST = hostOrigin && hostOrigin !== currentOrigin ? hostOrigin : "";

  async function readContract(method: string, args: ContractArg[] = []): Promise<unknown> {
    const scriptHash = contractHashFor(currentChainId.get());
    try {
      return await chainService.read(method, args, scriptHash ? { scriptHash } : undefined);
    } catch (walletReadError) {
      if (!scriptHash) throw walletReadError;
      const res = await fetch(`${API_HOST}/api/rpc/neo-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractHash: scriptHash,
          method,
          params: args.map((arg) => ({ type: arg.type, value: String(arg.value) })),
          network: resolveNetwork(currentChainId.get()),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      if (!res.ok || data?.result?.state !== "HALT") {
        throw walletReadError;
      }
      return parseInvokeResult({ stack: data.result.stack || [] });
    }
  }

  async function invokeContract(method: string, args: ContractArg[]): Promise<TxResult> {
    const scriptHash = contractHashFor(currentChainId.get());
    const tx = await chainService.invoke(method, args, scriptHash ? { scriptHash } : undefined);
    lastTx.set(tx);
    return tx;
  }

  const selectProposal = async (p: Proposal) => {
    selectedProposal.set(p);
    if (address.get()) await refreshHasVoted([p.id]);
  };

  const castVote = async (proposalId: number, voteType: VoteChoice) => {
    if (isVoting.get()) return;
    const proposal = activeProposals.get().find((p) => p.id === proposalId);
    if (!proposal) throw new Error(t("proposalNotActive"));
    if (!address.get()) throw new Error(t("connectWallet"));
    if (!isCandidate.get()) throw new Error(t("notCandidate"));
    if (hasVotedMap.get()[proposalId]) throw new Error(t("alreadyVoted"));

    try {
      isVoting.set(true);
      await invokeContract("vote", [
        { type: "Hash160", value: address.get() },
        { type: "Integer", value: String(proposalId) },
        { type: "Boolean", value: voteType === "for" },
      ]);
      await loadProposals();
      await refreshHasVoted([proposalId]);
    } finally {
      isVoting.set(false);
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
    if (!title || !description) throw new Error(t("fillAllFields"));
    if (!address.get()) throw new Error(t("connectWalletCreate"));
    if (!isCandidate.get()) throw new Error(t("notCandidateCreate"));

    let policyData = "";
    if (proposalData.type === 1) {
      const policyMethod = String(proposalData.policyMethod || "").trim();
      const policyValue = String(proposalData.policyValue || "").trim();
      if (!policyMethod || !policyValue) throw new Error(t("policyFieldsRequired"));
      const parsedValue = Number(policyValue);
      if (!Number.isFinite(parsedValue)) throw new Error(t("invalidPolicyValue"));
      policyData = toBase64Utf8(JSON.stringify({ method: policyMethod, value: parsedValue }));
    }

    const duration = proposalData.duration > 0 ? proposalData.duration : 7 * 24 * 60 * 60 * 1000;
    const tx = await invokeContract("createProposal", [
      { type: "Hash160", value: address.get() },
      { type: "Integer", value: String(proposalData.type || 0) },
      { type: "String", value: title },
      { type: "String", value: description },
      { type: "ByteArray", value: policyData },
      { type: "Integer", value: String(duration) },
    ]);
    await loadProposals();
    return tx;
  };

  const finalizeProposal = async (proposalId: number) => {
    if (!proposalId) return null;
    const tx = await invokeContract("finalizeProposal", [
      { type: "Integer", value: String(proposalId) },
    ]);
    await loadProposals();
    return tx;
  };

  const loadProposals = async () => {
    try {
      loadingProposals.set(true);
      const count = asNumber(await readContract("getProposalCount"), 0);
      if (count <= 0) {
        proposals.set([]);
        return;
      }

      const limit = Math.min(count, 100);
      const first = Math.max(1, count - limit + 1);
      const reads: Array<Promise<Proposal | null>> = [];
      for (let id = count; id >= first; id -= 1) {
        reads.push(
          readContract("getProposalDetails", [{ type: "Integer", value: String(id) }])
            .then(parseProposal)
            .catch(() => null),
        );
      }
      const loaded = (await Promise.all(reads)).filter((p): p is Proposal => Boolean(p));
      proposals.set(loaded.sort((a, b) => b.id - a.id));
    } catch (e) {
      if (proposals.get().length === 0) {
        console.warn("[useGovernance] loadProposals failed:", e instanceof Error ? e.message : String(e));
      }
    } finally {
      loadingProposals.set(false);
    }
  };

  const refreshCandidateStatus = async () => {
    const walletAddress = address.get();
    if (!walletAddress) {
      isCandidate.set(false);
      votingPower.set(0);
      candidateLoaded.set(true);
      return;
    }

    try {
      const result = await readContract("isCandidate", [
        { type: "Hash160", value: walletAddress },
      ]);
      const eligible = asBoolean(result);
      isCandidate.set(eligible);
      votingPower.set(eligible ? 1 : 0);
    } catch {
      isCandidate.set(false);
      votingPower.set(0);
    } finally {
      candidateLoaded.set(true);
    }
  };

  const refreshHasVoted = async (proposalIds?: number[]) => {
    const walletAddress = address.get();
    if (!walletAddress) {
      hasVotedMap.set({});
      return;
    }
    const ids = proposalIds ?? activeProposals.get().map((p) => p.id);
    const updates: Record<number, boolean> = { ...hasVotedMap.get() };
    await Promise.all(
      ids.map(async (id) => {
        try {
          updates[id] = asBoolean(
            await readContract("hasVoted", [
              { type: "Hash160", value: walletAddress },
              { type: "Integer", value: String(id) },
            ]),
          );
        } catch {
          updates[id] = false;
        }
      }),
    );
    hasVotedMap.set(updates);
  };

  const init = async () => {
    await loadProposals();
    await refreshCandidateStatus();
    await refreshHasVoted();
  };

  const setAddress = (addr: string) => {
    address.set(addr);
  };

  return {
    proposals,
    activeProposals,
    historyProposals,
    activeCount,
    historyCount,
    selectedProposal,
    loadingProposals,
    candidateLoaded,
    isCandidate,
    votingPower,
    hasVotedMap,
    isVoting,
    address,
    lastTx,
    selectProposal,
    castVote,
    createProposal,
    executeProposal: finalizeProposal,
    finalizeProposal,
    loadProposals,
    refreshCandidateStatus,
    refreshHasVoted,
    setAddress,
    init,
  };
}

export type UseGovernanceReturn = ReturnType<typeof useGovernance>;
