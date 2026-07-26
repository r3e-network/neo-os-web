/**
 * useMilestoneEscrow — Domain logic for the Milestone Escrow miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract
 * (MiniAppMilestoneEscrow) through the MiniApp framework SDK (ctx.framework →
 * app). The earlier OS-proxy data layer routed deposits/escrows through the
 * Morpheus Oracle FEE kernel, which is a GAS-only fee-credit contract with no
 * escrow primitive — so NEO could never work and there was no real escrow
 * ledger. This composable now drives the dedicated contract, which fully
 * supports NEO + GAS escrows.
 *
 * Contract interaction model (verified against the deployed ABI):
 *
 *   READS (app.chain.readRaw / app.chain.readArray, default app contract):
 *     getCreatorEscrows(creator, offset, limit)      -> escrowId[]
 *     getBeneficiaryEscrows(beneficiary, offset, limit) -> escrowId[]
 *     getEscrowDetails(escrowId)                      -> Map of fields
 *
 *   MUTATIONS:
 *     createEscrow runs on app.funds.prepayAndCall's asset deposit lane:
 *     1. DEPOSIT — a NEP-17 transfer to the contract, targeting the *asset*
 *        token (deposit.scriptHash), with a memo that MUST start with the
 *        app id + ":" so OnNEP17Payment credits the depositor's prepaid
 *        balance for that asset:
 *          transfer(from, CONTRACT, totalBaseUnits, "miniapp-milestone-escrow:fund")
 *          { scriptHash: <GAS_HASH | NEO_HASH> }
 *     2. createEscrow(creator, beneficiary, asset, totalAmount,
 *        milestoneAmounts[], title, notes) -> escrowId
 *        Consumes the creator's prepaid credit, so the deposit MUST land first
 *        (the lane settles the deposit before the consuming call).
 *     The rest go through app.chain.invoke:
 *     approveMilestone(creator, escrowId, milestoneIndex)   — 1-BASED index
 *     claimMilestone(beneficiary, escrowId, milestoneIndex) — 1-BASED index
 *     cancelEscrow(creator, escrowId)
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS. GAS is 1e8 base units per
 * GAS; NEO is indivisible (the integer token count, no scaling). totalAmount
 * and every milestone amount are base-unit integers, sum(milestones) must
 * equal total, and per-asset minimums apply (NEO >= 1, GAS >= 0.1 = 1e7).
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Loading/creating/approving/claiming/cancelling UI flags (double-submit
 *     guards)
 *   - Display helpers
 *   - Reading the creator/beneficiary escrow lists straight from chain
 */

import { createObservable, createDerived } from "@shared/react/context";
import { FrameworkPrepaidActionError } from "@shared/react";
import type { MiniAppFramework } from "@shared/react";
import { waitForDepositConfirmation } from "@shared/composables/useContractInteraction";
import type { DepositConfirmation } from "@shared/composables/useContractInteraction";
import { amountToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { formatGas, formatAddress } from "@shared/utils/format";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { EscrowItem } from "./escrowTypes";

// ============================================================================
// Constants
// ============================================================================

/** Milestone count bounds enforced by the contract (MIN_MILESTONES/MAX). */
const MIN_MILESTONES = 1;
const MAX_MILESTONES = 12;

/** Per-asset minimum total amount in BASE UNITS (contract MIN_NEO / MIN_GAS). */
const MIN_NEO_BASE = 1n; // 1 NEO (indivisible)
const MIN_GAS_BASE = 10_000_000n; // 0.1 GAS

/** Memo prefix the contract requires on the prepay transfer (appId + ":"). */
const PAYMENT_MEMO = "miniapp-milestone-escrow:fund";

/**
 * Contract text limits are UTF-8 BYTES, not JS UTF-16 chars: the devpack
 * compiles C# `string.Length` to the SIZE opcode over the UTF-8 ByteString
 * (MiniAppMilestoneEscrow.Internal.cs asserts title.Length <= 60 /
 * notes.Length <= 240 on that unit), so a 21-CJK-char title is 63 bytes and
 * reverts "title too long". A char-based `.slice(0, 60)` therefore let CJK
 * titles through at up to 3× the byte budget; because createEscrow runs on
 * the deposit-then-act lane, the deposit landed FIRST and the consuming call
 * then deterministically reverted, stranding the total as
 * reclaimable-but-manual credit. The JS-side unit contract is pinned by
 * apps/shared/test/milestone-escrow.logic.test.ts ("never sends more title
 * or notes bytes than the contract accepts").
 */
const MAX_TITLE_BYTES = 60;
const MAX_NOTES_BYTES = 240;

const utf8Encoder = new TextEncoder();

/**
 * Truncate to at most `maxBytes` UTF-8 bytes on a whole-codepoint boundary
 * (never splits a surrogate pair or multi-byte sequence). Exported for tests.
 */
export const truncateUtf8Bytes = (value: string, maxBytes: number): string => {
  if (utf8Encoder.encode(value).length <= maxBytes) return value;
  let out = "";
  let bytes = 0;
  for (const codepoint of value) {
    const size = utf8Encoder.encode(codepoint).length;
    if (bytes + size > maxBytes) break;
    out += codepoint;
    bytes += size;
  }
  return out;
};

/** Exact production deployment used by both current Neo N3 networks. */
const APPROVED_CONTRACT = "0x442162de25008ac78d4cce62ed8d8a64401b7ece";

const PENDING_WRITE_KEY = "pending-write/v1";

/** How many escrow ids to page in per role on a refresh. */
const LIST_PAGE_LIMIT = 200;

/** Creator recovery window for an approved tranche the beneficiary never claims. */
const APPROVAL_GRACE_PERIOD_MS = 2_592_000_000n;

export type EscrowDeploymentStatus =
  | "checking"
  | "ready"
  | "legacy"
  | "paused"
  | "mismatch"
  | "unavailable";

/** Resolve the NEP-17 token script hash for an asset symbol. */
const assetHash = (asset: "NEO" | "GAS"): string =>
  asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;

// ============================================================================
// Types
// ============================================================================

export interface CreateEscrowParams {
  name: string;
  beneficiary: string;
  asset: "NEO" | "GAS";
  notes: string;
  milestones: Array<{ amount: string }>;
}

export interface UseMilestoneEscrowOptions {
  /** MiniApp framework SDK from ctx.framework — the composable's only service surface. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Override the deposit-confirmation wait used before createEscrow consumes
   * the prepaid credit. Defaults to {@link waitForDepositConfirmation} polling
   * the N3Index for the deposit transfer's indexed NEP-17 Transfer event on
   * the asset token contract (this contract's OnNEP17Payment emits no Credited
   * event to wait on). Injectable for tests.
   */
  confirmDeposit?: (
    txid: string,
    asset: "NEO" | "GAS",
  ) => Promise<DepositConfirmation>;
}

type PendingOperation =
  | "create"
  | "approve"
  | "claim"
  | "cancel"
  | "reclaim-approved"
  | "reclaim-credit";

interface PendingWriteRecord {
  version: 1;
  wallet: string;
  contract: string;
  txid: string;
  operation: PendingOperation;
  submittedAt: number;
  escrowId?: string;
  milestoneIndex?: number;
  asset?: "NEO" | "GAS";
  creditBefore?: string;
  beneficiary?: string;
  totalAmount?: string;
  title?: string;
}

// ============================================================================
// Amount helpers
// ============================================================================
// toBaseUnits (amountToBaseUnits) comes from @shared/utils/amounts — GAS is
// scaled ×1e8 without floats; NEO is the integer token count (never scaled).

// ============================================================================
// On-chain detail parsing
// ============================================================================

const parseExactInteger = (value: unknown): bigint | null => {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    return null;
  }
  try {
    const parsed = BigInt(String(value ?? ""));
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
};

const parseExactBool = (value: unknown): boolean | null => {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return null;
};

const parseBoolArray = (value: unknown, count: number): boolean[] | null => {
  if (!Array.isArray(value) || value.length !== count) return null;
  const out = value.map(parseExactBool);
  return out.some((item) => item === null) ? null : (out as boolean[]);
};

const parseBigIntArray = (value: unknown, count: number): bigint[] | null => {
  if (!Array.isArray(value) || value.length !== count) return null;
  const out = value.map(parseExactInteger);
  if (out.some((item) => item === null || item <= 0n)) return null;
  return out as bigint[];
};

const normalizeStatus = (value: unknown): "active" | "completed" | "cancelled" | null => {
  const s = String(value ?? "");
  return s === "active" || s === "completed" || s === "cancelled" ? s : null;
};

/**
 * Parse a getEscrowDetails Map (returned by the chain read as a plain object)
 * into an EscrowItem. Returns null for an empty / missing escrow.
 */
const parseEscrowDetails = (raw: unknown, id: string): EscrowItem | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  // An unknown / zeroed escrow yields an empty map (no creator key).
  if (!v.creator) return null;

  const assetHashValue = String(v.asset ?? "").toLowerCase();
  const assetValue = String(v.assetSymbol ?? (
    assetHashValue === BLOCKCHAIN_CONSTANTS.NEO_HASH.toLowerCase() ? "NEO" :
      assetHashValue === BLOCKCHAIN_CONSTANTS.GAS_HASH.toLowerCase() ? "GAS" : ""
  ));
  if (assetValue !== "NEO" && assetValue !== "GAS") return null;
  const assetSymbol: "NEO" | "GAS" = assetValue;
  const milestoneCountValue = parseExactInteger(v.milestoneCount);
  if (
    milestoneCountValue === null ||
    milestoneCountValue < BigInt(MIN_MILESTONES) ||
    milestoneCountValue > BigInt(MAX_MILESTONES)
  ) {
    return null;
  }
  const milestoneCount = Number(milestoneCountValue);
  const totalAmount = parseExactInteger(v.totalAmount);
  const releasedAmount = parseExactInteger(v.releasedAmount);
  const createdTime = parseExactInteger(v.createdTime);
  const milestoneAmounts = parseBigIntArray(v.milestoneAmounts, milestoneCount);
  const milestoneApproved = parseBoolArray(v.milestoneApproved, milestoneCount);
  const milestoneClaimed = parseBoolArray(v.milestoneClaimed, milestoneCount);
  if (
    totalAmount === null ||
    totalAmount <= 0n ||
    releasedAmount === null ||
    releasedAmount > totalAmount ||
    createdTime === null ||
    createdTime <= 0n ||
    !milestoneAmounts ||
    !milestoneApproved ||
    !milestoneClaimed
  ) {
    return null;
  }
  if (milestoneAmounts.reduce((sum, amount) => sum + amount, 0n) !== totalAmount) {
    return null;
  }
  if (milestoneClaimed.some((claimed, index) => claimed && !milestoneApproved[index])) {
    return null;
  }
  const releasedFromMilestones = milestoneAmounts.reduce(
    (sum, amount, index) => sum + (milestoneClaimed[index] ? amount : 0n),
    0n,
  );
  if (releasedFromMilestones !== releasedAmount) return null;
  const status = normalizeStatus(v.status);
  if (!status) return null;
  if (status === "completed" && releasedAmount !== totalAmount) return null;
  if (status === "active" && releasedAmount >= totalAmount) return null;

  return {
    id,
    creator: String(v.creator ?? ""),
    beneficiary: String(v.beneficiary ?? ""),
    assetSymbol,
    totalAmount,
    releasedAmount,
    status,
    milestoneAmounts,
    milestoneApproved,
    milestoneClaimed,
    milestoneApprovedTimes: Array.from({ length: milestoneCount }, () => 0n),
    createdTime,
    title: String(v.title ?? ""),
    notes: String(v.notes ?? ""),
    active: status === "active",
  };
};

/** Coerce a raw escrow-id list value (number/string/bigint) to a string id. */
const toIdString = (value: unknown): string => {
  const id = parseExactInteger(value);
  return id !== null && id > 0n ? id.toString() : "";
};

const eventInteger = (event: unknown, index: number): bigint | null =>
  parseExactInteger(eventStateValue(event, index));

const readMapInteger = (
  value: unknown,
  key: string,
): bigint | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return parseExactInteger((value as Record<string, unknown>)[key]);
};

// ============================================================================
// Composable
// ============================================================================

export function useMilestoneEscrow({
  app,
  t,
  confirmDeposit,
}: UseMilestoneEscrowOptions) {
  // Deposit-confirmation wait (injectable). The default polls the N3Index for
  // the transfer txid's decoded events on the asset token contract — a prepaid
  // deposit is a NEP-17 transfer, so its Transfer event is indexed there once
  // the tx is in a block.
  const settleDeposit =
    confirmDeposit ??
    ((txid: string, asset: "NEO" | "GAS") =>
      waitForDepositConfirmation(txid, { contractHash: assetHash(asset) }));

  /**
   * Parse-style Hash160 guard: build the arg or return null instead of
   * letting arg.hash160's throw leak a raw error — callers convert null into
   * their own localized copy (walletNotConnected / invalidAddress).
   */
  const hash160ArgOrNull = (addr: string) => {
    try {
      return app.chain.arg.hash160(addr);
    } catch {
      return null;
    }
  };

  const requireConfirmedEvent = (
    result: { success?: boolean; verified?: boolean; event?: unknown },
    matches: (event: unknown) => boolean,
  ) => {
    if (
      result.success === false ||
      result.verified !== true ||
      !result.event ||
      !matches(result.event)
    ) {
      throw new Error(t("transactionConfirmationPending"));
    }
  };

  // ── Reactive State ────────────────────────────────────────────────────
  const creatorEscrows = createObservable<EscrowItem[]>([]);
  const beneficiaryEscrows = createObservable<EscrowItem[]>([]);
  const isLoading = createObservable(false);
  const isRefreshing = createObservable(false);
  const isCreating = createObservable(false);
  const dataError = createObservable("");
  const deploymentStatus = createObservable<EscrowDeploymentStatus>("checking");
  const deploymentMessage = createObservable(t("deploymentChecking"));
  const recoveryCreditError = createObservable("");
  const recoveryCapabilityVerified = createObservable(false);
  const gasRecoveryCredit = createObservable(0n);
  const neoRecoveryCredit = createObservable(0n);
  const isRecoveringCredit = createObservable<"GAS" | "NEO" | "">("");
  const reclaimingId = createObservable<string | null>(null);
  const pendingTxid = createObservable("");
  const pendingOperation = createObservable("");
  let pendingRecord: PendingWriteRecord | null = null;
  const approvingId = createObservable<string | null>(null);
  const claimingId = createObservable<string | null>(null);
  const cancellingId = createObservable<string | null>(null);
  const address = createObservable("");

  // ── Computed (manifest stat/sidebar bindings) ─────────────────────────
  const creatorEscrowCount = createDerived(
    () => creatorEscrows.get().length,
    [creatorEscrows],
  );
  const beneficiaryEscrowCount = createDerived(
    () => beneficiaryEscrows.get().length,
    [beneficiaryEscrows],
  );
  const activeCount = createDerived(
    () => creatorEscrows.get().filter((e) => e.status === "active").length,
    [creatorEscrows],
  );
  const completedCount = createDerived(
    () => creatorEscrows.get().filter((e) => e.status === "completed").length,
    [creatorEscrows],
  );
  const deploymentReady = createDerived(
    () => deploymentStatus.get() === "ready" || deploymentStatus.get() === "legacy",
    [deploymentStatus],
  );
  const fundingWritesEnabled = createDerived(
    () => deploymentStatus.get() === "ready",
    [deploymentStatus],
  );
  const recoveryCapable = createDerived(
    () => recoveryCapabilityVerified.get(),
    [recoveryCapabilityVerified],
  );

  const clearPendingWrite = () => {
    pendingRecord = null;
    pendingTxid.set("");
    pendingOperation.set("");
    app.storage.local.delete(PENDING_WRITE_KEY);
  };

  const persistPendingWrite = (
    operation: PendingOperation,
    txid: string,
    details: Omit<PendingWriteRecord, "version" | "wallet" | "contract" | "txid" | "operation" | "submittedAt"> = {},
  ) => {
    const wallet = address.get().trim();
    const contract = String(app.chain.contractAddress.get() ?? "").trim().toLowerCase();
    const normalizedTxid = String(txid ?? "").trim();
    if (!wallet || !contract || !normalizedTxid) return;
    pendingRecord = {
      version: 1,
      wallet,
      contract,
      txid: normalizedTxid,
      operation,
      submittedAt: Date.now(),
      ...details,
    };
    pendingTxid.set(normalizedTxid);
    pendingOperation.set(operation);
    app.storage.local.set(PENDING_WRITE_KEY, pendingRecord);
  };

  const restorePendingWrite = () => {
    const stored = app.storage.local.get<PendingWriteRecord | null>(PENDING_WRITE_KEY, null);
    const wallet = address.get().trim().toLowerCase();
    const contract = String(app.chain.contractAddress.get() ?? "").trim().toLowerCase();
    if (!wallet || !contract) {
      pendingRecord = null;
      pendingTxid.set("");
      pendingOperation.set("");
      return;
    }
    if (
      !stored ||
      stored.version !== 1 ||
      !stored.txid.trim() ||
      !Number.isFinite(stored.submittedAt) ||
      stored.submittedAt <= 0
    ) {
      clearPendingWrite();
      return;
    }
    if (
      stored.wallet.trim().toLowerCase() !== wallet ||
      stored.contract.trim().toLowerCase() !== contract
    ) {
      pendingRecord = null;
      pendingTxid.set("");
      pendingOperation.set("");
      return;
    }
    pendingRecord = stored;
    pendingTxid.set(stored.txid);
    pendingOperation.set(stored.operation);
  };

  const sharedEscrow = app.platformEscrow;
  const sharedEscrowEnabled = sharedEscrow.available;

  // Contract readiness reflects whether the app's contract is configured for the
  // network (what the deploymentPending copy actually describes) — NOT whether a
  // wallet is connected. Deriving it from the address made the disconnected case
  // show "deployment pending" and left the Connect-wallet branch (which needs
  // contractReady && !hasAddress) mathematically unreachable.
  // app.chain.contractReady (S7) is exactly this derivation — a read-only
  // observable over the deployed contract address, subscription-compatible
  // with the manifest/PlayArea bindings.
  const contractReady = createDerived(
    () => sharedEscrowEnabled || app.chain.contractReady.get(),
    [app.chain.contractReady],
  );

  // ── Display helpers (exposed for PlayArea) ────────────────────────────

  const statusLabel = (statusValue: "active" | "completed" | "cancelled"): string => {
    if (statusValue === "completed") return t("statusCompleted");
    if (statusValue === "cancelled") return t("statusCancelled");
    return t("statusActive");
  };

  const formatAmount = (assetSymbol: "NEO" | "GAS", amount: bigint): string => {
    if (assetSymbol === "NEO") return amount.toString();
    return formatGas(amount, 4);
  };

  const setDeployment = (status: EscrowDeploymentStatus, messageKey: string) => {
    deploymentStatus.set(status);
    deploymentMessage.set(t(messageKey));
    return status;
  };

  /**
   * Verify the live contract's product-level capabilities before any write.
   * The fixed address alone is not enough because Neo contracts are upgradeable:
   * the app also checks pause state, exact amount/milestone bounds, and the
   * direct-credit read used by the withdrawal recovery path.
   */
  const refreshDeploymentState = async (): Promise<EscrowDeploymentStatus> => {
    if (sharedEscrowEnabled) {
      try {
        await sharedEscrow.getPlatformStats();
        recoveryCapabilityVerified.set(true);
        return setDeployment("ready", "deploymentReady");
      } catch {
        recoveryCapabilityVerified.set(false);
        return setDeployment("unavailable", "deploymentUnavailable");
      }
    }
    if (!contractReady.get()) {
      recoveryCapabilityVerified.set(false);
      return setDeployment("unavailable", "deploymentPendingDesc");
    }

    const contract = String(app.chain.contractAddress.get() ?? "").trim().toLowerCase();
    if (contract !== APPROVED_CONTRACT) {
      recoveryCapabilityVerified.set(false);
      return setDeployment("mismatch", "deploymentMismatch");
    }

    deploymentStatus.set("checking");
    deploymentMessage.set(t("deploymentChecking"));
    try {
      const [stats, pausedRaw] = await Promise.all([
        app.chain.readRaw("getPlatformStats", []),
        app.chain.readRaw("isPaused", []),
      ]);
      const minNeo = readMapInteger(stats, "minNeo");
      const minGas = readMapInteger(stats, "minGas");
      const minMilestones = readMapInteger(stats, "minMilestones");
      const maxMilestones = readMapInteger(stats, "maxMilestones");
      const totalEscrows = readMapInteger(stats, "totalEscrows");
      const totalLocked = readMapInteger(stats, "totalLocked");
      const totalReleased = readMapInteger(stats, "totalReleased");
      const paused = parseExactBool(pausedRaw);
      if (
        minNeo !== MIN_NEO_BASE ||
        minGas !== MIN_GAS_BASE ||
        minMilestones !== BigInt(MIN_MILESTONES) ||
        maxMilestones !== BigInt(MAX_MILESTONES) ||
        totalEscrows === null ||
        totalLocked === null ||
        totalReleased === null ||
        paused === null
      ) {
        recoveryCapabilityVerified.set(false);
        return setDeployment("mismatch", "deploymentMismatch");
      }

      let recoveryAvailable = false;
      try {
        const recoveryProbe = await app.chain.readRaw("directAssetCreditOf", [
          app.chain.arg.hash160(assetHash("GAS")),
          app.chain.arg.hash160(assetHash("GAS")),
        ]);
        recoveryAvailable = parseExactInteger(recoveryProbe) !== null;
      } catch {
        // The current 28-method deployment is a legacy build. Existing
        // approve/claim/cancel paths remain valid, but a fresh two-step deposit
        // is blocked because unconsumed credit cannot be withdrawn.
      }
      recoveryCapabilityVerified.set(recoveryAvailable);
      if (paused) return setDeployment("paused", "deploymentPaused");
      return recoveryAvailable
        ? setDeployment("ready", "deploymentReady")
        : setDeployment("legacy", "deploymentLegacy");
    } catch {
      recoveryCapabilityVerified.set(false);
      return setDeployment("unavailable", "deploymentUnavailable");
    }
  };

  const requireCoreWriteReady = async () => {
    const status = await refreshDeploymentState();
    if (status !== "ready" && status !== "legacy") {
      throw new Error(deploymentMessage.get());
    }
  };

  const requireFundingWriteReady = async () => {
    const status = await refreshDeploymentState();
    if (status !== "ready") throw new Error(deploymentMessage.get());
  };

  const readRecoveryCredit = async (asset: "NEO" | "GAS", payer: string): Promise<bigint> => {
    if (sharedEscrowEnabled) return sharedEscrow.creditOf(asset, payer);
    const payerArg = hash160ArgOrNull(payer);
    if (!payerArg) throw new Error(t("walletNotConnected"));
    const raw = await app.chain.readRaw("directAssetCreditOf", [
      app.chain.arg.hash160(assetHash(asset)),
      payerArg,
    ]);
    const parsed = parseExactInteger(raw);
    if (parsed === null) throw new Error(t("creditSnapshotUnavailable"));
    return parsed;
  };

  const refreshRecoveryCredits = async () => {
    const payer = address.get().trim();
    if (!payer) {
      gasRecoveryCredit.set(0n);
      neoRecoveryCredit.set(0n);
      recoveryCreditError.set("");
      return;
    }
    if (!recoveryCapabilityVerified.get()) {
      gasRecoveryCredit.set(0n);
      neoRecoveryCredit.set(0n);
      recoveryCreditError.set("");
      return;
    }
    try {
      const [gas, neo] = await Promise.all([
        readRecoveryCredit("GAS", payer),
        readRecoveryCredit("NEO", payer),
      ]);
      gasRecoveryCredit.set(gas);
      neoRecoveryCredit.set(neo);
      recoveryCreditError.set("");
      if (pendingRecord?.operation === "reclaim-credit") {
        const current = pendingRecord.asset === "NEO" ? neo : gas;
        const before = parseExactInteger(pendingRecord.creditBefore);
        if (before !== null && current < before) clearPendingWrite();
      }
    } catch {
      gasRecoveryCredit.set(0n);
      neoRecoveryCredit.set(0n);
      recoveryCreditError.set(t("creditSnapshotUnavailable"));
    }
  };

  // ── Data Loading (direct chain reads) ─────────────────────────────────

  /**
   * Read escrow ids for a role and resolve each into an EscrowItem via
   * getEscrowDetails. The financial ledger is all-or-nothing: one malformed or
   * unreadable row locks action surfaces instead of silently omitting funds.
   */
  const readEscrowsForRole = async (
    op: "getCreatorEscrows" | "getBeneficiaryEscrows",
    addr: string,
  ): Promise<EscrowItem[]> => {
    if (!addr) return [];
    if (sharedEscrowEnabled) {
      const idsRaw = op === "getCreatorEscrows"
        ? await sharedEscrow.getCreatorEscrows(addr, 0, LIST_PAGE_LIMIT)
        : await sharedEscrow.getBeneficiaryEscrows(addr, 0, LIST_PAGE_LIMIT);
      if (!Array.isArray(idsRaw) || idsRaw.length > LIST_PAGE_LIMIT) {
        throw new Error(t("chainSnapshotUnavailable"));
      }
      const ids = idsRaw.map(toIdString);
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        throw new Error(t("chainSnapshotUnavailable"));
      }
      const items = await Promise.all(ids.map(async (id) => {
        const item = parseEscrowDetails(await sharedEscrow.getEscrowDetails(id), id);
        if (!item) throw new Error(t("chainSnapshotUnavailable"));
        const approvedTimes = await Promise.all(
          item.milestoneApproved.map(async (approved, index) => {
            if (!approved || item.milestoneClaimed[index]) return 0n;
            const raw = await sharedEscrow.getMilestoneDetails(id, index + 1);
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
              throw new Error(t("chainSnapshotUnavailable"));
            }
            const detail = raw as Record<string, unknown>;
            const amount = parseExactInteger(detail.amount);
            const approvedValue = parseExactBool(detail.approved);
            const claimed = parseExactBool(detail.claimed);
            const approvedTime = parseExactInteger(detail.approvedTime);
            if (
              amount !== item.milestoneAmounts[index] || approvedValue !== true ||
              claimed !== false || approvedTime === null || approvedTime <= 0n
            ) throw new Error(t("chainSnapshotUnavailable"));
            return approvedTime;
          }),
        );
        return { ...item, milestoneApprovedTimes: approvedTimes };
      }));
      return items;
    }
    // arg.hash160 THROWS on an empty/invalid address, so the empty guard above
    // mirrors the old `if (!hash) return []` behavior before we build the arg.
    const creatorArg = app.chain.arg.hash160(addr);

    // Raw ARRAY read for the id-list methods (app.chain.readArray — the
    // framework surfaces ChainService.readArray directly).
    const idsRaw = await app.chain.readArray(op, [
      creatorArg,
      app.chain.arg.integer(0),
      app.chain.arg.integer(LIST_PAGE_LIMIT),
    ]);

    if (!Array.isArray(idsRaw) || idsRaw.length > LIST_PAGE_LIMIT) {
      throw new Error(t("chainSnapshotUnavailable"));
    }
    const ids = idsRaw.map(toIdString);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
      throw new Error(t("chainSnapshotUnavailable"));
    }

    const items = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await app.chain.readRaw("getEscrowDetails", [
            app.chain.arg.integer(id),
          ]);
          const item = parseEscrowDetails(raw, id);
          if (!item) return null;
          const approvedTimes = await Promise.all(
            item.milestoneApproved.map(async (approved, index) => {
              if (!approved || item.milestoneClaimed[index]) return 0n;
              const milestoneRaw = await app.chain.readRaw("getMilestoneDetails", [
                app.chain.arg.integer(id),
                app.chain.arg.integer(index + 1),
              ]);
              if (!milestoneRaw || typeof milestoneRaw !== "object" || Array.isArray(milestoneRaw)) {
                throw new Error(t("chainSnapshotUnavailable"));
              }
              const detail = milestoneRaw as Record<string, unknown>;
              const amount = parseExactInteger(detail.amount);
              const detailApproved = parseExactBool(detail.approved);
              const detailClaimed = parseExactBool(detail.claimed);
              const approvedTime = parseExactInteger(detail.approvedTime);
              if (
                amount !== item.milestoneAmounts[index] ||
                detailApproved !== true ||
                detailClaimed !== false ||
                approvedTime === null ||
                approvedTime <= 0n
              ) {
                throw new Error(t("chainSnapshotUnavailable"));
              }
              return approvedTime;
            }),
          );
          return { ...item, milestoneApprovedTimes: approvedTimes };
        } catch (e) {
          console.warn(
            "[useMilestoneEscrow] getEscrowDetails failed for",
            id,
            ":",
            e instanceof Error ? e.message : String(e),
          );
          return null;
        }
      }),
    );

    if (items.some((item) => item === null)) {
      throw new Error(t("chainSnapshotUnavailable"));
    }
    return items as EscrowItem[];
  };

  const readEscrowById = async (id: string): Promise<EscrowItem> => {
    const normalizedId = toIdString(id);
    if (!normalizedId) throw new Error(t("chainSnapshotUnavailable"));
    if (sharedEscrowEnabled) {
      const item = parseEscrowDetails(await sharedEscrow.getEscrowDetails(normalizedId), normalizedId);
      if (!item) throw new Error(t("chainSnapshotUnavailable"));
      return item;
    }
    const raw = await app.chain.readRaw("getEscrowDetails", [
      app.chain.arg.integer(normalizedId),
    ]);
    const item = parseEscrowDetails(raw, normalizedId);
    if (!item) throw new Error(t("chainSnapshotUnavailable"));
    return item;
  };

  const reconcilePendingLedgerWrite = (items: EscrowItem[]) => {
    const pending = pendingRecord;
    if (!pending || pending.operation === "reclaim-credit") return;
    let resolved = false;
    if (pending.operation === "create") {
      const earliest = BigInt(Math.max(0, pending.submittedAt - 120_000));
      resolved = items.some((item) =>
        ownerMatchesAddress(item.creator, pending.wallet) &&
        ownerMatchesAddress(item.beneficiary, pending.beneficiary ?? "") &&
        item.totalAmount.toString() === pending.totalAmount &&
        item.title === (pending.title ?? "") &&
        item.createdTime >= earliest,
      );
    } else {
      const item = items.find((candidate) => candidate.id === pending.escrowId);
      const index = pending.milestoneIndex ?? -1;
      if (pending.operation === "approve") {
        resolved = Boolean(item && index >= 0 && item.milestoneApproved[index]);
      } else if (pending.operation === "claim" || pending.operation === "reclaim-approved") {
        resolved = Boolean(item && index >= 0 && item.milestoneClaimed[index]);
      } else if (pending.operation === "cancel") {
        resolved = Boolean(item && item.status === "cancelled");
      }
    }
    if (resolved) clearPendingWrite();
  };

  /**
   * Refresh creator + beneficiary escrows for the current user, straight from
   * the contract. Newest first (highest escrow id). The beneficiary bucket
   * excludes self-escrows (where the user is also the creator) so they only
   * appear once, under "created by you".
   */
  const refreshEscrows = async () => {
    const addr = address.get();
    if (!addr) {
      creatorEscrows.set([]);
      beneficiaryEscrows.set([]);
      dataError.set("");
      return;
    }
    if (isRefreshing.get()) return;

    try {
      isRefreshing.set(true);

      const [created, incoming] = await Promise.all([
        readEscrowsForRole("getCreatorEscrows", addr),
        readEscrowsForRole("getBeneficiaryEscrows", addr),
      ]);

      const sortNewestFirst = (list: EscrowItem[]): EscrowItem[] =>
        [...list].sort((a, b) => {
          try {
            const left = BigInt(a.id);
            const right = BigInt(b.id);
            return right === left ? 0 : right > left ? 1 : -1;
          } catch {
            return 0;
          }
        });

      const beneficiaryOnly = incoming.filter(
        (item) => !ownerMatchesAddress(item.creator, addr),
      );

      creatorEscrows.set(sortNewestFirst(created));
      beneficiaryEscrows.set(sortNewestFirst(beneficiaryOnly));
      reconcilePendingLedgerWrite([...created, ...beneficiaryOnly]);
      dataError.set("");
    } catch (e) {
      creatorEscrows.set([]);
      beneficiaryEscrows.set([]);
      dataError.set(t("chainSnapshotUnavailable"));
      console.warn(
        "[useMilestoneEscrow] refreshEscrows failed:",
        e instanceof Error ? e.message : String(e),
      );
      throw e;
    } finally {
      isRefreshing.set(false);
    }
  };

  /** A confirmed write must remain successful even if the follow-up read fails. */
  const refreshAfterConfirmedWrite = async () => {
    try {
      await refreshEscrows();
    } catch {
      // refreshEscrows already cleared action surfaces and exposed dataError.
    }
  };

  /** Load all data. Called on mount and wallet reconnect. */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      restorePendingWrite();
      await refreshDeploymentState();
      await Promise.all([refreshEscrows(), refreshRecoveryCredits()]);
    } finally {
      isLoading.set(false);
    }
  };

  const refreshAll = async () => {
    if (isLoading.get()) return;
    isLoading.set(true);
    try {
      await refreshDeploymentState();
      await Promise.all([refreshEscrows(), refreshRecoveryCredits()]);
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions (direct chain invocations) ────────────────────────────────

  /**
   * Create a milestone escrow against the standalone contract, via the
   * framework's deposit-then-act lane (app.funds.prepayAndCall).
   *
   * Two-step, both signed by the creator:
   *   1. DEPOSIT — transfer the total to the contract on the asset token, with
   *      the required memo, crediting the creator's prepaid balance.
   *   2. createEscrow — consumes that credit and opens the escrow (the lane
   *      settles the deposit in a block before this consuming call).
   *
   * If step 1 succeeds but step 2 fails, the prepaid credit remains on the
   * contract under (asset, creator) and can be reused on retry — the lane
   * tags that branch with FrameworkPrepaidActionError and we surface a
   * "funds prepaid, escrow not created" message rather than claiming a loss.
   */
  const createEscrow = async (data: CreateEscrowParams) => {
    if (isCreating.get()) return; // double-submit guard
    if (dataError.get()) throw new Error(t("chainSnapshotUnavailable"));

    if (
      data.milestones.length < MIN_MILESTONES ||
      data.milestones.length > MAX_MILESTONES
    ) {
      throw new Error(t("milestoneLimit"));
    }

    const asset = data.asset === "NEO" ? "NEO" : "GAS";

    // Convert every milestone to base units and sum the total.
    const milestoneBaseUnits: bigint[] = [];
    let totalAmount = 0n;
    for (const milestone of data.milestones) {
      const base = toBaseUnits(milestone.amount, asset);
      if (base <= 0n) {
        throw new Error(t("invalidAmount"));
      }
      milestoneBaseUnits.push(base);
      totalAmount += base;
    }

    if (totalAmount <= 0n) {
      throw new Error(t("invalidAmount"));
    }

    // Per-asset minimum total (contract enforces the same).
    const minimum = asset === "NEO" ? MIN_NEO_BASE : MIN_GAS_BASE;
    if (totalAmount < minimum) {
      throw new Error(asset === "NEO" ? t("minNeo") : t("minGas"));
    }

    // Sum-equals-total invariant (the contract asserts this too).
    const computedSum = milestoneBaseUnits.reduce((acc, n) => acc + n, 0n);
    if (computedSum !== totalAmount) {
      throw new Error(t("milestoneSumMismatch"));
    }

    // arg.hash160 THROWS on an empty/invalid address, so guard the raw address
    // strings FIRST (mirroring the old `if (!addr || !hash)` checks) and build
    // the Hash160 args through the parse-style guard — a null result becomes
    // this app's localized copy instead of a leaked raw throw.
    const creatorAddr = address.get();
    if (!creatorAddr) {
      throw new Error(t("walletNotConnected"));
    }
    const creatorArg = hash160ArgOrNull(creatorAddr);
    if (!creatorArg) {
      throw new Error(t("walletNotConnected"));
    }

    const beneficiaryAddr = data.beneficiary.trim();
    if (!beneficiaryAddr) {
      throw new Error(t("invalidAddress"));
    }
    const beneficiaryArg = hash160ArgOrNull(beneficiaryAddr);
    if (!beneficiaryArg) {
      throw new Error(t("invalidAddress"));
    }

    await requireFundingWriteReady();

    // Truncate by UTF-8 BYTES (the contract's unit), not UTF-16 chars — see
    // MAX_TITLE_BYTES. Computed once so the sent args and the pending-write
    // reconciliation record can never disagree.
    const escrowTitle = truncateUtf8Bytes(data.name.trim(), MAX_TITLE_BYTES);
    const escrowNotes = truncateUtf8Bytes(String(data.notes ?? ""), MAX_NOTES_BYTES);

    isCreating.set(true);
    try {
      if (sharedEscrowEnabled) {
        const result = await sharedEscrow.createEscrow({
          beneficiary: beneficiaryAddr,
          asset,
          totalAmount,
          milestoneAmounts: milestoneBaseUnits,
          title: escrowTitle,
          notes: escrowNotes,
          creator: creatorAddr,
          fundAmount: totalAmount,
        });
        if (result.success === false) throw new Error(t("transactionConfirmationPending"));
        await refreshAfterConfirmedWrite();
        return;
      }

      // Contract must be configured before any funds move — the prepay lane
      // resolves the deposit recipient from this same accessor.
      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) {
        throw new Error(t("contractMissing"));
      }
      const assetArg = app.chain.arg.hash160(assetHash(asset));

      // Deposit-then-act on the framework prepay lane (S3):
      //   1. DEPOSIT — NEP-17 transfer of the total to the contract on the
      //      *asset* token (deposit.scriptHash targets the token contract,
      //      not the app), memo prefixed with the app id so OnNEP17Payment
      //      credits the creator's prepaid balance.
      //   2. The lane waits for the deposit to land in a block before the
      //      consuming call — intra-block ordering is fee/hash-based, so an
      //      unconfirmed deposit lets createEscrow execute first and fault
      //      with "insufficient prepaid asset". OnNEP17Payment emits no
      //      Credited event on this contract, so deposit.confirm polls the
      //      transfer txid's own application log (the indexed Transfer event
      //      on the asset token); the fixed sleep remains only when the
      //      indexer is unreachable.
      //   3. createEscrow — consumes the prepaid credit and opens the escrow.
      // notify:'silent' — main.tsx's action guard owns the toasts and this
      // composable owns the localized stranded-credit copy below.
      //
      // The milestoneAmounts param is an on-chain Array<Integer>; the wallet
      // SDK serialises the nested args (same shape quadratic-funding uses
      // for finalizeRound).
      try {
        const result = await app.funds.prepayAndCall({
          operation: "createEscrow",
          args: [
            creatorArg,
            beneficiaryArg,
            assetArg,
            app.chain.arg.integer(totalAmount),
            app.chain.arg.array(
              milestoneBaseUnits.map((n) => app.chain.arg.integer(n)),
            ),
            app.chain.arg.string(escrowTitle),
            app.chain.arg.string(escrowNotes),
          ],
          amountFixed8: totalAmount,
          memo: PAYMENT_MEMO,
          deposit: {
            scriptHash: assetHash(asset),
            confirm: (txid) => settleDeposit(txid, asset),
          },
          waitForEvent: "EscrowCreated",
          onTransactionSent: (txid) => persistPendingWrite("create", txid, {
            beneficiary: beneficiaryAddr,
            totalAmount: totalAmount.toString(),
            title: escrowTitle,
          }),
          notify: "silent",
        });
        requireConfirmedEvent(
          result,
          (event) =>
            ownerMatchesAddress(eventStateValue(event, 1), creatorAddr) &&
            ownerMatchesAddress(eventStateValue(event, 2), beneficiaryAddr) &&
            eventInteger(event, 4) === totalAmount &&
            eventInteger(event, 5) === BigInt(milestoneBaseUnits.length),
        );
        clearPendingWrite();
      } catch (escrowErr) {
        // Deposit landed, escrow did not — the credit is held on the contract
        // under (asset, creator), reusable by retrying create. The lane tags
        // exactly this branch with the identity-stable
        // FrameworkPrepaidActionError; anything else (e.g. the deposit
        // transfer itself failing) propagates unmapped to the action guard.
        if (escrowErr instanceof FrameworkPrepaidActionError) {
          console.error(
            "[useMilestoneEscrow] createEscrow failed after deposit succeeded:",
            escrowErr.actionError instanceof Error
              ? escrowErr.actionError.message
              : String(escrowErr.actionError),
          );
          throw new Error(t("depositPrepaidNoEscrow"));
        }
        throw escrowErr;
      }

      await refreshAfterConfirmedWrite();
    } finally {
      isCreating.set(false);
    }
  };

  /**
   * Approve a milestone (creator action). milestoneIndex from the UI is
   * 0-based; the contract is 1-based, so we map it.
   */
  const approveMilestone = async (escrow: EscrowItem, milestoneIndex?: number) => {
    if (approvingId.get()) return; // double-submit guard
    if (dataError.get()) throw new Error(t("chainSnapshotUnavailable"));
    await requireCoreWriteReady();

    const creatorAddr = address.get();
    if (!creatorAddr) throw new Error(t("walletNotConnected"));
    const creatorArg = hash160ArgOrNull(creatorAddr);
    if (!creatorArg) throw new Error(t("walletNotConnected"));

    const liveEscrow = await readEscrowById(escrow.id);
    if (
      liveEscrow.status !== "active" ||
      !ownerMatchesAddress(liveEscrow.creator, creatorAddr)
    ) {
      throw new Error(t("escrowStateChanged"));
    }
    const idx =
      milestoneIndex ??
      liveEscrow.milestoneApproved.findIndex((approved: boolean) => !approved);
    if (
      idx < 0 ||
      idx >= liveEscrow.milestoneAmounts.length ||
      liveEscrow.milestoneApproved[idx] ||
      liveEscrow.milestoneClaimed[idx]
    ) {
      throw new Error(t("escrowStateChanged"));
    }

    try {
      approvingId.set(`${escrow.id}-${idx}`);
      if (sharedEscrowEnabled) {
        const result = await sharedEscrow.approveMilestone(
          liveEscrow.id,
          idx + 1,
          creatorAddr,
        );
        if (!result.txid || result.success === false) {
          throw new Error(t("transactionConfirmationPending"));
        }
        clearPendingWrite();
        await refreshAfterConfirmedWrite();
        return;
      }
      const result = await app.chain.invoke(
        "approveMilestone",
        [
          creatorArg,
          app.chain.arg.integer(escrow.id),
          app.chain.arg.integer(idx + 1), // 0-based UI → 1-based contract
        ],
        {
          waitForEvent: "MilestoneApproved",
          onTransactionSent: (txid) => persistPendingWrite("approve", txid, {
            escrowId: liveEscrow.id,
            milestoneIndex: idx,
          }),
        },
      );
      requireConfirmedEvent(
        result,
        (event) =>
          eventInteger(event, 0) === BigInt(liveEscrow.id) &&
          eventInteger(event, 1) === BigInt(idx + 1) &&
          ownerMatchesAddress(eventStateValue(event, 2), creatorAddr),
      );
      clearPendingWrite();
      await refreshAfterConfirmedWrite();
    } finally {
      approvingId.set(null);
    }
  };

  /**
   * Claim an approved milestone (beneficiary action). milestoneIndex from the
   * UI is 0-based; the contract is 1-based.
   */
  const claimMilestone = async (escrow: EscrowItem, milestoneIndex?: number) => {
    if (claimingId.get()) return; // double-submit guard
    if (dataError.get()) throw new Error(t("chainSnapshotUnavailable"));
    await requireCoreWriteReady();

    const beneficiaryAddr = address.get();
    if (!beneficiaryAddr) throw new Error(t("walletNotConnected"));
    const beneficiaryArg = hash160ArgOrNull(beneficiaryAddr);
    if (!beneficiaryArg) throw new Error(t("walletNotConnected"));

    const liveEscrow = await readEscrowById(escrow.id);
    if (
      liveEscrow.status !== "active" ||
      !ownerMatchesAddress(liveEscrow.beneficiary, beneficiaryAddr)
    ) {
      throw new Error(t("escrowStateChanged"));
    }
    const idx =
      milestoneIndex ??
      liveEscrow.milestoneApproved.findIndex(
        (approved: boolean, i: number) => approved && !liveEscrow.milestoneClaimed[i],
      );
    if (
      idx < 0 ||
      idx >= liveEscrow.milestoneAmounts.length ||
      !liveEscrow.milestoneApproved[idx] ||
      liveEscrow.milestoneClaimed[idx]
    ) {
      throw new Error(t("escrowStateChanged"));
    }

    try {
      claimingId.set(`${escrow.id}-${idx}`);
      if (sharedEscrowEnabled) {
        const result = await sharedEscrow.claimMilestone(
          liveEscrow.id,
          idx + 1,
          beneficiaryAddr,
        );
        if (!result.txid || result.success === false) {
          throw new Error(t("transactionConfirmationPending"));
        }
        clearPendingWrite();
        await refreshAfterConfirmedWrite();
        return;
      }
      const result = await app.chain.invoke(
        "claimMilestone",
        [
          beneficiaryArg,
          app.chain.arg.integer(escrow.id),
          app.chain.arg.integer(idx + 1), // 0-based UI → 1-based contract
        ],
        {
          waitForEvent: "MilestoneClaimed",
          onTransactionSent: (txid) => persistPendingWrite("claim", txid, {
            escrowId: liveEscrow.id,
            milestoneIndex: idx,
          }),
        },
      );
      requireConfirmedEvent(
        result,
        (event) =>
          eventInteger(event, 0) === BigInt(liveEscrow.id) &&
          eventInteger(event, 1) === BigInt(idx + 1) &&
          ownerMatchesAddress(eventStateValue(event, 2), beneficiaryAddr) &&
          eventInteger(event, 3) === liveEscrow.milestoneAmounts[idx],
      );
      clearPendingWrite();
      await refreshAfterConfirmedWrite();
    } finally {
      claimingId.set(null);
    }
  };

  /** Cancel an escrow and refund remaining funds to the creator. */
  const cancelEscrow = async (escrow: EscrowItem) => {
    if (cancellingId.get()) return; // double-submit guard
    if (dataError.get()) throw new Error(t("chainSnapshotUnavailable"));
    await requireCoreWriteReady();

    const creatorAddr = address.get();
    if (!creatorAddr) throw new Error(t("walletNotConnected"));
    const creatorArg = hash160ArgOrNull(creatorAddr);
    if (!creatorArg) throw new Error(t("walletNotConnected"));

    const liveEscrow = await readEscrowById(escrow.id);
    if (
      liveEscrow.status !== "active" ||
      !ownerMatchesAddress(liveEscrow.creator, creatorAddr)
    ) {
      throw new Error(t("escrowStateChanged"));
    }
    if (
      liveEscrow.milestoneApproved.some(
        (approved, index) => approved && !liveEscrow.milestoneClaimed[index],
      )
    ) {
      throw new Error(t("approvedAwaitingClaim"));
    }
    const expectedRefund = liveEscrow.totalAmount - liveEscrow.releasedAmount;
    const reviewedRefund = escrow.totalAmount - escrow.releasedAmount;
    if (expectedRefund <= 0n || expectedRefund !== reviewedRefund) {
      throw new Error(t("refundReviewChanged"));
    }

    try {
      cancellingId.set(escrow.id);
      if (sharedEscrowEnabled) {
        const result = await sharedEscrow.cancelEscrow(liveEscrow.id, creatorAddr);
        if (!result.txid || result.success === false) {
          throw new Error(t("transactionConfirmationPending"));
        }
        clearPendingWrite();
        await refreshAfterConfirmedWrite();
        return;
      }
      const result = await app.chain.invoke(
        "cancelEscrow",
        [
          creatorArg,
          app.chain.arg.integer(escrow.id),
        ],
        {
          waitForEvent: "EscrowCancelled",
          onTransactionSent: (txid) => persistPendingWrite("cancel", txid, {
            escrowId: liveEscrow.id,
          }),
        },
      );
      requireConfirmedEvent(
        result,
        (event) =>
          eventInteger(event, 0) === BigInt(liveEscrow.id) &&
          ownerMatchesAddress(eventStateValue(event, 1), creatorAddr) &&
          eventInteger(event, 2) === expectedRefund,
      );
      clearPendingWrite();
      await refreshAfterConfirmedWrite();
    } finally {
      cancellingId.set(null);
    }
  };

  /** Recover a creator-approved tranche after the deployed 30-day grace period. */
  const reclaimApprovedMilestone = async (escrow: EscrowItem, milestoneIndex: number) => {
    if (reclaimingId.get()) return;
    if (dataError.get()) throw new Error(t("chainSnapshotUnavailable"));
    await requireFundingWriteReady();

    const creatorAddr = address.get();
    if (!creatorAddr) throw new Error(t("walletNotConnected"));
    const creatorArg = hash160ArgOrNull(creatorAddr);
    if (!creatorArg) throw new Error(t("walletNotConnected"));

    const liveEscrow = await readEscrowById(escrow.id);
    const idx = Number(milestoneIndex);
    if (
      liveEscrow.status !== "active" ||
      !ownerMatchesAddress(liveEscrow.creator, creatorAddr) ||
      !Number.isInteger(idx) ||
      idx < 0 ||
      idx >= liveEscrow.milestoneAmounts.length ||
      !liveEscrow.milestoneApproved[idx] ||
      liveEscrow.milestoneClaimed[idx]
    ) {
      throw new Error(t("escrowStateChanged"));
    }

    const milestoneRaw = sharedEscrowEnabled
      ? await sharedEscrow.getMilestoneDetails(liveEscrow.id, idx + 1)
      : await app.chain.readRaw("getMilestoneDetails", [
        app.chain.arg.integer(liveEscrow.id),
        app.chain.arg.integer(idx + 1),
      ]);
    if (!milestoneRaw || typeof milestoneRaw !== "object" || Array.isArray(milestoneRaw)) {
      throw new Error(t("chainSnapshotUnavailable"));
    }
    const detail = milestoneRaw as Record<string, unknown>;
    const approvedTime = parseExactInteger(detail.approvedTime);
    const amount = parseExactInteger(detail.amount);
    if (
      approvedTime === null ||
      approvedTime <= 0n ||
      amount !== liveEscrow.milestoneAmounts[idx] ||
      parseExactBool(detail.approved) !== true ||
      parseExactBool(detail.claimed) !== false
    ) {
      throw new Error(t("chainSnapshotUnavailable"));
    }
    let approvalGracePeriod = APPROVAL_GRACE_PERIOD_MS;
    if (sharedEscrowEnabled) {
      const stats = await sharedEscrow.getPlatformStats();
      const configuredGrace = readMapInteger(stats, "approvalGraceMs");
      if (configuredGrace === null || configuredGrace <= 0n) {
        throw new Error(t("chainSnapshotUnavailable"));
      }
      approvalGracePeriod = configuredGrace;
    }
    if (BigInt(Date.now()) < approvedTime + approvalGracePeriod) {
      throw new Error(t("gracePeriodNotElapsed"));
    }

    try {
      reclaimingId.set(`${liveEscrow.id}-${idx}`);
      if (sharedEscrowEnabled) {
        const result = await sharedEscrow.reclaimApprovedMilestone(
          liveEscrow.id,
          idx + 1,
          creatorAddr,
        );
        if (!result.txid || result.success === false) {
          throw new Error(t("transactionConfirmationPending"));
        }
        clearPendingWrite();
        await refreshAfterConfirmedWrite();
        return;
      }
      const result = await app.chain.invoke(
        "reclaimApprovedMilestone",
        [
          creatorArg,
          app.chain.arg.integer(liveEscrow.id),
          app.chain.arg.integer(idx + 1),
        ],
        {
          waitForEvent: "ApprovedMilestoneReclaimed",
          onTransactionSent: (txid) => persistPendingWrite("reclaim-approved", txid, {
            escrowId: liveEscrow.id,
            milestoneIndex: idx,
          }),
        },
      );
      requireConfirmedEvent(
        result,
        (event) =>
          eventInteger(event, 0) === BigInt(liveEscrow.id) &&
          eventInteger(event, 1) === BigInt(idx + 1) &&
          ownerMatchesAddress(eventStateValue(event, 2), creatorAddr) &&
          eventInteger(event, 3) === liveEscrow.milestoneAmounts[idx],
      );
      clearPendingWrite();
      await refreshAfterConfirmedWrite();
    } finally {
      reclaimingId.set(null);
    }
  };

  /** Withdraw all unconsumed prepaid credit for one asset, verified by readback. */
  const reclaimDirectAssetCredit = async (asset: "NEO" | "GAS") => {
    if (isRecoveringCredit.get()) return;
    await refreshDeploymentState();
    if (!recoveryCapabilityVerified.get()) {
      throw new Error(deploymentMessage.get());
    }
    const payer = address.get().trim();
    if (!payer) throw new Error(t("walletNotConnected"));
    const payerArg = hash160ArgOrNull(payer);
    if (!payerArg) throw new Error(t("walletNotConnected"));
    const before = await readRecoveryCredit(asset, payer);
    if (before <= 0n) throw new Error(t("noRecoveryCredit"));

    isRecoveringCredit.set(asset);
    try {
      if (sharedEscrowEnabled) {
        const result = await sharedEscrow.withdrawCredit(asset, before, payer);
        if (!result.txid || result.success === false) {
          throw new Error(t("transactionConfirmationPending"));
        }

        let after: bigint | null = null;
        try {
          const immediate = await readRecoveryCredit(asset, payer);
          if (immediate === 0n) after = immediate;
        } catch {
          // The node may not have indexed the fresh transaction yet.
        }
        if (after === null) {
          after = await app.chain.waitForState(
            () => readRecoveryCredit(asset, payer),
            (value) => value === 0n,
          );
        }
        if (after !== 0n) throw new Error(t("transactionConfirmationPending"));

        if (asset === "GAS") gasRecoveryCredit.set(0n);
        else neoRecoveryCredit.set(0n);
        recoveryCreditError.set("");
        clearPendingWrite();
        return;
      }
      const result = await app.chain.invoke(
        "reclaimDirectAssetCredit",
        [
          app.chain.arg.hash160(assetHash(asset)),
          payerArg,
          app.chain.arg.integer(before),
        ],
        {
          onTransactionSent: (txid) => persistPendingWrite("reclaim-credit", txid, {
            asset,
            creditBefore: before.toString(),
          }),
        },
      );
      if (!result.txid || result.success === false) {
        throw new Error(t("transactionConfirmationPending"));
      }

      let after: bigint | null = null;
      try {
        const immediate = await readRecoveryCredit(asset, payer);
        if (immediate === 0n) after = immediate;
      } catch {
        // The node may not have indexed the fresh transaction yet.
      }
      if (after === null) {
        after = await app.chain.waitForState(
          () => readRecoveryCredit(asset, payer),
          (value) => value === 0n,
        );
      }
      if (after !== 0n) throw new Error(t("transactionConfirmationPending"));

      if (asset === "GAS") gasRecoveryCredit.set(0n);
      else neoRecoveryCredit.set(0n);
      recoveryCreditError.set("");
      clearPendingWrite();
    } finally {
      isRecoveringCredit.set("");
    }
  };

  /** Connect wallet and load escrows. */
  const connectWallet = async () => {
    if (address.get()) {
      await refreshAll();
    }
  };

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = () => {
    creatorEscrows.set([]);
    beneficiaryEscrows.set([]);
    dataError.set("");
    recoveryCreditError.set("");
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    creatorEscrows,
    beneficiaryEscrows,
    isLoading,
    isRefreshing,
    isCreating,
    dataError,
    deploymentStatus,
    deploymentMessage,
    deploymentReady,
    fundingWritesEnabled,
    recoveryCapable,
    recoveryCreditError,
    gasRecoveryCredit,
    neoRecoveryCredit,
    isRecoveringCredit,
    reclaimingId,
    pendingTxid,
    pendingOperation,
    approvingId,
    claimingId,
    cancellingId,
    contractReady,

    // ── Computed (manifest stat/sidebar bindings) ────────────────────
    creatorEscrowCount,
    beneficiaryEscrowCount,
    activeCount,
    completedCount,

    // ── Display helpers ─────────────────────────────────────────────
    statusLabel,
    formatAmount,
    formatAddress,

    // ── Actions ─────────────────────────────────────────────────────
    createEscrow,
    approveMilestone,
    claimMilestone,
    cancelEscrow,
    reclaimApprovedMilestone,
    reclaimDirectAssetCredit,
    connectWallet,
    refreshEscrows: refreshAll,
    refreshDeploymentState,
    refreshRecoveryCredits,

    // ── Lifecycle ───────────────────────────────────────────────────
    loadAll,
    cleanup,

    /** Set the connected wallet address (called from main.tsx). */
    setAddress: (addr: string) => {
      address.set(addr);
      restorePendingWrite();
    },
  };
}

/** Return type of useMilestoneEscrow for external typing. */
export type UseMilestoneEscrowReturn = ReturnType<typeof useMilestoneEscrow>;
