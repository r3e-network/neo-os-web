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
 *     escrowService.get(escrowId)                        — get escrow details
 *     paymentService.deposit(amount, memo)               — fund escrow
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Loading/creating/approving/claiming/cancelling UI flags
 *   - Display helper functions
 *   - Escrow list management
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
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
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
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
  const creatorEscrowCount = createDerived(() => creatorEscrows.get().length, []);
  const beneficiaryEscrowCount = createDerived(() => beneficiaryEscrows.get().length, []);
  const activeCount = createDerived(() =>
    creatorEscrows.get().filter((e) => e.status === "active").length,
  );
  const completedCount = createDerived(() =>
    creatorEscrows.get().filter((e) => e.status === "completed").length,
  );

  // Contract readiness: true once we have a wallet address
  const contractReady = createDerived(() => Boolean(address.get()), []);

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
   * Fetch escrow details via EscrowProxy.
   * The edge function reads GetEscrowDetails from the contract.
   */
  const fetchEscrowDetails = async (escrowId: string): Promise<EscrowItem | null> => {
    const raw = await escrowService.get(escrowId);
    return parseEscrow((raw as Record<string, unknown>) || null, escrowId);
  };

  /**
   * Refresh all escrows for the current user.
   * The edge function handles listing creator and beneficiary escrows.
   */
  const refreshEscrows = async () => {
    if (!address.get()) return;
    if (isRefreshing.get()) return;

    try {
      isRefreshing.set(true);

      // Fetch escrow list from the edge function via a get call
      // that returns both creator and beneficiary escrow IDs
      const creatorRaw = await escrowService.get(`creator:${address.get()}`);
      const beneficiaryRaw = await escrowService.get(`beneficiary:${address.get()}`);

      const creatorIds = Array.isArray(creatorRaw) ? creatorRaw.map(String) : [];
      const beneficiaryIds = Array.isArray(beneficiaryRaw) ? beneficiaryRaw.map(String) : [];

      const [creator, beneficiary] = await Promise.all([
        Promise.all(creatorIds.map(fetchEscrowDetails)),
        Promise.all(beneficiaryIds.map(fetchEscrowDetails)),
      ]);

      creatorEscrows.set(creator.filter(Boolean) as EscrowItem[]);
      beneficiaryEscrows.set(beneficiary.filter(Boolean) as EscrowItem[]);
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

    isCreating.set(true);
    try {
      // Step 1: Fund the escrow via PaymentProxy
      await paymentService.deposit(
        totalAmount.toString(),
        `escrow:create:${data.name.trim().slice(0, 60)}`,
      );

      // Step 2: Create the escrow via EscrowProxy
      await escrowService.create({
        beneficiary: data.beneficiary.trim(),
        amount: totalAmount.toString(),
        milestones: milestoneEntries,
      });

      await refreshEscrows();
    } finally {
      isCreating.set(false);
    }
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
