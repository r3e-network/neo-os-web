import { createDerived, createObservable, createReadCell } from "@shared/react/context";
import type { Observable, ReadCell } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { FrameworkContractArg, FrameworkTxResult } from "@framework/index";
import { MINIAPP_CONTRACTS } from "@shared/constants/rpc";
import { parseInvokeResult, parseHash160, ownerMatchesAddress } from "@shared/utils/neo";
import { getHostOrigin } from "@shared/utils/runtime-origin";
import {
  GOVERNANCE_EVENTS,
  clearPendingGovernanceOperation,
  governanceEventTxid,
  governancePendingMatchesScope,
  readPendingGovernanceOperation,
  savePendingGovernanceOperation,
  type GovernanceOperation,
  type PendingGovernanceOperation,
} from "../governance-operation";

const APP_ID = "miniapp-council-governance";
const NEO_NATIVE_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const MAX_PROPOSALS = 100;
const MAX_COUNCIL_CANDIDATES = 256;
const CONTRACT_READ_CONCURRENCY = 8;
const RECOVERY_EVENT_PAGE_SIZE = 100;
const RECOVERY_EVENT_MAX_PAGES = 5;
const OVERVIEW_MAX_AGE_MS = 15_000;
const TXID_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const POLICY_METHODS = new Set([
  "setFeePerByte",
  "setExecFeeFactor",
  "setStoragePrice",
  "setMaxBlockSize",
  "setMaxTransactionsPerBlock",
  "setMaxSystemFee",
]);

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

type NeoNetwork = "mainnet" | "testnet";

export interface GovernanceOverview {
  loaded: boolean;
  verifiedAt: number;
  network: NeoNetwork | null;
  contract: string;
  paused: boolean | null;
  committeeSize: number;
  quorumPercent: number;
  thresholdPercent: number;
  minDurationMs: number;
  maxDurationMs: number;
  totalProposals: number;
  totalVotes: number;
  passedProposals: number;
  totalMembers: number;
}

export interface CouncilCandidate {
  publicKey: string;
  votes: number;
  rank: number;
  isCommittee: boolean;
}

export interface GovernanceConfirmation {
  operation: GovernanceOperation;
  txid: string;
  proposalId: number;
  confirmedAt: number;
}

export interface UseGovernanceOptions {
  /** MiniApp framework (ctx.framework); its chain layer drives every read/write. */
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  currentChainId: Observable<string>;
}

function resolveNetwork(chainId: string): NeoNetwork | null {
  const normalized = chainId.trim().toLowerCase();
  if (normalized.includes("testnet")) return "testnet";
  if (normalized.includes("mainnet")) return "mainnet";
  return null;
}

function contractHashFor(chainId: string): string | undefined {
  const network = resolveNetwork(chainId);
  return network ? MINIAPP_CONTRACTS[network]?.[APP_ID] : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asSafeInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function asCount(value: unknown, fallback = 0): number {
  const parsed = asSafeInteger(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

function asPositiveInteger(value: unknown): number {
  const parsed = asSafeInteger(value, 0);
  return parsed > 0 ? parsed : 0;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function asStrictBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function asString(value: unknown, fallback = ""): string {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function asBoundedString(value: unknown, fallback: string, maxLength: number): string {
  const text = asString(value, fallback);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function toMsTimestamp(value: unknown): number {
  const n = asSafeInteger(value, 0);
  if (n <= 0) return 0;
  const normalized = n < 10_000_000_000 ? n * 1000 : n;
  return Number.isSafeInteger(normalized) ? normalized : 0;
}

function stableExternalId(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

function normalizePublicKey(value: unknown): string {
  const source = asString(value);
  const raw = source.toLowerCase();
  if (/^0x(?:02|03)[0-9a-f]{64}$/.test(raw)) return raw;
  if (/^(?:02|03)[0-9a-f]{64}$/.test(raw)) return `0x${raw}`;
  try {
    const bytes = Uint8Array.from(atob(source), (char) => char.charCodeAt(0));
    if (bytes.length !== 33 || (bytes[0] !== 2 && bytes[0] !== 3)) return "";
    return `0x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "";
  }
}

function fixed8Display(raw: bigint): string {
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

function emptyOverview(): GovernanceOverview {
  return {
    loaded: false,
    verifiedAt: 0,
    network: null,
    contract: "",
    paused: null,
    committeeSize: 0,
    quorumPercent: 0,
    thresholdPercent: 0,
    minDurationMs: 0,
    maxDurationMs: 0,
    totalProposals: 0,
    totalVotes: 0,
    passedProposals: 0,
    totalMembers: 0,
  };
}

/**
 * Stable unread sentinel: what `governanceOverview` renders while the rules
 * cell has never published for the current network. One identity so the
 * derived's get() stays stable across re-reads of the unread state.
 */
const UNREAD_OVERVIEW: GovernanceOverview = emptyOverview();

/**
 * A governance-rules load that failed resolving the chain scope — before the
 * contract read ever began. Carries the original error because this path
 * surfaces its own message (network/contract unavailable) while contract-read
 * failures collapse to governanceRulesUnavailable.
 */
class GovernanceScopeError extends Error {
  readonly original: unknown;

  constructor(original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    this.name = "GovernanceScopeError";
    this.original = original;
  }
}

/** One settled wallet-balances read: the values plus the read's verdict. */
interface WalletBalancesSnapshot {
  /** Raw NEO units as text; "" until a read has succeeded. */
  neo: string;
  /** GAS in fixed-8 display form; "" until a read has succeeded. */
  gas: string;
  /** True only when this snapshot carries real read-back balances. */
  loaded: boolean;
  /** Non-empty when the snapshot settled as a failed read. */
  error: string;
}

function toBase64Utf8(value: string): string {
  if (!value) return "";
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeMaybeBase64(value: unknown): string {
  const text = asBoundedString(value, "", 4_096);
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
  const normalized = String(statusString || "").trim().toLowerCase();
  if (normalized === "executed") return "executed";
  if (normalized === "revoked" || normalized === "replaced") return "revoked";
  if (normalized === "rejected") return "rejected";
  if (normalized === "passed") return "passed";
  if (normalized === "expired") return "expired";
  if (normalized === "active" || normalized === "open" || normalized === "voting") {
    return expiryTime > 0 && expiryTime < Date.now() ? "expired" : "active";
  }
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
    const method = asBoundedString(parsed.method, "", 64);
    return {
      policyMethod: method || undefined,
      policyValue: parsed.value === undefined
        ? undefined
        : asBoundedString(parsed.value, "", 128),
    };
  } catch {
    return { policyValue: text.slice(0, 128) };
  }
}

function parseProposal(raw: unknown): Proposal | null {
  const data = asRecord(raw);
  const id = asPositiveInteger(data.id);
  if (!id) return null;

  const status = asSafeInteger(data.status, 0);
  const statusString = asBoundedString(data.statusString, "", 32);
  const expiryTime = toMsTimestamp(data.expiryTime);
  const policy = parsePolicyData(data.policyData);

  // getProposalDetails returns creator as a Hash160 ByteString in chain (LE)
  // byte order — convert to the display-order 0x hash explorers accept so the
  // contract rows don't show an unrecognizable little-endian hash next to the
  // human names of mirror proposals.
  const creatorRaw = asBoundedString(data.creator, "", 160);
  const creatorDisplay = parseHash160(data.creator) || creatorRaw;
  const yesVotes = asCount(data.yesVotes, 0);
  const noVotes = asCount(data.noVotes, 0);
  const reportedTotal = asCount(data.totalVotes, yesVotes + noVotes);

  return {
    id,
    source: "contract",
    type: asSafeInteger(data.type, 0),
    title: asBoundedString(data.title, `Proposal #${id}`, 160),
    description: asBoundedString(data.description, "", 2_000),
    creator: creatorRaw,
    creatorDisplay,
    ...policy,
    yesVotes,
    noVotes,
    totalVotes: Math.max(reportedTotal, yesVotes + noVotes),
    quorumRequired: asCount(data.quorumRequired, 0),
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
    for: asCount(data.for, 0),
    against: asCount(data.against, 0),
    neutral: asCount(data.neutral, 0),
  };
}

function parseExplorerProposal(raw: unknown): Proposal | null {
  const data = asRecord(raw);
  const number = asPositiveInteger(data.number);
  const externalId = asBoundedString(data.id, "", 160);
  if (!number && !externalId) return null;
  const councilVotes = parseVoteBucket(data.councilVotes);
  const communityVotes = parseVoteBucket(data.communityVotes);
  const yesVotes = councilVotes.for + communityVotes.for;
  const noVotes = councilVotes.against + communityVotes.against;
  const neutralVotes = councilVotes.neutral + communityVotes.neutral;
  const statusString = asBoundedString(data.status, "active", 32);
  const expiryTime = parseIsoTimestamp(data.endTime);

  // Namespace neo-community ids into the NEGATIVE space so they can never
  // collide with a real contract proposal id (positive) when both sources are
  // merged on mainnet — a synthetic char-code sum could otherwise equal a real
  // contract id and mislabel it (e.g. in hasVotedMap / React keys).
  const syntheticId = number || stableExternalId(externalId);
  return {
    id: -Math.abs(syntheticId || 1),
    externalId,
    source: "neo-community",
    type: asString(data.type).toLowerCase().includes("policy") ? 1 : 0,
    title: asBoundedString(data.title, externalId ? `Proposal ${externalId}` : `Proposal #${number}`, 160),
    description: asBoundedString(data.summary, asBoundedString(data.description, "", 2_000), 2_000),
    creator: asBoundedString(data.proposerName, asBoundedString(data.proposerOrganizationId, "neo.community", 160), 160),
    creatorDisplay: asBoundedString(data.proposerName, asBoundedString(data.proposerOrganizationId, "neo.community", 160), 160),
    yesVotes,
    noVotes,
    totalVotes: yesVotes + noVotes + neutralVotes,
    quorumRequired: 21,
    quorumReached: councilVotes.for + councilVotes.against + councilVotes.neutral >= 11,
    createTime: parseIsoTimestamp(data.createdAt),
    expiryTime,
    status: STATUS_ACTIVE,
    statusKey: statusKeyFor(STATUS_ACTIVE, statusString, expiryTime),
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
  app,
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
  const hasVotedKnownMap = createObservable<Record<number, boolean>>({});
  /**
   * The governance-rules read lane on the platform read-cell (read-cell
   * pilot). `governanceOverview.loaded` alone cannot tell "the rules read is
   * still in flight" from "the rules read came back empty" — both leave it
   * false. The council rules are contract config, so every visitor triggers
   * that read on arrival and sees whatever the false state renders. The
   * cell's status carries that missing signal: the view shimmers while
   * asking and speaks plainly once it knows. Both settle paths publish onto
   * `value` — success through the cell, failure through the explicit
   * emptyOverview() reset in loadGovernanceOverview's catch continuation —
   * and ensureGovernanceWritable re-publishes its verified pre-write
   * re-read, the owner-write the cell contract blesses.
   */
  const overviewCell: ReadCell<GovernanceOverview> = createReadCell(() => {
    let scope: { network: NeoNetwork; contract: string };
    try {
      scope = scopeForChain(currentChainId.get());
    } catch (error) {
      throw new GovernanceScopeError(error);
    }
    return readGovernanceOverview(scope);
  });
  const governanceOverview = createDerived<GovernanceOverview>(
    () => overviewCell.value.get() ?? UNREAD_OVERVIEW,
    [overviewCell.value],
  );
  const governanceOverviewError = createObservable("");
  /**
   * True once a governance-rules read has completed for the current network,
   * success or failure. A re-read keeps speaking plainly instead of
   * re-shimmering — `value` stays published while the cell reloads — and
   * setNetwork's reset returns the lane to unread.
   */
  const governanceOverviewSettled = createDerived(
    () => {
      const status = overviewCell.status.get();
      return status === "ready" || status === "error" || overviewCell.value.get() !== undefined;
    },
    [overviewCell.status, overviewCell.value],
  );
  const councilCandidates = createObservable<CouncilCandidate[]>([]);
  const councilRosterLoaded = createObservable(false);
  const councilRosterError = createObservable("");
  /**
   * The wallet-balances read lane on the platform read-cell (read-cell
   * pilot). The loader settles a domain snapshot instead of throwing (the
   * timestamp-proof verdict idiom): with no wallet there is nothing to read
   * — that question is answered, not pending — so it publishes an empty
   * settled snapshot synchronously; a failed read publishes the error
   * verdict. Balances carry the value only: an empty string means "nothing
   * to show yet"; what that absence should LOOK like is the view's call, not
   * the data layer's — a composable that emits "—" has already decided, and
   * decided wrong for the in-flight case.
   */
  const balancesCell: ReadCell<WalletBalancesSnapshot> = createReadCell(
    (): WalletBalancesSnapshot | Promise<WalletBalancesSnapshot> => {
      const walletAddress = address.get();
      if (!walletAddress) {
        return { neo: "", gas: "", loaded: false, error: "" };
      }
      return (async (): Promise<WalletBalancesSnapshot> => {
        try {
          const [neoRaw, gasRaw] = await Promise.all([
            app.wallet.raw("NEO", walletAddress),
            app.wallet.raw("GAS", walletAddress),
          ]);
          return {
            neo: neoRaw.toString(),
            gas: fixed8Display(gasRaw),
            loaded: true,
            error: "",
          };
        } catch {
          return { neo: "", gas: "", loaded: false, error: t("walletBalancesUnavailable") };
        }
      })();
    },
  );
  const neoBalance = createDerived(
    () => balancesCell.value.get()?.neo ?? "",
    [balancesCell.value],
  );
  const gasBalance = createDerived(
    () => balancesCell.value.get()?.gas ?? "",
    [balancesCell.value],
  );
  // A re-read voids the loaded/error verdicts while it runs but keeps the
  // last balances renderable — the same asymmetry the pre-cell writes had.
  const balancesLoaded = createDerived(
    () => balancesCell.status.get() === "ready" && (balancesCell.value.get()?.loaded ?? false),
    [balancesCell.status, balancesCell.value],
  );
  /** True once a balance read has completed, or once we know there is no wallet to read for. */
  const balancesSettled = createDerived(
    () => {
      const status = balancesCell.status.get();
      return status === "ready" || status === "error";
    },
    [balancesCell.status],
  );
  const balancesError = createDerived(
    () => (balancesCell.status.get() === "ready" ? balancesCell.value.get()?.error ?? "" : ""),
    [balancesCell.status, balancesCell.value],
  );
  const isVoting = createObservable(false);
  const isRecovering = createObservable(false);
  const address = createObservable("");
  const lastTx = createObservable<FrameworkTxResult | null>(null);
  const lastConfirmation = createObservable<GovernanceConfirmation | null>(null);
  const loadError = createObservable("");
  const candidateError = createObservable("");
  const pendingWrite = createObservable<PendingGovernanceOperation | null>(
    readPendingGovernanceOperation(app.storage.local),
  );
  const pendingStorageHealthy = createObservable(true);
  const currentNetwork = createDerived(
    () => resolveNetwork(currentChainId.get()) ?? "unknown",
    [currentChainId],
  );

  let proposalRun = 0;
  let candidateRun = 0;
  let voteStatusRun = 0;
  let overviewRun = 0;
  let rosterRun = 0;
  let writeInFlight = false;

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

  // framework-exempt: readNetworkContract's HTTP fallback deliberately rethrows the
  // ORIGINAL wallet read error after a failed /api/rpc/neo-read bridge attempt —
  // app.chain.readRaw alone cannot replicate that error contract (plan §3.6).
  // The wallet-lane read itself goes through the framework (app.chain.readRaw).
  async function readNetworkContract(
    network: NeoNetwork,
    scriptHash: string,
    method: string,
    args: FrameworkContractArg[] = [],
  ): Promise<unknown> {
    try {
      return await app.chain.readRaw(method, args, { scriptHash });
    } catch (walletReadError) {
      try {
        const res = await fetch(`${API_HOST}/api/rpc/neo-read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractHash: scriptHash,
            method,
            params: args.map((arg) => ({ type: arg.type, value: String(arg.value) })),
            network,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok || data?.result?.state !== "HALT") {
          throw walletReadError;
        }
        return parseInvokeResult({ stack: data.result.stack || [] });
      } catch {
        throw walletReadError;
      }
    }
  }

  function scopeForChain(chainId: string) {
    const network = resolveNetwork(chainId);
    const contract = contractHashFor(chainId);
    if (!network) throw new Error(t("networkUnavailable"));
    if (!contract) throw new Error(t("contractUnavailable"));
    return { network, contract };
  }

  async function readContractAt(
    chainId: string,
    method: string,
    args: FrameworkContractArg[] = [],
  ): Promise<unknown> {
    const scope = scopeForChain(chainId);
    return readNetworkContract(scope.network, scope.contract, method, args);
  }

  const currentScope = () => {
    const chainScope = scopeForChain(currentChainId.get());
    const wallet = address.get().trim();
    if (!wallet) throw new Error(t("connectWallet"));
    return {
      ...chainScope,
      wallet,
    };
  };

  type GovernanceScope = ReturnType<typeof currentScope>;

  const sameScope = (left: GovernanceScope, right: GovernanceScope) =>
    left.network === right.network &&
    left.contract.toLowerCase() === right.contract.toLowerCase() &&
    left.wallet === right.wallet;

  const verifyCandidateForWrite = async (scope: GovernanceScope, errorKey: string) => {
    const eligible = asStrictBoolean(await readNetworkContract(
      scope.network,
      scope.contract,
      "isCandidate",
      [app.chain.arg.hash160(scope.wallet)],
    ));
    if (eligible !== true) throw new Error(t(errorKey));
    if (!sameScope(scope, currentScope())) throw new Error(t("governanceScopeChanged"));
  };

  const rememberPending = (
    details: Omit<PendingGovernanceOperation, "version" | "txid" | "network" | "contract" | "wallet" | "submittedAt">,
    txid: string,
    scope: ReturnType<typeof currentScope>,
  ) => {
    if (!TXID_PATTERN.test(txid)) throw new Error(t("governanceTxidInvalid"));
    const pending: PendingGovernanceOperation = {
      version: 1,
      ...details,
      ...scope,
      txid,
      submittedAt: Date.now(),
    };
    pendingWrite.set(pending);
    pendingStorageHealthy.set(savePendingGovernanceOperation(app.storage.local, pending));
  };

  const forgetPending = () => {
    pendingWrite.set(null);
    pendingStorageHealthy.set(clearPendingGovernanceOperation(app.storage.local));
  };

  const hashMatchesWallet = (value: unknown, wallet: string) =>
    ownerMatchesAddress(value, wallet) || ownerMatchesAddress(parseHash160(value), wallet);

  const eventValue = (event: unknown, index: number) => app.chain.eventValue(event, index);

  const eventMatchesPending = (event: unknown, pending: PendingGovernanceOperation): boolean => {
    const proposalId = asPositiveInteger(eventValue(event, 0));
    if (!proposalId) return false;
    if (pending.proposalId && proposalId !== pending.proposalId) return false;
    if (pending.operation === "createProposal") {
      return (
        hashMatchesWallet(eventValue(event, 1), pending.wallet) &&
        asSafeInteger(eventValue(event, 2), -1) === pending.proposalType
      );
    }
    if (pending.operation === "vote") {
      const eventSupport = asStrictBoolean(eventValue(event, 2));
      return (
        hashMatchesWallet(eventValue(event, 1), pending.wallet) &&
        eventSupport !== null &&
        eventSupport === pending.support
      );
    }
    if (pending.operation === "revokeProposal") {
      return hashMatchesWallet(eventValue(event, 1), pending.wallet);
    }
    return true;
  };

  const readProposal = async (
    network: NeoNetwork,
    contract: string,
    proposalId: number,
  ): Promise<Proposal> => {
    const proposal = parseProposal(await readNetworkContract(network, contract, "getProposalDetails", [
      app.chain.arg.integer(proposalId),
    ]));
    if (!proposal || proposal.id !== proposalId) {
      throw new Error(t("proposalReadbackFailed"));
    }
    return proposal;
  };

  const verifyPendingReadback = async (
    pending: PendingGovernanceOperation,
    event: unknown,
  ): Promise<Proposal> => {
    if (!eventMatchesPending(event, pending)) {
      throw new Error(t("governanceEventMismatch"));
    }
    const proposalId = pending.proposalId ?? asPositiveInteger(eventValue(event, 0));
    if (!proposalId) throw new Error(t("proposalReadbackFailed"));
    const proposal = await readProposal(pending.network, pending.contract, proposalId);
    if (pending.operation === "createProposal") {
      const durationMatches = Boolean(
        pending.durationMs &&
        proposal.createTime > 0 &&
        proposal.expiryTime > proposal.createTime &&
        proposal.expiryTime - proposal.createTime === pending.durationMs,
      );
      if (
        !hashMatchesWallet(proposal.creator, pending.wallet) ||
        proposal.type !== pending.proposalType ||
        proposal.title !== pending.title ||
        proposal.description !== pending.description ||
        !durationMatches ||
        (pending.proposalType === 1 && (
          proposal.policyMethod !== pending.policyMethod ||
          proposal.policyValue !== pending.policyValue
        ))
      ) {
        throw new Error(t("proposalReadbackFailed"));
      }
    } else if (pending.operation === "vote") {
      const voted = asStrictBoolean(await readNetworkContract(pending.network, pending.contract, "hasVoted", [
        app.chain.arg.hash160(pending.wallet),
        app.chain.arg.integer(proposalId),
      ]));
      const recordedVote = asSafeInteger(await readNetworkContract(pending.network, pending.contract, "getVote", [
        app.chain.arg.hash160(pending.wallet),
        app.chain.arg.integer(proposalId),
      ]), -1);
      if (voted !== true || recordedVote !== (pending.support ? 1 : 0)) {
        throw new Error(t("voteReadbackFailed"));
      }
    } else if (pending.operation === "revokeProposal") {
      if (proposal.statusKey !== "revoked") throw new Error(t("proposalReadbackFailed"));
    } else if (pending.operation === "executeProposal") {
      if (proposal.statusKey !== "executed") throw new Error(t("proposalReadbackFailed"));
    } else {
      const eventStatus = asSafeInteger(eventValue(event, 1), -1);
      if (
        (proposal.statusKey !== "passed" && proposal.statusKey !== "rejected") ||
        eventStatus !== proposal.status
      ) {
        throw new Error(t("proposalReadbackFailed"));
      }
    }
    return proposal;
  };

  type PendingDetails = Omit<
    PendingGovernanceOperation,
    "version" | "txid" | "network" | "contract" | "wallet" | "submittedAt"
  >;

  const readGovernanceOverview = async (
    scope: { network: NeoNetwork; contract: string },
  ): Promise<GovernanceOverview> => {
    const [pausedRaw, constantsRaw, statsResult] = await Promise.all([
      readNetworkContract(scope.network, scope.contract, "isPaused"),
      readNetworkContract(scope.network, scope.contract, "getGovernanceConstants"),
      readNetworkContract(scope.network, scope.contract, "getPlatformStats").catch(() => null),
    ]);
    const paused = asStrictBoolean(pausedRaw);
    const constants = asRecord(constantsRaw);
    const stats = asRecord(statsResult);
    const committeeSize = asPositiveInteger(constants.committeeSize);
    const quorumPercent = asCount(constants.quorumPercent, -1);
    const thresholdPercent = asCount(constants.thresholdPercent, -1);
    const minDurationMs = asPositiveInteger(constants.minDurationSeconds);
    const maxDurationMs = asPositiveInteger(constants.maxDurationSeconds);
    if (
      paused === null ||
      committeeSize < 1 || committeeSize > 1_000 ||
      quorumPercent < 0 || quorumPercent > 100 ||
      thresholdPercent < 0 || thresholdPercent > 100 ||
      !minDurationMs || !maxDurationMs || minDurationMs > maxDurationMs
    ) {
      throw new Error(t("governanceRulesUnavailable"));
    }
    return {
      loaded: true,
      verifiedAt: Date.now(),
      ...scope,
      paused,
      committeeSize,
      quorumPercent,
      thresholdPercent,
      minDurationMs,
      maxDurationMs,
      totalProposals: asCount(stats.totalProposals, 0),
      totalVotes: asCount(stats.totalVotes, 0),
      passedProposals: asCount(stats.passedProposals, 0),
      totalMembers: asCount(stats.totalMembers, 0),
    };
  };

  /**
   * Drive the rules cell and keep the error string beside it. The cell owns
   * value + settledness; the catch continuation owns what the old error
   * branches wrote — the explicit emptyOverview() reset plus the per-path
   * message (a scope failure surfaces its own message, a contract-read
   * failure collapses to governanceRulesUnavailable). `overviewRun` guards
   * those continuation writes exactly like the old run guard: setNetwork
   * bumps it alongside the cell reset, so a superseded call never publishes.
   */
  const loadGovernanceOverview = async (): Promise<GovernanceOverview | null> => {
    const run = ++overviewRun;
    const chainId = currentChainId.get();
    try {
      const overview = await overviewCell.load();
      if (run === overviewRun && currentChainId.get() === chainId) {
        governanceOverviewError.set("");
      }
      return overview;
    } catch (error) {
      if (error instanceof GovernanceScopeError) {
        if (run === overviewRun) {
          overviewCell.value.set(emptyOverview());
          governanceOverviewError.set(app.errors.messageOf(error.original, t("governanceRulesUnavailable")));
        }
      } else if (run === overviewRun && currentChainId.get() === chainId) {
        overviewCell.value.set(emptyOverview());
        governanceOverviewError.set(t("governanceRulesUnavailable"));
      }
      return null;
    }
  };

  const ensureGovernanceWritable = async (
    scope: { network: NeoNetwork; contract: string; wallet: string },
  ): Promise<GovernanceOverview> => {
    let overview = governanceOverview.get();
    if (
      !overview.loaded ||
      Date.now() - overview.verifiedAt > OVERVIEW_MAX_AGE_MS ||
      overview.network !== scope.network ||
      overview.contract.toLowerCase() !== scope.contract.toLowerCase()
    ) {
      overview = await readGovernanceOverview(scope);
      if (resolveNetwork(currentChainId.get()) === scope.network) {
        // Verified pre-write re-read: it just round-tripped the live rules,
        // so it owns the cell's value as much as a load does (blessed write).
        overviewCell.value.set(overview);
        governanceOverviewError.set("");
      }
    }
    if (overview.paused !== false) throw new Error(t("governancePaused"));
    return overview;
  };

  async function invokeContract(
    method: GovernanceOperation,
    args: FrameworkContractArg[],
    details: Omit<PendingDetails, "operation" | "eventName">,
    boundScope?: GovernanceScope,
  ): Promise<FrameworkTxResult> {
    if (pendingWrite.get() || writeInFlight) throw new Error(t("governanceWritePending"));
    const scope = boundScope ?? currentScope();
    if (!sameScope(scope, currentScope())) throw new Error(t("governanceScopeChanged"));
    await ensureGovernanceWritable(scope);
    if (!sameScope(scope, currentScope())) throw new Error(t("governanceScopeChanged"));
    const pendingDetails: PendingDetails = {
      operation: method,
      eventName: GOVERNANCE_EVENTS[method],
      ...details,
    };
    writeInFlight = true;
    try {
      const tx = await app.chain.invoke(method, args, {
        scriptHash: scope.contract,
        waitForEvent: pendingDetails.eventName,
        waitTimeoutMs: 30_000,
        onTransactionSent: (txid) => rememberPending(pendingDetails, txid, scope),
      });
      lastTx.set(tx);
      if (tx.txid && !pendingWrite.get()) rememberPending(pendingDetails, tx.txid, scope);
      const pending = pendingWrite.get();
      if (tx.success === false && !pending) {
        throw new Error(t("governanceWriteRejected"));
      }
      if (
        !pending ||
        tx.success === false ||
        tx.verified !== true ||
        !tx.event
      ) {
        throw new Error(t("governanceWritePending"));
      }
      const confirmed = await verifyPendingReadback(pending, tx.event);
      forgetPending();
      if (resolveNetwork(currentChainId.get()) === pending.network) {
        selectedProposal.set(confirmed);
      }
      lastConfirmation.set({
        operation: pending.operation,
        txid: pending.txid,
        proposalId: confirmed.id,
        confirmedAt: Date.now(),
      });
      return tx;
    } finally {
      writeInFlight = false;
    }
  }

  const selectProposal = async (p: Proposal) => {
    selectedProposal.set(p);
    if (address.get() && p.source !== "neo-community" && p.id > 0) {
      await refreshHasVoted([p.id]);
    }
  };

  const castVote = async (proposalId: number, voteType: VoteChoice) => {
    if (isVoting.get()) return;
    if (!Number.isSafeInteger(proposalId) || proposalId <= 0) {
      throw new Error(t("proposalNotActive"));
    }
    if (voteType !== "for" && voteType !== "against") {
      throw new Error(t("invalidVoteChoice"));
    }
    const proposal = activeProposals.get().find((p) => p.id === proposalId);
    if (!proposal) throw new Error(t("proposalNotActive"));
    if (proposal.source === "neo-community") throw new Error(t("externalProposalReadOnly"));
    if (!address.get()) throw new Error(t("connectWallet"));
    if (!candidateLoaded.get() || candidateError.get()) throw new Error(t("eligibilityUnavailable"));
    if (!isCandidate.get()) throw new Error(t("notCandidate"));
    if (hasVotedKnownMap.get()[proposalId] !== true) throw new Error(t("voteStatusUnavailable"));
    if (hasVotedMap.get()[proposalId]) throw new Error(t("alreadyVoted"));
    const scope = currentScope();

    try {
      isVoting.set(true);
      await verifyCandidateForWrite(scope, "notCandidate");
      await invokeContract("vote", [
        app.chain.arg.hash160(scope.wallet),
        app.chain.arg.integer(proposalId),
        app.chain.arg.boolean(voteType === "for"),
      ], {
        proposalId,
        support: voteType === "for",
      }, scope);
      await loadProposals();
      await refreshHasVoted([proposalId]);
      await refreshWalletBalances();
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
    if (proposalData.type !== 0 && proposalData.type !== 1) {
      throw new Error(t("invalidProposalType"));
    }
    if (title.length > 80 || description.length > 1_000) {
      throw new Error(t("proposalTextTooLong"));
    }
    if (!address.get()) throw new Error(t("connectWalletCreate"));
    if (!candidateLoaded.get() || candidateError.get()) throw new Error(t("eligibilityUnavailable"));
    if (!isCandidate.get()) throw new Error(t("notCandidateCreate"));

    let policyData = "";
    let policyMethod = "";
    let policyValue = "";
    if (proposalData.type === 1) {
      policyMethod = String(proposalData.policyMethod || "").trim();
      policyValue = String(proposalData.policyValue || "").trim();
      if (!policyMethod || !policyValue) throw new Error(t("policyFieldsRequired"));
      if (!POLICY_METHODS.has(policyMethod)) throw new Error(t("invalidPolicyMethod"));
      // Neo native PolicyContract parameters (FeePerByte, ExecFeeFactor,
      // StoragePrice, MaxBlockSize, MaxTransactionsPerBlock, MaxSystemFee) are
      // non-negative integers. Reject floats / scientific / hex / whitespace so
      // an obviously-invalid value never reaches the invoke and pays gas to fail.
      if (!/^\d+$/.test(policyValue)) throw new Error(t("invalidPolicyValue"));
      const parsedValue = Number(policyValue);
      if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
        throw new Error(t("invalidPolicyValue"));
      }
      policyData = toBase64Utf8(JSON.stringify({ method: policyMethod, value: parsedValue }));
    }

    const duration = asPositiveInteger(proposalData.duration);
    const scope = currentScope();
    await verifyCandidateForWrite(scope, "notCandidateCreate");
    const overview = await ensureGovernanceWritable(scope);
    if (!duration || duration < overview.minDurationMs || duration > overview.maxDurationMs) {
      throw new Error(t("invalidProposalDuration"));
    }
    const tx = await invokeContract("createProposal", [
      app.chain.arg.hash160(scope.wallet),
      app.chain.arg.integer(proposalData.type || 0),
      app.chain.arg.string(title),
      app.chain.arg.string(description),
      app.chain.arg.byteArray(policyData),
      app.chain.arg.integer(duration),
    ], {
      proposalType: proposalData.type === 1 ? 1 : 0,
      title,
      description,
      policyMethod: proposalData.type === 1 ? policyMethod : undefined,
      policyValue: proposalData.type === 1 ? policyValue : undefined,
      durationMs: duration,
    }, scope);
    await loadProposals();
    await refreshWalletBalances();
    return tx;
  };

  const finalizeProposal = async (proposalId: number) => {
    if (!Number.isSafeInteger(proposalId) || proposalId <= 0) {
      throw new Error(t("invalidProposalId"));
    }
    const proposal = proposals.get().find((item) => item.source === "contract" && item.id === proposalId);
    if (!proposal || proposal.statusKey !== "expired") throw new Error(t("proposalNotFinalizable"));
    const tx = await invokeContract("finalizeProposal", [
      app.chain.arg.integer(proposalId),
    ], { proposalId });
    await loadProposals();
    await refreshWalletBalances();
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
    if (!Number.isSafeInteger(proposalId) || proposalId <= 0) {
      throw new Error(t("invalidProposalId"));
    }
    const proposal = proposals.get().find((item) => item.source === "contract" && item.id === proposalId);
    if (!proposal || proposal.statusKey !== "passed" || proposal.type !== 1) {
      throw new Error(t("proposalNotExecutable"));
    }
    const tx = await invokeContract("executeProposal", [
      app.chain.arg.integer(proposalId),
    ], { proposalId });
    await loadProposals();
    await refreshWalletBalances();
    return tx;
  };

  /**
   * Revoke (withdraw) an own proposal before it resolves. Gated to the creator
   * + contract source in the UI; the contract additionally enforces the creator
   * witness. Gives a candidate an exit for a mistaken proposal.
   */
  const revokeProposal = async (proposalId: number) => {
    if (!Number.isSafeInteger(proposalId) || proposalId <= 0) {
      throw new Error(t("invalidProposalId"));
    }
    if (!address.get()) throw new Error(t("connectWallet"));
    const scope = currentScope();
    const proposal = proposals.get().find((item) => item.source === "contract" && item.id === proposalId);
    if (
      !proposal ||
      proposal.statusKey !== "active" ||
      (!ownerMatchesAddress(proposal.creator, scope.wallet) &&
        !ownerMatchesAddress(proposal.creatorDisplay, scope.wallet))
    ) {
      throw new Error(t("proposalNotRevocable"));
    }
    const tx = await invokeContract("revokeProposal", [
      app.chain.arg.hash160(scope.wallet),
      app.chain.arg.integer(proposalId),
    ], { proposalId }, scope);
    await loadProposals();
    await refreshWalletBalances();
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

  const sameProposal = (left: Proposal, right: Proposal) =>
    (left.source ?? "contract") === (right.source ?? "contract") &&
    (left.externalId || String(left.id)) === (right.externalId || String(right.id));

  /** Read the on-chain proposals (newest 100). A partial page is never valid. */
  const loadContractProposals = async (
    scope: { network: NeoNetwork; contract: string },
  ): Promise<Proposal[]> => {
    const rawCount = await readNetworkContract(scope.network, scope.contract, "getProposalCount");
    const count = asSafeInteger(rawCount, -1);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(t("proposalCountInvalid"));
    }
    if (count === 0) return [];
    const limit = Math.min(count, MAX_PROPOSALS);
    const first = Math.max(1, count - limit + 1);
    const ids: number[] = [];
    for (let id = count; id >= first; id -= 1) {
      ids.push(id);
    }
    const rows: Proposal[] = [];
    for (let offset = 0; offset < ids.length; offset += CONTRACT_READ_CONCURRENCY) {
      const page = ids.slice(offset, offset + CONTRACT_READ_CONCURRENCY);
      rows.push(...await Promise.all(page.map((id) => readProposal(scope.network, scope.contract, id))));
    }
    return rows;
  };

  const loadProposals = async () => {
    const run = ++proposalRun;
    const chainId = currentChainId.get();
    try {
      loadingProposals.set(true);
      const scope = scopeForChain(chainId);
      const previousContract = proposals.get().filter((proposal) => proposal.source !== "neo-community");
      const previousExplorer = proposals.get().filter((proposal) => proposal.source === "neo-community");
      const [contractResult, explorerResult] = await Promise.allSettled([
        loadContractProposals(scope),
        fetchExplorerProposals(scope.network),
      ]);
      if (run !== proposalRun || currentChainId.get() !== chainId) return;
      const contract = contractResult.status === "fulfilled"
        ? contractResult.value
        : previousContract;
      const explorer = explorerResult.status === "fulfilled"
        ? explorerResult.value
        : previousExplorer;
      const failures = [contractResult, explorerResult].filter((result) => result.status === "rejected").length;
      if (failures === 2 && contract.length === 0 && explorer.length === 0) {
        loadError.set(t("proposalSourcesUnavailable"));
        throw new Error(t("proposalSourcesUnavailable"));
      }
      loadError.set(failures > 0 ? t("proposalSourcesPartial") : "");
      const merged = mergeProposals(contract, explorer);
      const selected = selectedProposal.get();
      proposals.set(merged);
      if (selected) {
        selectedProposal.set(merged.find((item) => sameProposal(item, selected)) ?? null);
      }
    } catch (error) {
      if (run === proposalRun && currentChainId.get() === chainId) {
        loadError.set(loadError.get() || t("proposalSourcesUnavailable"));
        if (proposals.get().length === 0) throw error;
      }
    } finally {
      if (run === proposalRun) loadingProposals.set(false);
    }
  };

  /** Fetch + parse the neo.community mirror into proposals. */
  const fetchExplorerProposals = async (network: NeoNetwork): Promise<Proposal[]> => {
    const data = await fetchExplorerGovernanceData(
      `${API_HOST}/api/explorer/council-governance?network=${network}`,
    );
    const governance = data as { proposals?: unknown };
    if (!Array.isArray(governance?.proposals)) {
      throw new Error(t("explorerProposalsUnavailable"));
    }
    return governance.proposals
      .slice(0, MAX_PROPOSALS)
      .map(parseExplorerProposal)
      .filter((proposal: Proposal | null): proposal is Proposal => Boolean(proposal));
  };

  const refreshCandidateStatus = async () => {
    const walletAddress = address.get();
    const chainId = currentChainId.get();
    const run = ++candidateRun;
    if (!walletAddress) {
      isCandidate.set(false);
      votingPower.set(0);
      candidateLoaded.set(true);
      candidateError.set("");
      return;
    }

    try {
      candidateLoaded.set(false);
      candidateError.set("");
      const result = await readContractAt(chainId, "isCandidate", [
        app.chain.arg.hash160(walletAddress),
      ]);
      const eligible = asStrictBoolean(result);
      if (eligible === null) throw new Error(t("eligibilityUnavailable"));
      if (run !== candidateRun || address.get() !== walletAddress || currentChainId.get() !== chainId) return;
      isCandidate.set(eligible);
      votingPower.set(eligible ? 1 : 0);
    } catch {
      if (run === candidateRun && address.get() === walletAddress && currentChainId.get() === chainId) {
        isCandidate.set(false);
        votingPower.set(0);
        candidateError.set(t("eligibilityUnavailable"));
      }
    } finally {
      if (run === candidateRun && address.get() === walletAddress && currentChainId.get() === chainId) {
        candidateLoaded.set(true);
      }
    }
  };

  /**
   * Re-read both wallet balances through the read-cell. The loader owns the
   * whole verdict (empty settled snapshot with no wallet, error verdict on a
   * failed read), and the cell's epoch replaces the old run/address/chain
   * guards: setAddress and setNetwork reset the cell, so a superseded read
   * never publishes.
   */
  const refreshWalletBalances = async () => {
    await balancesCell.load();
  };

  const loadCouncilRoster = async () => {
    const chainId = currentChainId.get();
    const run = ++rosterRun;
    councilRosterLoaded.set(false);
    councilRosterError.set("");
    try {
      const network = resolveNetwork(chainId);
      if (!network) throw new Error(t("networkUnavailable"));
      const [candidateRaw, committeeRaw] = await Promise.all([
        readNetworkContract(network, NEO_NATIVE_HASH, "getCandidates"),
        readNetworkContract(network, NEO_NATIVE_HASH, "getCommittee"),
      ]);
      if (!Array.isArray(candidateRaw) || !Array.isArray(committeeRaw)) {
        throw new Error(t("councilRosterUnavailable"));
      }
      const committee = new Set(
        committeeRaw
          .slice(0, MAX_COUNCIL_CANDIDATES)
          .map(normalizePublicKey)
          .filter(Boolean),
      );
      const candidates = candidateRaw
        .slice(0, MAX_COUNCIL_CANDIDATES)
        .map((row) => {
          if (!Array.isArray(row) || row.length < 2) return null;
          const publicKey = normalizePublicKey(row[0]);
          const votes = asCount(row[1], -1);
          if (!publicKey || votes < 0) return null;
          return { publicKey, votes };
        })
        .filter((row): row is { publicKey: string; votes: number } => Boolean(row))
        .sort((left, right) => right.votes - left.votes || left.publicKey.localeCompare(right.publicKey));
      if (candidateRaw.length > 0 && candidates.length === 0) {
        throw new Error(t("councilRosterUnavailable"));
      }
      const seen = new Set(candidates.map((candidate) => candidate.publicKey));
      for (const publicKey of committee) {
        if (!seen.has(publicKey)) candidates.push({ publicKey, votes: 0 });
      }
      const roster = candidates
        .map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
          isCommittee: committee.has(candidate.publicKey),
        }))
        .sort((left, right) => Number(right.isCommittee) - Number(left.isCommittee) || left.rank - right.rank);
      if (run !== rosterRun || currentChainId.get() !== chainId) return;
      councilCandidates.set(roster);
      councilRosterLoaded.set(true);
    } catch {
      if (run === rosterRun && currentChainId.get() === chainId) {
        councilCandidates.set([]);
        councilRosterError.set(t("councilRosterUnavailable"));
      }
    }
  };

  const refreshHasVoted = async (proposalIds?: number[]) => {
    const walletAddress = address.get();
    const chainId = currentChainId.get();
    const run = ++voteStatusRun;
    if (!walletAddress) {
      hasVotedMap.set({});
      hasVotedKnownMap.set({});
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
    const knownUpdates: Record<number, boolean> = { ...hasVotedKnownMap.get() };
    await Promise.all(
      ids.map(async (id) => {
        try {
          const voted = asStrictBoolean(
            await readContractAt(chainId, "hasVoted", [
              app.chain.arg.hash160(walletAddress),
              app.chain.arg.integer(id),
            ]),
          );
          if (voted === null) throw new Error(t("voteStatusUnavailable"));
          updates[id] = voted;
          knownUpdates[id] = true;
        } catch {
          knownUpdates[id] = false;
        }
      }),
    );
    if (run !== voteStatusRun || address.get() !== walletAddress || currentChainId.get() !== chainId) return;
    hasVotedMap.set(updates);
    hasVotedKnownMap.set(knownUpdates);
  };

  const recoverPendingWrite = async () => {
    const pending = pendingWrite.get();
    if (!pending || isRecovering.get()) return null;
    const scope = currentScope();
    if (!governancePendingMatchesScope(pending, scope)) {
      throw new Error(t("pendingGovernanceScopeMismatch"));
    }
    isRecovering.set(true);
    try {
      let event: unknown | undefined;
      for (let page = 0; page < RECOVERY_EVENT_MAX_PAGES && !event; page += 1) {
        const events = await app.chain.events(pending.eventName, {
          limit: RECOVERY_EVENT_PAGE_SIZE,
          offset: page * RECOVERY_EVENT_PAGE_SIZE,
        });
        event = events.find(
          (entry) => governanceEventTxid(entry).toLowerCase() === pending.txid.toLowerCase(),
        );
        if (events.length < RECOVERY_EVENT_PAGE_SIZE) break;
      }
      if (!event) throw new Error(t("governanceWritePending"));
      const proposal = await verifyPendingReadback(pending, event);
      forgetPending();
      if (resolveNetwork(currentChainId.get()) === pending.network) selectedProposal.set(proposal);
      lastConfirmation.set({
        operation: pending.operation,
        txid: pending.txid,
        proposalId: proposal.id,
        confirmedAt: Date.now(),
      });
      await loadProposals();
      if (pending.operation === "vote") await refreshHasVoted([proposal.id]);
      await refreshWalletBalances();
      return proposal;
    } finally {
      isRecovering.set(false);
    }
  };

  const init = async () => {
    await Promise.allSettled([
      loadGovernanceOverview(),
      loadCouncilRoster(),
      loadProposals(),
      refreshCandidateStatus(),
      refreshWalletBalances(),
    ]);
    await refreshHasVoted();
  };

  const setAddress = (addr: string) => {
    const next = addr.trim();
    if (next === address.get()) return;
    candidateRun += 1;
    voteStatusRun += 1;
    address.set(next);
    isCandidate.set(false);
    candidateLoaded.set(!next);
    candidateError.set("");
    votingPower.set(0);
    hasVotedMap.set({});
    hasVotedKnownMap.set({});
    // A wallet was just supplied: its balances are pending, not answered —
    // the reset also invalidates any in-flight read. With no wallet the
    // answer is already known, so the synchronous no-wallet load settles the
    // empty snapshot immediately.
    balancesCell.reset();
    if (!next) void balancesCell.load();
    lastTx.set(null);
    lastConfirmation.set(null);
  };

  const setNetwork = (networkId: string) => {
    const network = resolveNetwork(networkId);
    const next = network ? `neo-n3-${network}` : "unknown";
    if (next === currentChainId.get()) return;
    proposalRun += 1;
    candidateRun += 1;
    voteStatusRun += 1;
    overviewRun += 1;
    rosterRun += 1;
    currentChainId.set(next);
    proposals.set([]);
    selectedProposal.set(null);
    loadError.set("");
    // The new network's rules have not been read yet — back to shimmering.
    // The reset also invalidates any in-flight overview publish.
    overviewCell.reset();
    governanceOverviewError.set("");
    councilCandidates.set([]);
    councilRosterLoaded.set(false);
    councilRosterError.set("");
    isCandidate.set(false);
    candidateLoaded.set(!address.get());
    candidateError.set("");
    votingPower.set(0);
    hasVotedMap.set({});
    hasVotedKnownMap.set({});
    // Balances are per-network too; with no wallet the question is already
    // answered, so the synchronous no-wallet load settles immediately.
    balancesCell.reset();
    if (!address.get()) void balancesCell.load();
    lastTx.set(null);
    lastConfirmation.set(null);
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
    hasVotedKnownMap,
    governanceOverview,
    governanceOverviewError,
    governanceOverviewSettled,
    councilCandidates,
    councilRosterLoaded,
    councilRosterError,
    neoBalance,
    gasBalance,
    balancesLoaded,
    balancesSettled,
    balancesError,
    currentNetwork,
    isVoting,
    isRecovering,
    address,
    lastTx,
    lastConfirmation,
    loadError,
    candidateError,
    pendingWrite,
    pendingStorageHealthy,
    selectProposal,
    castVote,
    createProposal,
    executeProposal,
    revokeProposal,
    finalizeProposal,
    loadProposals,
    loadGovernanceOverview,
    loadCouncilRoster,
    refreshCandidateStatus,
    refreshHasVoted,
    refreshWalletBalances,
    recoverPendingWrite,
    setAddress,
    setNetwork,
    init,
  };
}

export type UseGovernanceReturn = ReturnType<typeof useGovernance>;
