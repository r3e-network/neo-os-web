import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, ContractArg, TxResult } from "@shared/services";
import { MINIAPP_CONTRACTS } from "@shared/constants/rpc";
import { parseInvokeResult, parseHash160, ownerMatchesAddress } from "@shared/utils/neo";
import { getHostOrigin } from "@shared/utils/runtime-origin";

const APP_ID = "miniapp-council-governance";

const STATUS_ACTIVE = 1;
const STATUS_PASSED = 2;
const STATUS_REJECTED = 3;
const STATUS_REVOKED = 4;
const STATUS_EXPIRED = 5;
const STATUS_EXECUTED = 6;
const EXPLORER_CACHE_MS = 15_000;

const explorerGovernanceCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<unknown>;
  }
>();

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
  externalId?: string;
  source?: "contract" | "neo-community";
  type: number;
  title: string;
  description: string;
  policyMethod?: string;
  policyValue?: string;
  /** Raw creator value as read from the contract/mirror (used for matching). */
  creator: string;
  /** Display-order 0x hash (or mirror name) for the creator — explorer form. */
  creatorDisplay: string;
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
  if (normalized.includes("replace")) return "revoked";
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

  // getProposalDetails returns creator as a Hash160 ByteString in chain (LE)
  // byte order — convert to the display-order 0x hash explorers accept so the
  // contract rows don't show an unrecognizable little-endian hash next to the
  // human names of mirror proposals.
  const creatorRaw = asString(data.creator);
  const creatorDisplay = parseHash160(data.creator) || creatorRaw;

  return {
    id,
    source: "contract",
    type: asNumber(data.type, 0),
    title: asString(data.title, `Proposal #${id}`),
    description: asString(data.description),
    creator: creatorRaw,
    creatorDisplay,
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

function parseIsoTimestamp(value: unknown): number {
  const text = asString(value);
  if (!text) return 0;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseVoteBucket(value: unknown): { for: number; against: number; neutral: number } {
  const data = asRecord(value);
  return {
    for: asNumber(data.for, 0),
    against: asNumber(data.against, 0),
    neutral: asNumber(data.neutral, 0),
  };
}

function parseExplorerProposal(raw: unknown): Proposal | null {
  const data = asRecord(raw);
  const number = asNumber(data.number, 0);
  const externalId = asString(data.id);
  if (!number && !externalId) return null;
  const councilVotes = parseVoteBucket(data.councilVotes);
  const communityVotes = parseVoteBucket(data.communityVotes);
  const yesVotes = councilVotes.for + communityVotes.for;
  const noVotes = councilVotes.against + communityVotes.against;
  const neutralVotes = councilVotes.neutral + communityVotes.neutral;
  const statusString = asString(data.status, "active");
  const expiryTime = parseIsoTimestamp(data.endTime);

  // Namespace neo-community ids into the NEGATIVE space so they can never
  // collide with a real contract proposal id (positive) when both sources are
  // merged on mainnet — a synthetic char-code sum could otherwise equal a real
  // contract id and mislabel it (e.g. in hasVotedMap / React keys).
  const syntheticId =
    number || Math.abs(externalId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0));
  return {
    id: -Math.abs(syntheticId || 1),
    externalId,
    source: "neo-community",
    type: asString(data.type).includes("policy") ? 1 : 0,
    title: asString(data.title, externalId ? `Proposal ${externalId}` : `Proposal #${number}`),
    description: asString(data.summary, asString(data.description, "")),
    creator: asString(data.proposerName, asString(data.proposerOrganizationId, "neo.community")),
    creatorDisplay: asString(data.proposerName, asString(data.proposerOrganizationId, "neo.community")),
    yesVotes,
    noVotes,
    totalVotes: yesVotes + noVotes + neutralVotes,
    quorumRequired: 21,
    quorumReached: councilVotes.for + councilVotes.against + councilVotes.neutral >= 11,
    createTime: parseIsoTimestamp(data.createdAt),
    expiryTime,
    status: STATUS_ACTIVE,
    statusKey: statusKeyFor(STATUS_ACTIVE, statusString, 0),
    statusString,
  };
}

function fetchExplorerGovernanceData(url: string): Promise<unknown> {
  const now = Date.now();
  const cached = explorerGovernanceCache.get(url);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetch(url, {
    signal: AbortSignal.timeout(10_000),
  })
    .then(async (res) => {
      const data = await res.json();
      return res.ok ? data : null;
    })
    .catch((error) => {
      explorerGovernanceCache.delete(url);
      throw error;
    });

  explorerGovernanceCache.set(url, {
    expiresAt: now + EXPLORER_CACHE_MS,
    promise,
  });
  return promise;
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
    if (proposal.source === "neo-community") throw new Error(t("externalProposalReadOnly"));
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
      // Neo native PolicyContract parameters (FeePerByte, ExecFeeFactor,
      // StoragePrice, MaxBlockSize, MaxTransactionsPerBlock, MaxSystemFee) are
      // non-negative integers. Reject floats / scientific / hex / whitespace so
      // an obviously-invalid value never reaches the invoke and pays gas to fail.
      if (!/^\d+$/.test(policyValue)) throw new Error(t("invalidPolicyValue"));
      const parsedValue = Number(policyValue);
      if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new Error(t("invalidPolicyValue"));
      }
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

  /**
   * Execute a finalized, passed policy proposal — applies the proposal's
   * PolicyContract change. This is a DISTINCT contract method from
   * finalizeProposal (the previous code aliased the two, so the on-chain policy
   * effect could never be triggered from the app). Contract-sourced proposals
   * only — neo.community mirror entries have no executable on-chain action.
   */
  const executeProposal = async (proposalId: number) => {
    if (!proposalId || proposalId <= 0) return null;
    const tx = await invokeContract("executeProposal", [
      { type: "Integer", value: String(proposalId) },
    ]);
    await loadProposals();
    return tx;
  };

  /**
   * Revoke (withdraw) an own proposal before it resolves. Gated to the creator
   * + contract source in the UI; the contract additionally enforces the creator
   * witness. Gives a candidate an exit for a mistaken proposal.
   */
  const revokeProposal = async (proposalId: number) => {
    if (!proposalId || proposalId <= 0) return null;
    if (!address.get()) throw new Error(t("connectWallet"));
    const tx = await invokeContract("revokeProposal", [
      { type: "Hash160", value: address.get() },
      { type: "Integer", value: String(proposalId) },
    ]);
    await loadProposals();
    return tx;
  };

  /**
   * Merge contract-sourced and explorer-sourced proposals into one list:
   * contract entries first (they are the actionable on-chain ones), then the
   * neo.community mirror as enrichment. Deduped by source+id so the same
   * identity never appears twice, and sorted newest-first within each source.
   */
  const mergeProposals = (contract: Proposal[], explorer: Proposal[]): Proposal[] => {
    const seen = new Set<string>();
    const result: Proposal[] = [];
    const push = (list: Proposal[]) => {
      for (const proposal of [...list].sort((a, b) => b.id - a.id)) {
        const key = `${proposal.source ?? "contract"}:${proposal.externalId ?? proposal.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(proposal);
      }
    };
    push(contract);
    push(explorer);
    return result;
  };

  /** Read the on-chain proposals (newest 100), or [] when none / unavailable. */
  const loadContractProposals = async (): Promise<Proposal[]> => {
    const count = asNumber(await readContract("getProposalCount"), 0);
    if (count <= 0) return [];
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
    return (await Promise.all(reads)).filter((p): p is Proposal => Boolean(p));
  };

  const loadProposals = async () => {
    try {
      loadingProposals.set(true);
      const isMainnet = resolveNetwork(currentChainId.get()) === "mainnet";

      // On mainnet the neo.community mirror is enrichment, NOT a replacement —
      // read the on-chain proposals too and MERGE, so a freshly-created/voted
      // contract proposal actually appears (the previous explorer-first
      // short-circuit hid every contract proposal on the default network).
      if (isMainnet) {
        const [contract, explorer] = await Promise.all([
          loadContractProposals().catch(() => [] as Proposal[]),
          fetchExplorerProposals().catch(() => [] as Proposal[]),
        ]);
        const merged = mergeProposals(contract, explorer);
        if (merged.length > 0) {
          proposals.set(merged);
          return;
        }
      }

      const contract = await loadContractProposals();
      if (contract.length > 0) {
        proposals.set(mergeProposals(contract, []));
        return;
      }
      // No contract proposals (e.g. testnet empty / read failed): fall back to
      // the mirror alone so the browse view is not blank.
      const explorer = await fetchExplorerProposals();
      proposals.set(mergeProposals([], explorer));
    } catch (e) {
      const explorer = await fetchExplorerProposals().catch(() => [] as Proposal[]);
      if (explorer.length > 0) {
        proposals.set(mergeProposals([], explorer));
      } else if (proposals.get().length === 0) {
        console.warn("[useGovernance] loadProposals failed:", e instanceof Error ? e.message : String(e));
      }
    } finally {
      loadingProposals.set(false);
    }
  };

  /** Fetch + parse the neo.community mirror into proposals, or [] on failure. */
  const fetchExplorerProposals = async (): Promise<Proposal[]> => {
    try {
      const data = await fetchExplorerGovernanceData(
        `${API_HOST}/api/explorer/council-governance?network=${resolveNetwork(currentChainId.get())}`,
      );
      const governance = data as { proposals?: unknown };
      if (!Array.isArray(governance.proposals)) return [];
      return governance.proposals
        .map(parseExplorerProposal)
        .filter((proposal: Proposal | null): proposal is Proposal => Boolean(proposal));
    } catch {
      return [];
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
    // Only contract-sourced proposals have an on-chain hasVoted record; skip
    // neo-community mirror entries (negative synthetic ids) so we don't waste
    // RPC round-trips or risk a synthetic id mislabeling a real one.
    const ids =
      proposalIds ??
      activeProposals
        .get()
        .filter((p) => p.source !== "neo-community" && p.id > 0)
        .map((p) => p.id);
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
    executeProposal,
    revokeProposal,
    finalizeProposal,
    loadProposals,
    refreshCandidateStatus,
    refreshHasVoted,
    setAddress,
    init,
  };
}

export type UseGovernanceReturn = ReturnType<typeof useGovernance>;
