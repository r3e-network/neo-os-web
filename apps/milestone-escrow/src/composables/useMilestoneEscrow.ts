/**
 * useMilestoneEscrow — Domain logic for the Milestone Escrow miniapp
 *
 * This composable encapsulates all escrow business logic and provides
 * reactive state for the platform to bind to manifest-driven UI sections.
 *
 * Compared with the legacy useEscrowContract.ts:
 *
 *   BEFORE (legacy):
 *     - Manually wires useContractInteraction + useStatusMessage + useWallet
 *     - Builds sidebar items, formats error messages, manages wallet directly
 *     - Contains ~330 lines of mixed infrastructure + business logic
 *
 *   AFTER (this file):
 *     - Receives ChainService + BalanceService + EventBus from PlatformServices
 *     - Contains ONLY escrow domain logic (load, create, approve, claim, cancel)
 *     - Sidebar, stats, status messages are all driven by manifest + platform
 *     - Clean separation: business logic only, no infrastructure plumbing
 *
 * Key design decisions:
 *   - No onMounted/onUnmounted — lifecycle is managed by defineMiniApp
 *   - No usePlatformServices() inject — services are passed in explicitly
 *   - Formatted values are provided as computed refs for manifest bindings
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatGas, formatAddress } from "@shared/utils/format";
import { normalizeScriptHash } from "@shared/utils/neo";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { EscrowItem } from "../pages/index/components/EscrowList.vue";

// ============================================================================
// Constants
// ============================================================================

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);

/** Maximum number of escrows to fetch per query */
const FETCH_LIMIT = 20;

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
  /** ChainService instance from PlatformServices */
  chain: ChainService;
  /** EventBus instance from PlatformServices */
  eventBus: EventBus;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

const parseBoolArray = (value: unknown, count: number): boolean[] => {
  if (!Array.isArray(value)) return new Array(count).fill(false);
  return value.map((item) => parseBool(item));
};

const parseBigIntArray = (value: unknown, count: number): bigint[] => {
  if (!Array.isArray(value)) return new Array(count).fill(0n);
  return value.map((item) => parseBigInt(item));
};

const parseEscrow = (raw: Record<string, unknown> | null, id: string): EscrowItem | null => {
  if (!raw || typeof raw !== "object") return null;

  const asset = String(raw.asset || "");
  const assetNormalized = normalizeScriptHash(asset);
  const assetSymbol: "NEO" | "GAS" = assetNormalized === NEO_HASH_NORMALIZED ? "NEO" : "GAS";
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

export function useMilestoneEscrow({ chain, eventBus, t }: UseMilestoneEscrowOptions) {
  // ── Reactive State ────────────────────────────────────────────────────
  const creatorEscrows = ref<EscrowItem[]>([]);
  const beneficiaryEscrows = ref<EscrowItem[]>([]);
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isCreating = ref(false);
  const approvingId = ref<string | null>(null);
  const claimingId = ref<string | null>(null);
  const cancellingId = ref<string | null>(null);

  // ── Computed (manifest stat/sidebar bindings) ─────────────────────────
  const creatorEscrowCount = computed(() => creatorEscrows.value.length);
  const beneficiaryEscrowCount = computed(() => beneficiaryEscrows.value.length);
  const activeCount = computed(() =>
    creatorEscrows.value.filter((e) => e.status === "active").length,
  );
  const completedCount = computed(() =>
    creatorEscrows.value.filter((e) => e.status === "completed").length,
  );

  // Contract readiness: true once we can resolve a contract address
  const contractReady = computed(() => Boolean(chain.address.value));

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

  // ── Data Loading ──────────────────────────────────────────────────────

  const fetchEscrowIds = async (operation: string, walletAddress: string): Promise<string[]> => {
    const parsed = await chain.read(operation, [
      { type: "Hash160", value: walletAddress },
      { type: "Integer", value: "0" },
      { type: "Integer", value: String(FETCH_LIMIT) },
    ]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value || ""))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchEscrowDetails = async (escrowId: string): Promise<EscrowItem | null> => {
    const parsed = await chain.read("GetEscrowDetails", [
      { type: "Integer", value: escrowId },
    ]) as Record<string, unknown>;
    return parseEscrow(parsed, escrowId);
  };

  const refreshEscrows = async () => {
    if (!chain.address.value) return;
    if (isRefreshing.value) return;

    try {
      isRefreshing.value = true;

      const [creatorIds, beneficiaryIds] = await Promise.all([
        fetchEscrowIds("getCreatorEscrows", chain.address.value),
        fetchEscrowIds("getBeneficiaryEscrows", chain.address.value),
      ]);

      const [creator, beneficiary] = await Promise.all([
        Promise.all(creatorIds.map(fetchEscrowDetails)),
        Promise.all(beneficiaryIds.map(fetchEscrowDetails)),
      ]);

      creatorEscrows.value = creator.filter(Boolean) as EscrowItem[];
      beneficiaryEscrows.value = beneficiary.filter(Boolean) as EscrowItem[];
    } catch (e) {
      console.warn("[useMilestoneEscrow] refreshEscrows failed:", e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      isRefreshing.value = false;
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.value = true;
    try {
      await refreshEscrows();
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────

  /**
   * Create a new milestone-based escrow.
   */
  const createEscrow = async (data: CreateEscrowParams) => {
    if (isCreating.value) return;

    if (data.milestones.length < 1 || data.milestones.length > MAX_MILESTONES) {
      throw new Error(t("milestoneLimit"));
    }

    const decimals = data.asset === "NEO" ? 0 : 8;
    const milestoneValues: string[] = [];
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
      milestoneValues.push(amount.toString());
      totalAmount += amount;
    }

    if (totalAmount <= 0n) {
      throw new Error(t("invalidAmount"));
    }

    isCreating.value = true;
    try {
      await chain.ensureWallet();

      const assetHash = data.asset === "NEO"
        ? BLOCKCHAIN_CONSTANTS.NEO_HASH
        : BLOCKCHAIN_CONSTANTS.GAS_HASH;

      const title = data.name.trim().slice(0, 60);
      const notes = data.notes.trim().slice(0, 240);

      const result = await chain.invoke(
        "CreateEscrow",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: data.beneficiary.trim() },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: totalAmount.toString() },
          {
            type: "Array",
            value: milestoneValues.map((amount) => ({ type: "Integer", value: amount })),
          } as unknown as { type: "Array"; value: string },
          { type: "String", value: title },
          { type: "String", value: notes },
        ],
        { waitForEvent: "EscrowCreated" },
      );

      if (result.success) {
        eventBus.emit("escrow:created", { action: t("escrowCreated") });
      }

      await refreshEscrows();
    } finally {
      isCreating.value = false;
    }
  };

  /**
   * Approve a milestone (creator action).
   */
  const approveMilestone = async (escrow: EscrowItem, milestoneIndex?: number) => {
    if (approvingId.value) return;

    // If called from PlayArea with just the escrow object, find next unapproved milestone
    const idx = milestoneIndex ?? escrow.milestoneApproved.findIndex((approved: boolean) => !approved);
    if (idx < 0) return;

    try {
      approvingId.value = `${escrow.id}-${idx}`;
      await chain.ensureWallet();

      const result = await chain.invoke(
        "ApproveMilestone",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: escrow.id },
          { type: "Integer", value: String(idx) },
        ],
        { waitForEvent: "MilestoneApproved" },
      );

      if (result.success) {
        eventBus.emit("escrow:milestoneApproved", {
          escrowId: escrow.id,
          milestoneIndex: idx,
        });
      }

      await refreshEscrows();
    } finally {
      approvingId.value = null;
    }
  };

  /**
   * Claim funds for an approved milestone (beneficiary action).
   */
  const claimMilestone = async (escrow: EscrowItem, milestoneIndex?: number) => {
    if (claimingId.value) return;

    // Find next approved-but-unclaimed milestone
    const idx = milestoneIndex ?? escrow.milestoneApproved.findIndex(
      (approved: boolean, i: number) => approved && !escrow.milestoneClaimed[i],
    );
    if (idx < 0) return;

    try {
      claimingId.value = `${escrow.id}-${idx}`;
      await chain.ensureWallet();

      const result = await chain.invoke(
        "ClaimMilestone",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: escrow.id },
          { type: "Integer", value: String(idx) },
        ],
        { waitForEvent: "MilestoneClaimed" },
      );

      if (result.success) {
        eventBus.emit("escrow:milestoneClaimed", {
          escrowId: escrow.id,
          milestoneIndex: idx,
        });
      }

      await refreshEscrows();
    } finally {
      claimingId.value = null;
    }
  };

  /**
   * Cancel an escrow and return funds to creator.
   */
  const cancelEscrow = async (escrow: EscrowItem) => {
    if (cancellingId.value) return;

    try {
      cancellingId.value = escrow.id;
      await chain.ensureWallet();

      const result = await chain.invoke(
        "CancelEscrow",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: escrow.id },
        ],
        { waitForEvent: "EscrowCancelled" },
      );

      if (result.success) {
        eventBus.emit("escrow:cancelled", { escrowId: escrow.id });
      }

      await refreshEscrows();
    } finally {
      cancellingId.value = null;
    }
  };

  /**
   * Connect wallet and load escrows.
   */
  const connectWallet = async () => {
    await chain.ensureWallet();
    if (chain.address.value) {
      await refreshEscrows();
    }
  };

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = () => {
    creatorEscrows.value = [];
    beneficiaryEscrows.value = [];
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
  };
}

/** Return type of useMilestoneEscrow for external typing */
export type UseMilestoneEscrowReturn = ReturnType<typeof useMilestoneEscrow>;
