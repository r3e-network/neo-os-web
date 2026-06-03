/**
 * useMilestoneEscrow — Domain logic for the Milestone Escrow miniapp (OS Services)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (EscrowProxy, PaymentProxy) via edge functions, so this file
 * contains zero contract hashes, parameter encoding, or event parsing logic.
 *
 * This app maps directly to the EscrowService OS contract — the OS contract
 * was designed to replace this exact app's pattern.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getCreatorEscrows", [...])
 *     chain.read("getBeneficiaryEscrows", [...])
 *     chain.read("GetEscrowDetails", [...])
 *     chain.invoke("CreateEscrow", [...], { waitForEvent })
 *     chain.invoke("ApproveMilestone", [...], { waitForEvent })
 *     chain.invoke("ClaimMilestone", [...], { waitForEvent })
 *     chain.invoke("CancelEscrow", [...], { waitForEvent })
 *
 *   AFTER (OS proxy):
 *     escrowService.create(params)                       — create escrow
 *     escrowService.completeMilestone(escrowId, index)   — approve milestone
 *     escrowService.fund(escrowId)                       — claim milestone
 *     escrowService.refund(escrowId)                     — cancel escrow
 *     escrowService.get(escrowId)                        — get a single escrow
 *     paymentService.deposit(amount, memo)               — fund escrow
 *     storageService.set / list / get                    — per-user escrow index
 *
 * Listing model: the OS kernel exposes only a single-record GetEscrow and has
 * no escrow enumeration, and CreateEscrow does not return the kernel-assigned
 * id to the client. So this composable maintains its own per-user index in
 * os-storage (key `escrow:<addr>:<escrowId>` → minimal metadata) on create,
 * and rebuilds the creator/beneficiary lists from that index on refresh,
 * enriching each entry with a best-effort GetEscrow read. State is therefore
 * client-derived from the os-storage index.
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Loading/creating/approving/claiming/cancelling UI flags
 *   - Display helper functions
 *   - The os-storage escrow index and list reconstruction
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatGas, formatAddress } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import type { EscrowItem } from "../pages/index/components/EscrowList";

// ============================================================================
// Constants
// ============================================================================

/** Maximum milestones per escrow */
const MAX_MILESTONES = 12;

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
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage (escrow index) */
  storageService: StorageProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Minimal escrow metadata persisted to the os-storage index at create time.
 *
 * The OS kernel assigns the on-chain escrow id asynchronously and does not
 * return it to the client (CreateEscrow is an invocation intent signed by the
 * wallet, see os-escrow-create). The kernel also exposes no escrow enumeration
 * — only a single-record GetEscrow(appId, escrowId). To list a user's escrows
 * we therefore maintain a per-user index in os-storage, keyed by a stable
 * client-generated escrow id, and reconstruct the UI list from it. Any record
 * the kernel knows about is enriched via escrowService.get(id) on refresh.
 */
interface StoredEscrowMeta {
  id: string;
  creator: string;
  beneficiary: string;
  assetSymbol: "NEO" | "GAS";
  totalAmount: string;
  milestoneAmounts: string[];
  title: string;
  notes: string;
  status: "active" | "completed" | "cancelled";
  createdAt: number;
}

// ============================================================================
// Helpers
// ============================================================================

const parseBoolArray = (value: unknown, count: number): boolean[] => {
  if (!Array.isArray(value)) return new Array(count).fill(false);
  return value.map((item) => Boolean(item));
};

const parseBigIntArray = (value: unknown, count: number): bigint[] => {
  if (!Array.isArray(value)) return new Array(count).fill(0n);
  return value.map((item) => parseBigInt(item));
};

/** os-storage index key prefix for a given user address. */
const indexPrefix = (addr: string): string => `escrow:${addr}:`;

/** Full index key for a single escrow under a user address. */
const indexKey = (addr: string, escrowId: string): string => `${indexPrefix(addr)}${escrowId}`;

/**
 * Generate a stable client-side escrow id. The kernel assigns its own id, but
 * never returns it to the client, so we mint a deterministic-enough id here to
 * key the os-storage index and to use as the GetEscrow lookup key on refresh.
 */
const generateEscrowId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Narrow an unknown index value into a StoredEscrowMeta, or null if invalid. */
const asStoredMeta = (value: unknown): StoredEscrowMeta | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!v.id) return null;
  const assetSymbol: "NEO" | "GAS" = String(v.assetSymbol || "") === "NEO" ? "NEO" : "GAS";
  const milestoneAmounts = Array.isArray(v.milestoneAmounts)
    ? v.milestoneAmounts.map((m) => String(m))
    : [];
  const status = ((s: string): "active" | "completed" | "cancelled" =>
    s === "completed" || s === "cancelled" ? s : "active")(String(v.status || "active"));
  return {
    id: String(v.id),
    creator: String(v.creator || ""),
    beneficiary: String(v.beneficiary || ""),
    assetSymbol,
    totalAmount: String(v.totalAmount || "0"),
    milestoneAmounts,
    title: String(v.title || ""),
    notes: String(v.notes || ""),
    status,
    createdAt: Number(v.createdAt || 0),
  };
};

/**
 * Build an EscrowItem purely from stored index metadata. Used as the baseline
 * UI record; kernel data (when GetEscrow succeeds) is merged on top in
 * refreshEscrows so released/approved/claimed reflect on-chain truth.
 */
const escrowItemFromMeta = (meta: StoredEscrowMeta): EscrowItem => {
  const milestoneAmounts = meta.milestoneAmounts.map((m) => parseBigInt(m));
  const count = milestoneAmounts.length;
  return {
    id: meta.id,
    creator: meta.creator,
    beneficiary: meta.beneficiary,
    assetSymbol: meta.assetSymbol,
    totalAmount: parseBigInt(meta.totalAmount),
    releasedAmount: 0n,
    status: meta.status,
    milestoneAmounts,
    milestoneApproved: new Array(count).fill(false),
    milestoneClaimed: new Array(count).fill(false),
    title: meta.title,
    notes: meta.notes,
    active: meta.status === "active",
  };
};

const parseEscrow = (raw: Record<string, unknown> | null, id: string): EscrowItem | null => {
  if (!raw || typeof raw !== "object") return null;

  const assetSymbol: "NEO" | "GAS" = String(raw.assetSymbol || raw.asset || "") === "NEO" ? "NEO" : "GAS";
  const milestoneCount = Number(raw.milestoneCount || 0);

  return {
    id,
    creator: String(raw.creator || ""),
    beneficiary: String(raw.beneficiary || ""),
    assetSymbol,
    totalAmount: parseBigInt(raw.totalAmount),
    releasedAmount: parseBigInt(raw.releasedAmount),
    status: String(raw.status || "active") as "active" | "completed" | "cancelled",
    milestoneAmounts: parseBigIntArray(raw.milestoneAmounts, milestoneCount),
    milestoneApproved: parseBoolArray(raw.milestoneApproved, milestoneCount),
    milestoneClaimed: parseBoolArray(raw.milestoneClaimed, milestoneCount),
    title: String(raw.title || ""),
    notes: String(raw.notes || ""),
    active: Boolean(raw.active),
  };
};

// ============================================================================
// Composable
// ============================================================================

export function useMilestoneEscrow({
  escrowService,
  paymentService,
  storageService,
  t,
}: UseMilestoneEscrowOptions) {
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

  // Contract readiness: true once we have a wallet address
  const contractReady = createDerived(() => Boolean(address.get()), [address]);

  // ── Display helpers (exposed as refs for PlayArea) ────────────────────

  const statusLabel = (statusValue: "active" | "completed" | "cancelled"): string => {
    if (statusValue === "completed") return t("statusCompleted");
    if (statusValue === "cancelled") return t("statusCancelled");
    return t("statusActive");
  };

  const formatAmount = (assetSymbol: "NEO" | "GAS", amount: bigint): string => {
    if (assetSymbol === "NEO") return amount.toString();
    return formatGas(amount, 4);
  };

  // ── Data Loading (via OS services) ──────────────────────────────────

  /**
   * Resolve a single escrow into an EscrowItem.
   *
   * The stored index metadata is the source of truth for identity (id,
   * parties, amounts, title) and the baseline UI record. We then attempt a
   * single-record GetEscrow via EscrowProxy and merge any on-chain fields
   * (released amount, per-milestone approved/claimed, status) on top. The
   * kernel read is best-effort: it may 404 / fail for an id the kernel does
   * not know (e.g. before the create tx is mined), so a failure simply keeps
   * the metadata-derived baseline rather than dropping the escrow.
   */
  const resolveEscrow = async (meta: StoredEscrowMeta): Promise<EscrowItem> => {
    const baseline = escrowItemFromMeta(meta);
    try {
      const raw = await escrowService.get(meta.id);
      const onChain = parseEscrow((raw as Record<string, unknown>) || null, meta.id);
      if (!onChain) return baseline;
      // Merge: keep stored title/notes/parties, overlay on-chain progress.
      return {
        ...baseline,
        creator: onChain.creator || baseline.creator,
        beneficiary: onChain.beneficiary || baseline.beneficiary,
        totalAmount: onChain.totalAmount > 0n ? onChain.totalAmount : baseline.totalAmount,
        releasedAmount: onChain.releasedAmount,
        status: onChain.status,
        milestoneAmounts:
          onChain.milestoneAmounts.length > 0 ? onChain.milestoneAmounts : baseline.milestoneAmounts,
        milestoneApproved:
          onChain.milestoneApproved.length > 0 ? onChain.milestoneApproved : baseline.milestoneApproved,
        milestoneClaimed:
          onChain.milestoneClaimed.length > 0 ? onChain.milestoneClaimed : baseline.milestoneClaimed,
        active: onChain.status === "active",
      };
    } catch (e) {
      // Best-effort enrichment only — fall back to stored metadata.
      console.warn(
        "[useMilestoneEscrow] GetEscrow enrichment failed for",
        meta.id,
        ":",
        e instanceof Error ? e.message : String(e),
      );
      return baseline;
    }
  };

  /**
   * Refresh all escrows for the current user from the os-storage index.
   *
   * The OS kernel has no escrow enumeration, so we list the per-user index
   * (escrow:<addr>:*) that createEscrow maintains, then resolve each id into an
   * EscrowItem (stored metadata + best-effort GetEscrow enrichment). Records
   * are split into creator/beneficiary buckets based on the user's role.
   */
  const refreshEscrows = async () => {
    const addr = address.get();
    if (!addr) return;
    if (isRefreshing.get()) return;

    try {
      isRefreshing.set(true);

      // Enumerate the user's escrow ids from the os-storage index.
      const indexMap = await storageService.list(indexPrefix(addr), 200);

      const metas: StoredEscrowMeta[] = [];
      if (indexMap && typeof indexMap === "object") {
        for (const value of Object.values(indexMap)) {
          const meta = asStoredMeta(value);
          if (meta) metas.push(meta);
        }
      }

      // Newest first.
      metas.sort((a, b) => b.createdAt - a.createdAt);

      const resolved = await Promise.all(metas.map(resolveEscrow));

      const lowerAddr = addr.toLowerCase();
      const creator = resolved.filter((item) => item.creator.toLowerCase() === lowerAddr);
      const beneficiary = resolved.filter(
        (item) =>
          item.beneficiary.toLowerCase() === lowerAddr &&
          item.creator.toLowerCase() !== lowerAddr,
      );

      creatorEscrows.set(creator);
      beneficiaryEscrows.set(beneficiary);
    } catch (e) {
      console.warn("[useMilestoneEscrow] refreshEscrows failed:", e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      isRefreshing.set(false);
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      await refreshEscrows();
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions (via OS services) ─────────────────────────────────────────

  /**
   * Create a new milestone-based escrow via EscrowProxy.
   * The edge function handles wallet connection, asset transfer,
   * and the CreateEscrow contract invocation.
   */
  const createEscrow = async (data: CreateEscrowParams) => {
    if (isCreating.get()) return;

    if (data.milestones.length < 1 || data.milestones.length > MAX_MILESTONES) {
      throw new Error(t("milestoneLimit"));
    }

    const decimals = data.asset === "NEO" ? 0 : 8;
    const milestoneEntries: Array<{ name: string; amount: string }> = [];
    let totalAmount = 0n;

    for (const milestone of data.milestones) {
      const raw = String(milestone.amount || "").trim();
      if (!raw || (decimals === 0 && raw.includes("."))) {
        throw new Error(t("invalidAmount"));
      }
      const multiplier = decimals === 8 ? 1e8 : 1;
      const amount = BigInt(Math.round(parseFloat(raw) * multiplier));
      if (amount <= 0n) {
        throw new Error(t("invalidAmount"));
      }
      milestoneEntries.push({ name: `milestone-${milestoneEntries.length}`, amount: amount.toString() });
      totalAmount += amount;
    }

    if (totalAmount <= 0n) {
      throw new Error(t("invalidAmount"));
    }

    const creatorAddr = address.get();
    const beneficiaryAddr = data.beneficiary.trim();
    const assetSymbol = data.asset;

    isCreating.set(true);
    try {
      // Step 1: Fund the escrow via PaymentProxy
      await paymentService.deposit(
        totalAmount.toString(),
        `escrow:create:${data.name.trim().slice(0, 60)}`,
      );

      // Step 2: Create the escrow via EscrowProxy
      await escrowService.create({
        beneficiary: beneficiaryAddr,
        amount: totalAmount.toString(),
        milestones: milestoneEntries,
      });

      // Step 3: Maintain the os-storage index. The kernel does not return its
      // assigned escrow id and exposes no enumeration, so we mint a stable id
      // and record minimal metadata under per-user index keys. refreshEscrows
      // reads these back to rebuild the list (and enriches via GetEscrow).
      const escrowId = generateEscrowId();
      const meta: StoredEscrowMeta = {
        id: escrowId,
        creator: creatorAddr,
        beneficiary: beneficiaryAddr,
        assetSymbol,
        totalAmount: totalAmount.toString(),
        milestoneAmounts: milestoneEntries.map((m) => m.amount),
        title: data.name.trim(),
        notes: data.notes,
        status: "active",
        createdAt: Date.now(),
      };

      // Creator index entry (always). Beneficiary index entry too, so the
      // counterparty sees the incoming escrow from their own session — skip if
      // it equals the creator or is empty.
      const writes: Array<Promise<unknown>> = [
        storageService.set(indexKey(creatorAddr, escrowId), meta),
      ];
      if (beneficiaryAddr && beneficiaryAddr.toLowerCase() !== creatorAddr.toLowerCase()) {
        writes.push(storageService.set(indexKey(beneficiaryAddr, escrowId), meta));
      }
      await Promise.all(writes);

      await refreshEscrows();
    } finally {
      isCreating.set(false);
    }
  };

  /**
   * Patch the stored index metadata for an escrow after a successful action,
   * for both the creator and beneficiary index entries (when distinct). Keeps
   * the client-derived list/stats coherent even when GetEscrow enrichment is
   * unavailable (e.g. build-verified-only environments). Best-effort: storage
   * write failures are swallowed so they never mask a successful kernel action.
   */
  const patchIndexMeta = async (
    escrow: EscrowItem,
    patch: Partial<Pick<StoredEscrowMeta, "status">>,
  ) => {
    const targets = Array.from(
      new Set(
        [escrow.creator, escrow.beneficiary]
          .map((a) => a.trim())
          .filter((a) => a.length > 0),
      ),
    );

    await Promise.all(
      targets.map(async (addr) => {
        try {
          const raw = await storageService.get(indexKey(addr, escrow.id));
          const meta = asStoredMeta(raw);
          if (!meta) return;
          await storageService.set(indexKey(addr, escrow.id), { ...meta, ...patch });
        } catch (e) {
          console.warn(
            "[useMilestoneEscrow] index meta patch failed for",
            escrow.id,
            ":",
            e instanceof Error ? e.message : String(e),
          );
        }
      }),
    );
  };

  /**
   * Approve a milestone (creator action) via EscrowProxy.
   * The edge function handles the ApproveMilestone contract invocation.
   */
  const approveMilestone = async (escrow: EscrowItem, milestoneIndex?: number) => {
    if (approvingId.get()) return;

    const idx = milestoneIndex ?? escrow.milestoneApproved.findIndex((approved: boolean) => !approved);
    if (idx < 0) return;

    try {
      approvingId.set(`${escrow.id}-${idx}`);

      await escrowService.completeMilestone(escrow.id, idx);

      // Mark completed once the final milestone has been approved.
      if (idx >= escrow.milestoneApproved.length - 1) {
        await patchIndexMeta(escrow, { status: "completed" });
      }

      await refreshEscrows();
    } finally {
      approvingId.set(null);
    }
  };

  /**
   * Claim funds for an approved milestone (beneficiary action) via EscrowProxy.
   * The edge function handles the ClaimMilestone contract invocation.
   */
  const claimMilestone = async (escrow: EscrowItem, milestoneIndex?: number) => {
    if (claimingId.get()) return;

    const idx = milestoneIndex ?? escrow.milestoneApproved.findIndex(
      (approved: boolean, i: number) => approved && !escrow.milestoneClaimed[i],
    );
    if (idx < 0) return;

    try {
      claimingId.set(`${escrow.id}-${idx}`);

      await escrowService.fund(escrow.id);

      await refreshEscrows();
    } finally {
      claimingId.set(null);
    }
  };

  /**
   * Cancel an escrow and return funds to creator via EscrowProxy.
   * The edge function handles the CancelEscrow contract invocation.
   */
  const cancelEscrow = async (escrow: EscrowItem) => {
    if (cancellingId.get()) return;

    try {
      cancellingId.set(escrow.id);

      await escrowService.refund(escrow.id);

      await patchIndexMeta(escrow, { status: "cancelled" });

      await refreshEscrows();
    } finally {
      cancellingId.set(null);
    }
  };

  /**
   * Connect wallet and load escrows.
   */
  const connectWallet = async () => {
    // Wallet connection is handled by the platform's chain service
    // in main.ts. Once connected, address is set and refreshEscrows is called.
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

    // ── Computed (for manifest stat/sidebar bindings) ────────────────
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

    /**
     * Set the wallet address. Called from main.ts to track the
     * connected wallet address from the platform's chain service.
     */
    setAddress: (addr: string) => { address.set(addr); },
  };
}

/** Return type of useMilestoneEscrow for external typing */
export type UseMilestoneEscrowReturn = ReturnType<typeof useMilestoneEscrow>;
