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
import { parseBigInt } from "@shared/utils/parsers";
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
  // app.chain.contractReady (S7) is exactly this derivation — a read-only
  // observable over the deployed contract address, subscription-compatible
  // with the manifest/PlayArea bindings.
  const contractReady = app.chain.contractReady;

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

    // Raw ARRAY read for the id-list methods (app.chain.readArray — the
    // framework surfaces ChainService.readArray directly).
    const idsRaw = await app.chain.readArray(op, [
      creatorArg,
      app.chain.arg.integer(0),
      app.chain.arg.integer(LIST_PAGE_LIMIT),
    ]);

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

    // Contract must be configured before any funds move — the prepay lane
    // resolves the deposit recipient from this same accessor.
    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) {
      throw new Error(t("contractMissing"));
    }
    const assetArg = app.chain.arg.hash160(assetHash(asset));

    isCreating.set(true);
    try {
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
        await app.funds.prepayAndCall({
          operation: "createEscrow",
          args: [
            creatorArg,
            beneficiaryArg,
            assetArg,
            app.chain.arg.integer(totalAmount),
            app.chain.arg.array(
              milestoneBaseUnits.map((n) => app.chain.arg.integer(n)),
            ),
            app.chain.arg.string(data.name.trim().slice(0, 60)),
            app.chain.arg.string((data.notes ?? "").slice(0, 240)),
          ],
          amountFixed8: totalAmount,
          memo: PAYMENT_MEMO,
          deposit: {
            scriptHash: assetHash(asset),
            confirm: (txid) => settleDeposit(txid, asset),
          },
          waitForEvent: "EscrowCreated",
          notify: "silent",
        });
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
    const creatorArg = hash160ArgOrNull(creatorAddr);
    if (!creatorArg) throw new Error(t("walletNotConnected"));

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
    const beneficiaryArg = hash160ArgOrNull(beneficiaryAddr);
    if (!beneficiaryArg) throw new Error(t("walletNotConnected"));

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
    const creatorArg = hash160ArgOrNull(creatorAddr);
    if (!creatorArg) throw new Error(t("walletNotConnected"));

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
