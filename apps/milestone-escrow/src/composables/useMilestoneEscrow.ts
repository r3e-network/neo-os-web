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
 *   READS (app.chain.readRaw, default app contract script hash):
 *     getCreatorEscrows(creator, offset, limit)      -> escrowId[]
 *     getBeneficiaryEscrows(beneficiary, offset, limit) -> escrowId[]
 *     getEscrowDetails(escrowId)                      -> Map of fields
 *   The two id-list reads use the raw chain's readArray (the framework SDK has
 *   no array-read equivalent), so a minimal chain reference is kept for those.
 *
 *   MUTATIONS (app.chain.invoke):
 *     1. DEPOSIT — a NEP-17 transfer to the contract, targeting the *asset*
 *        token (scriptHash override), with a memo that MUST start with the
 *        app id + ":" so OnNEP17Payment credits the depositor's prepaid
 *        balance for that asset:
 *          transfer(from, CONTRACT, totalBaseUnits, "miniapp-milestone-escrow:fund")
 *          { scriptHash: <GAS_HASH | NEO_HASH> }
 *     2. createEscrow(creator, beneficiary, asset, totalAmount,
 *        milestoneAmounts[], title, notes) -> escrowId
 *        Consumes the creator's prepaid credit, so the deposit MUST land first.
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
import type { MiniAppFramework } from "@shared/react";
import { waitForDepositConfirmation } from "@shared/composables/useContractInteraction";
import type { DepositConfirmation } from "@shared/composables/useContractInteraction";
import type { ChainService, ContractArg } from "@shared/services/ChainService";
import { amountToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { formatGas, formatAddress } from "@shared/utils/format";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS, TIME_CONSTANTS } from "@shared/constants";
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

/** How many escrow ids to page in per role on a refresh. */
const LIST_PAGE_LIMIT = 200;

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
  /** MiniApp framework SDK from ctx.framework (chain args/amounts/passthroughs). */
  app: MiniAppFramework;
  /**
   * Raw chain service from ctx.services.chain, used ONLY for the escrow-id
   * array reads (getCreatorEscrows / getBeneficiaryEscrows) — the framework SDK
   * exposes no array-read helper, so this is the single passthrough kept ad-hoc.
   */
  chain: ChainService;
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

// ============================================================================
// Amount helpers
// ============================================================================
// toBaseUnits (amountToBaseUnits) comes from @shared/utils/amounts — GAS is
// scaled ×1e8 without floats; NEO is the integer token count (never scaled).

// ============================================================================
// On-chain detail parsing
// ============================================================================

const parseBoolArray = (value: unknown, count: number): boolean[] => {
  if (!Array.isArray(value)) return new Array(count).fill(false);
  const out = value.map((item) => Boolean(item && item !== "0" && item !== 0));
  while (out.length < count) out.push(false);
  return out;
};

const parseBigIntArray = (value: unknown, count: number): bigint[] => {
  if (!Array.isArray(value)) return new Array(count).fill(0n);
  const out = value.map((item) => parseBigInt(item));
  while (out.length < count) out.push(0n);
  return out;
};

const normalizeStatus = (value: unknown): "active" | "completed" | "cancelled" => {
  const s = String(value ?? "active");
  return s === "completed" || s === "cancelled" ? s : "active";
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

  const assetSymbol: "NEO" | "GAS" =
    String(v.assetSymbol ?? "") === "NEO" ? "NEO" : "GAS";
  const milestoneCount = Number(parseBigInt(v.milestoneCount));

  return {
    id,
    creator: String(v.creator ?? ""),
    beneficiary: String(v.beneficiary ?? ""),
    assetSymbol,
    totalAmount: parseBigInt(v.totalAmount),
    releasedAmount: parseBigInt(v.releasedAmount),
    status: normalizeStatus(v.status),
    milestoneAmounts: parseBigIntArray(v.milestoneAmounts, milestoneCount),
    milestoneApproved: parseBoolArray(v.milestoneApproved, milestoneCount),
    milestoneClaimed: parseBoolArray(v.milestoneClaimed, milestoneCount),
    title: String(v.title ?? ""),
    notes: String(v.notes ?? ""),
    active: normalizeStatus(v.status) === "active",
  };
};

/** Coerce a raw escrow-id list value (number/string/bigint) to a string id. */
const toIdString = (value: unknown): string => {
  try {
    return parseBigInt(value).toString();
  } catch {
    return String(value ?? "");
  }
};

// ============================================================================
// Composable
// ============================================================================

export function useMilestoneEscrow({
  app,
  chain,
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

  // ── Reactive State ────────────────────────────────────────────────────
  const creatorEscrows = createObservable<EscrowItem[]>([]);
  const beneficiaryEscrows = createObservable<EscrowItem[]>([]);
  const isLoading = createObservable(false);
  const isRefreshing = createObservable(false);
  const isCreating = createObservable(false);
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

  // Contract readiness reflects whether the app's contract is configured for the
  // network (what the deploymentPending copy actually describes) — NOT whether a
  // wallet is connected. Deriving it from the address made the disconnected case
  // show "deployment pending" and left the Connect-wallet branch (which needs
  // contractReady && !hasAddress) mathematically unreachable.
  // The framework surfaces contractAddress as a plain { get } accessor, but the
  // derivation needs the subscribable observable — use the raw chain's
  // contractAddress (the same underlying RefCompatObservable) as the dependency.
  const contractReady = createDerived(
    () => Boolean(app.chain.contractAddress.get()),
    [chain.contractAddress],
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

  // ── Data Loading (direct chain reads) ─────────────────────────────────

  /**
   * Read escrow ids for a role and resolve each into an EscrowItem via
   * getEscrowDetails. Reads are best-effort: a single failed detail read is
   * dropped rather than failing the whole refresh.
   */
  const readEscrowsForRole = async (
    op: "getCreatorEscrows" | "getBeneficiaryEscrows",
    addr: string,
  ): Promise<EscrowItem[]> => {
    if (!addr) return [];
    // arg.hash160 THROWS on an empty/invalid address, so the empty guard above
    // mirrors the old `if (!hash) return []` behavior before we build the arg.
    const creatorArg = app.chain.arg.hash160(addr);

    // The framework SDK has no array-read helper, so this one id-list read stays
    // on the raw chain (readArray); its args are built via the framework though.
    // Framework args carry the same runtime shape as ContractArg — cast at this
    // single raw-chain boundary (the arg builders never emit nested Arrays here).
    const idsRaw = await chain.readArray(op, [
      creatorArg,
      app.chain.arg.integer(0),
      app.chain.arg.integer(LIST_PAGE_LIMIT),
    ] as ContractArg[]);

    const ids = (Array.isArray(idsRaw) ? idsRaw : [])
      .map(toIdString)
      .filter((id) => id && id !== "0");

    const items = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await app.chain.readRaw("getEscrowDetails", [
            app.chain.arg.integer(id),
          ]);
          return parseEscrowDetails(raw, id);
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

    return items.filter((item): item is EscrowItem => item !== null);
  };

  /**
   * Refresh creator + beneficiary escrows for the current user, straight from
   * the contract. Newest first (highest escrow id). The beneficiary bucket
   * excludes self-escrows (where the user is also the creator) so they only
   * appear once, under "created by you".
   */
  const refreshEscrows = async () => {
    const addr = address.get();
    if (!addr) return;
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
            return Number(BigInt(b.id) - BigInt(a.id));
          } catch {
            return 0;
          }
        });

      const beneficiaryOnly = incoming.filter(
        (item) => !ownerMatchesAddress(item.creator, addr),
      );

      creatorEscrows.set(sortNewestFirst(created));
      beneficiaryEscrows.set(sortNewestFirst(beneficiaryOnly));
    } catch (e) {
      console.warn(
        "[useMilestoneEscrow] refreshEscrows failed:",
        e instanceof Error ? e.message : String(e),
      );
      throw e;
    } finally {
      isRefreshing.set(false);
    }
  };

  /** Load all data. Called on mount and wallet reconnect. */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      await refreshEscrows();
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions (direct chain invocations) ────────────────────────────────

  /**
   * Create a milestone escrow against the standalone contract.
   *
   * Two-step, both signed by the creator:
   *   1. DEPOSIT — transfer the total to the contract on the asset token, with
   *      the required memo, crediting the creator's prepaid balance.
   *   2. createEscrow — consumes that credit and opens the escrow.
   *
   * If step 1 succeeds but step 2 fails, the prepaid credit remains on the
   * contract under (asset, creator) and can be reused on retry — we surface a
   * "funds prepaid, escrow not created" message rather than claiming a loss.
   */
  const createEscrow = async (data: CreateEscrowParams) => {
    if (isCreating.get()) return; // double-submit guard

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
    // the Hash160 args only once they are known non-empty & well-formed.
    const creatorAddr = address.get();
    if (!creatorAddr) {
      throw new Error(t("walletNotConnected"));
    }
    let creatorArg: ContractArg;
    try {
      creatorArg = app.chain.arg.hash160(creatorAddr) as ContractArg;
    } catch {
      throw new Error(t("walletNotConnected"));
    }

    const beneficiaryAddr = data.beneficiary.trim();
    if (!beneficiaryAddr) {
      throw new Error(t("invalidAddress"));
    }
    let beneficiaryArg: ContractArg;
    try {
      beneficiaryArg = app.chain.arg.hash160(beneficiaryAddr) as ContractArg;
    } catch {
      throw new Error(t("invalidAddress"));
    }

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) {
      throw new Error(t("contractMissing"));
    }
    const contractArg = app.chain.arg.hash160(contractHash) as ContractArg;
    const assetArg = app.chain.arg.hash160(assetHash(asset)) as ContractArg;

    isCreating.set(true);
    try {
      // Step 1: DEPOSIT — NEP-17 transfer to the contract on the asset token.
      // The scriptHash override targets the token contract (not the app), and
      // the memo must start with the app id so OnNEP17Payment credits us.
      const deposit = await app.chain.invoke(
        "transfer",
        [
          creatorArg,
          contractArg,
          app.chain.arg.integer(totalAmount),
          app.chain.arg.string(PAYMENT_MEMO),
        ],
        { scriptHash: assetHash(asset) },
      );

      // Wait for the deposit to land in a block before firing the consuming
      // call — intra-block ordering is fee/hash-based, so an unconfirmed
      // deposit lets createEscrow execute first and fault with "insufficient
      // prepaid asset". OnNEP17Payment emits no Credited event on this
      // contract, so the wait polls the transfer txid's own application log
      // (the indexed Transfer event on the asset token). The fixed sleep
      // remains only when the indexer is unreachable.
      const settlement = await settleDeposit(deposit.txid, asset);
      if (settlement === "unreachable") {
        await new Promise((resolve) =>
          setTimeout(resolve, TIME_CONSTANTS.SECOND_MS * 4),
        );
      }

      // Step 2: createEscrow — consumes the prepaid credit and opens the
      // escrow. If this fails, the credit stays on the contract under the
      // creator and the asset, recoverable by retrying create.
      //
      // The milestoneAmounts param is an on-chain Array<Integer>. The wallet
      // SDK serialises a nested ContractArg[] passed as the Array arg's value
      // (same shape quadratic-funding uses for finalizeRound). ContractArg.value
      // is nominally a scalar, so cast at this single boundary.
      const milestoneArg = app.chain.arg.array(
        milestoneBaseUnits.map((n) => app.chain.arg.integer(n)),
      ) as unknown as ContractArg;

      try {
        await app.chain.invoke(
          "createEscrow",
          [
            creatorArg,
            beneficiaryArg,
            assetArg,
            app.chain.arg.integer(totalAmount),
            milestoneArg,
            app.chain.arg.string(data.name.trim().slice(0, 60)),
            app.chain.arg.string((data.notes ?? "").slice(0, 240)),
          ],
          { waitForEvent: "EscrowCreated" },
        );
      } catch (escrowErr) {
        console.error(
          "[useMilestoneEscrow] createEscrow failed after deposit succeeded:",
          escrowErr instanceof Error ? escrowErr.message : String(escrowErr),
        );
        // Deposit landed, escrow did not — credit is held under the creator.
        throw new Error(t("depositPrepaidNoEscrow"));
      }

      await refreshEscrows();
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

    const idx =
      milestoneIndex ??
      escrow.milestoneApproved.findIndex((approved: boolean) => !approved);
    if (idx < 0) return;

    const creatorAddr = address.get();
    if (!creatorAddr) throw new Error(t("walletNotConnected"));
    let creatorArg: ContractArg;
    try {
      creatorArg = app.chain.arg.hash160(creatorAddr) as ContractArg;
    } catch {
      throw new Error(t("walletNotConnected"));
    }

    try {
      approvingId.set(`${escrow.id}-${idx}`);
      await app.chain.invoke(
        "approveMilestone",
        [
          creatorArg,
          app.chain.arg.integer(escrow.id),
          app.chain.arg.integer(idx + 1), // 0-based UI → 1-based contract
        ],
        { waitForEvent: "MilestoneApproved" },
      );
      await refreshEscrows();
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

    const idx =
      milestoneIndex ??
      escrow.milestoneApproved.findIndex(
        (approved: boolean, i: number) => approved && !escrow.milestoneClaimed[i],
      );
    if (idx < 0) return;

    const beneficiaryAddr = address.get();
    if (!beneficiaryAddr) throw new Error(t("walletNotConnected"));
    let beneficiaryArg: ContractArg;
    try {
      beneficiaryArg = app.chain.arg.hash160(beneficiaryAddr) as ContractArg;
    } catch {
      throw new Error(t("walletNotConnected"));
    }

    try {
      claimingId.set(`${escrow.id}-${idx}`);
      await app.chain.invoke(
        "claimMilestone",
        [
          beneficiaryArg,
          app.chain.arg.integer(escrow.id),
          app.chain.arg.integer(idx + 1), // 0-based UI → 1-based contract
        ],
        { waitForEvent: "MilestoneClaimed" },
      );
      await refreshEscrows();
    } finally {
      claimingId.set(null);
    }
  };

  /** Cancel an escrow and refund remaining funds to the creator. */
  const cancelEscrow = async (escrow: EscrowItem) => {
    if (cancellingId.get()) return; // double-submit guard

    const creatorAddr = address.get();
    if (!creatorAddr) throw new Error(t("walletNotConnected"));
    let creatorArg: ContractArg;
    try {
      creatorArg = app.chain.arg.hash160(creatorAddr) as ContractArg;
    } catch {
      throw new Error(t("walletNotConnected"));
    }

    try {
      cancellingId.set(escrow.id);
      await app.chain.invoke(
        "cancelEscrow",
        [
          creatorArg,
          app.chain.arg.integer(escrow.id),
        ],
        { waitForEvent: "EscrowCancelled" },
      );
      await refreshEscrows();
    } finally {
      cancellingId.set(null);
    }
  };

  /** Connect wallet and load escrows. */
  const connectWallet = async () => {
    if (address.get()) {
      await refreshEscrows();
    }
  };

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = () => {
    creatorEscrows.set([]);
    beneficiaryEscrows.set([]);
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    creatorEscrows,
    beneficiaryEscrows,
    isLoading,
    isRefreshing,
    isCreating,
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
    connectWallet,
    refreshEscrows,

    // ── Lifecycle ───────────────────────────────────────────────────
    loadAll,
    cleanup,

    /** Set the connected wallet address (called from main.tsx). */
    setAddress: (addr: string) => {
      address.set(addr);
    },
  };
}

/** Return type of useMilestoneEscrow for external typing. */
export type UseMilestoneEscrowReturn = ReturnType<typeof useMilestoneEscrow>;
