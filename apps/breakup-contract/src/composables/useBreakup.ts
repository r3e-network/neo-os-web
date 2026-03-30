/**
 * useBreakup — Domain logic for the Breakup Contract miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (EscrowProxy, StorageProxy, BadgeProxy) via edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.listAllEvents("ContractCreated")
 *     chain.read("getContractDetails", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("createContract", [...])
 *     chain.invoke("signContract", [...])
 *     chain.invoke("triggerBreakup", [...])
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.list("contracts:", 50)
 *     storageService.get("contract:<id>")
 *     escrowService.create({ ... })          — create contract with stake
 *     escrowService.fund(escrowId)           — sign/stake matching amount
 *     escrowService.completeMilestone(id, 0) — trigger breakup
 *     badgeService.award("relationship-contract", "")
 */

import { ref, computed } from "vue";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { parseGas } from "@shared/utils/format";
import type { ContractStatus, RelationshipContractView } from "../types";

// ============================================================================
// Types
// ============================================================================

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

export interface UseBreakupOptions {
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

interface StoredContract {
  id: number;
  party1: string;
  party2: string;
  stake: string | number;
  party1Signed: boolean;
  party2Signed: boolean;
  createdTime: number;
  startTime: number;
  duration: number;
  signDeadline: number;
  active: boolean;
  completed: boolean;
  cancelled: boolean;
  title: string;
  terms: string;
  milestonesReached: number;
  totalPenaltyPaid: number;
  breakupInitiator: string;
  progressPercent?: number;
  remainingTime?: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useBreakup({
  escrowService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseBreakupOptions) {
  // -- Form state -----------------------------------------------------------
  const partnerAddress = ref("");
  const stakeAmount = ref("");
  const duration = ref("");
  const contractTitle = ref("");
  const contractTerms = ref("");

  // -- Data state -----------------------------------------------------------
  const contracts = ref<RelationshipContractView[]>([]);
  const isLoading = ref(false);

  // -- Derived state --------------------------------------------------------
  const address = ref("");
  const contractCount = computed(() => contracts.value.length);
  const activeCount = computed(() => contracts.value.filter((c) => c.status === "active").length);
  const pendingCount = computed(() => contracts.value.filter((c) => c.status === "pending").length);
  const brokenCount = computed(() => contracts.value.filter((c) => c.status === "broken").length);

  // -- Helpers --------------------------------------------------------------

  const parseContract = (
    data: StoredContract,
  ): RelationshipContractView | null => {
    if (!data || typeof data !== "object") return null;

    const party1 = String(data.party1 ?? "");
    const party2 = String(data.party2 ?? "");
    const stakeRaw = String(data.stake ?? "0");
    const party2Signed = Boolean(data.party2Signed);
    const startTimeSeconds = Number(data.startTime ?? 0);
    const durationSeconds = Number(data.duration ?? 0);
    const active = Boolean(data.active);
    const completed = Boolean(data.completed);
    const cancelled = Boolean(data.cancelled);
    const title = String(data.title ?? "");
    const terms = String(data.terms ?? "");

    const startTimeMs = startTimeSeconds * 1000;
    const durationMs = durationSeconds * 1000;
    const now = Date.now();
    const endTime = startTimeMs + durationMs;
    const elapsed = startTimeMs > 0 ? Math.max(0, Math.min(durationMs, now - startTimeMs)) : 0;
    const computedProgress = durationMs > 0 ? Math.round((elapsed / durationMs) * 100) : 0;
    const progressPercent = Number(data.progressPercent ?? 0);
    const progress = progressPercent > 0 ? Math.min(100, Math.max(0, Math.floor(progressPercent))) : computedProgress;
    const remainingSeconds = Number(data.remainingTime ?? 0);
    const daysLeft =
      remainingSeconds > 0
        ? Math.max(0, Math.ceil(remainingSeconds / 86400))
        : durationMs > 0
          ? Math.max(0, Math.ceil((endTime - now) / 86400000))
          : 0;

    let contractStatus: ContractStatus = "pending";
    if (active) contractStatus = "active";
    else if (completed) contractStatus = "broken";
    else if (party2Signed || cancelled) contractStatus = "ended";

    const addr = address.value;
    const partner = addr && addr === party1 ? party2 : party1;

    return {
      id: Number(data.id),
      party1,
      party2,
      partner,
      title,
      terms,
      stake: parseGas(stakeRaw),
      stakeRaw,
      progress,
      daysLeft,
      status: contractStatus,
    };
  };

  // -- Data loading (via StorageProxy) --------------------------------------

  /**
   * Load all contracts via StorageProxy.list().
   * The edge function handles the contract reads and event parsing.
   */
  const loadContracts = async () => {
    isLoading.value = true;
    try {
      const contractMap = await storageService.list("contracts:", 50);
      const contractViews: RelationshipContractView[] = [];
      if (contractMap && typeof contractMap === "object") {
        for (const [, value] of Object.entries(contractMap)) {
          const stored = value as StoredContract;
          if (stored && stored.id) {
            const view = parseContract(stored);
            if (view) contractViews.push(view);
          }
        }
      }
      contracts.value = contractViews.sort((a, b) => b.id - a.id);
    } catch (e) {
      eventBus.emit("breakup:error", { message: e instanceof Error ? e.message : t("loadFailed") });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  // -- Actions (via OS services) --------------------------------------------

  /**
   * Create a relationship contract via EscrowProxy.create().
   * The edge function handles the GAS stake transfer + contract creation.
   */
  const createContract = async () => {
    if (isLoading.value) return;

    const partnerValue = partnerAddress.value.trim();
    if (!partnerValue) throw new Error(t("partnerRequired"));
    if (!isValidNeoAddress(partnerValue)) throw new Error(t("partnerInvalid"));
    if (!stakeAmount.value) throw new Error(t("error"));

    const stake = parseFloat(stakeAmount.value);
    const durationDays = parseInt(duration.value, 10);
    const titleValue = contractTitle.value.trim();
    const termsValue = contractTerms.value.trim();

    if (!Number.isFinite(stake) || stake < 1 || !Number.isFinite(durationDays) || durationDays < 30) {
      throw new Error(t("error"));
    }
    if (!titleValue) throw new Error(t("titleRequired"));
    if (titleValue.length > 100) throw new Error(t("titleTooLong"));
    if (termsValue.length > 2000) throw new Error(t("termsTooLong"));

    // Create escrow with partner as beneficiary, stake as amount
    const expirySeconds = Math.floor(Date.now() / 1000) + durationDays * 86400;
    await escrowService.create({
      beneficiary: partnerValue,
      amount: stakeAmount.value,
      milestones: [
        { name: "relationship", amount: stakeAmount.value },
      ],
      expiry: expirySeconds,
    });

    // Store contract metadata
    await storageService.set(`contract-meta:${Date.now()}`, {
      partner: partnerValue,
      title: titleValue,
      terms: termsValue,
      durationDays,
    });

    eventBus.emit("breakup:created", { action: t("contractCreated") });

    // Hint badge for relationship contract (fire-and-forget)
    badgeService.award("relationship-contract", "").catch(() => {});

    // Reset form
    partnerAddress.value = "";
    stakeAmount.value = "";
    duration.value = "";
    contractTitle.value = "";
    contractTerms.value = "";

    await loadContracts();
  };

  /**
   * Sign a contract via EscrowProxy.fund().
   * The edge function handles the matching stake transfer + sign contract call.
   */
  const signContract = async (contract: { id: number; stake: number }) => {
    if (isLoading.value) return;

    await escrowService.fund(String(contract.id));

    eventBus.emit("breakup:signed", { action: t("contractSigned") });
    await loadContracts();
  };

  /**
   * Break a contract via EscrowProxy.completeMilestone().
   * The edge function handles the triggerBreakup contract call.
   */
  const breakContract = async (contract: { id: number }) => {
    await escrowService.completeMilestone(String(contract.id), 0);

    eventBus.emit("breakup:broken", { action: t("contractBroken") });
    await loadContracts();
  };

  return {
    // Wallet state
    address,

    // Form state
    partnerAddress,
    stakeAmount,
    duration,
    contractTitle,
    contractTerms,

    // Data state
    contracts,
    isLoading,

    // Derived state
    contractCount,
    activeCount,
    pendingCount,
    brokenCount,

    // Methods
    loadContracts,
    createContract,
    signContract,
    breakContract,
  };
}

export type UseBreakupReturn = ReturnType<typeof useBreakup>;
