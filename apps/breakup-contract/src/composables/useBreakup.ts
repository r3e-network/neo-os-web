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

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { parseGas } from "@shared/utils/format";
import type { ContractStatus, RelationshipContractView } from "../types";

// ============================================================================
// Types
// ============================================================================

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());
const STORAGE_PREFIX = "contracts:";

/** Full os-storage index key for a single contract. */
const storageKey = (id: number): string => `${STORAGE_PREFIX}${id}`;

/**
 * Mint a stable numeric contract id. The OS escrow kernel never returns its own
 * assigned id to the client, so we derive one here and use it as BOTH the
 * os-storage index key suffix (`contracts:<id>`) AND the escrowId passed to
 * fund()/completeMilestone(). The contract id therefore IS the escrow id — an
 * invariant signContract/breakContract rely on via String(contract.id).
 */
const generateContractId = (): number => Date.now();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isOsBoundaryError(error: unknown) {
  return /OS service error|os-storage-|os-escrow-|os-badge-|Not Found|function not allowed|not configured|Unsupported method/i.test(
    errorMessage(error),
  );
}

function isWalletBoundaryError(error: unknown) {
  return /Wallet adapter|invokeWithConfirmation|Wallet address|required to submit|connect wallet|No wallet/i.test(
    errorMessage(error),
  );
}

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
  const partnerAddress = createObservable("");
  const stakeAmount = createObservable("");
  const duration = createObservable("");
  const contractTitle = createObservable("");
  const contractTerms = createObservable("");

  // -- Data state -----------------------------------------------------------
  const contracts = createObservable<RelationshipContractView[]>([]);
  const isLoading = createObservable(false);
  const serviceNotice = createObservable("");
  const actionNotice = createObservable("");
  const validationNotice = createObservable("");
  const lastSubmittedTitle = createObservable("");

  // -- Derived state --------------------------------------------------------
  const address = createObservable("");
  const contractCount = createDerived(() => contracts.get().length, []);
  const activeCount = createDerived(() => contracts.get().filter((c) => c.status === "active").length, []);
  const pendingCount = createDerived(() => contracts.get().filter((c) => c.status === "pending").length, []);
  const brokenCount = createDerived(() => contracts.get().filter((c) => c.status === "broken").length, []);

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

    const addr = address.get();
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
    isLoading.set(true);
    try {
      const contractMap = await storageService.list(STORAGE_PREFIX, 50);
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
      contracts.set(contractViews.sort((a, b) => b.id - a.id));
      serviceNotice.set("");
    } catch (e) {
      contracts.set([]);
      if (isOsBoundaryError(e)) {
        serviceNotice.set(t("contractIndexUnavailable"));
        return;
      }
      serviceNotice.set(t("loadFailed"));
      eventBus.emit("breakup:error", { message: t("loadFailed") });
    } finally {
      isLoading.set(false);
    }
  };

  // -- Actions (via OS services) --------------------------------------------

  /**
   * Create a relationship contract via EscrowProxy.create().
   * The edge function handles the GAS stake transfer + contract creation.
   */
  const createContract = async () => {
    if (isLoading.get()) return;

    const partnerValue = partnerAddress.get().trim();
    if (!partnerValue) throw new Error(t("partnerRequired"));
    if (!isValidNeoAddress(partnerValue)) throw new Error(t("partnerInvalid"));
    if (!stakeAmount.get()) throw new Error(t("stakeRequired"));

    const stake = parseFloat(stakeAmount.get());
    const durationDays = parseInt(duration.get(), 10);
    const titleValue = contractTitle.get().trim();
    const termsValue = contractTerms.get().trim();

    if (!Number.isFinite(stake) || stake < 1 || !Number.isFinite(durationDays) || durationDays < 30) {
      throw new Error(t("stakeOrDurationInvalid"));
    }
    if (!titleValue) throw new Error(t("titleRequired"));
    if (titleValue.length > 100) throw new Error(t("titleTooLong"));
    if (termsValue.length > 2000) throw new Error(t("termsTooLong"));

    validationNotice.set("");
    actionNotice.set(t("contractPreparing", { title: titleValue, amount: `${stakeAmount.get()} GAS` }));
    isLoading.set(true);
    try {
      // Create escrow with partner as beneficiary, stake as amount. The proxy
      // receives the human-decimal GAS string and scales by 10^8 itself.
      const nowSeconds = Math.floor(Date.now() / 1000);
      const durationSeconds = durationDays * 86400;
      const expirySeconds = nowSeconds + durationSeconds;
      await escrowService.create({
        beneficiary: partnerValue,
        amount: stakeAmount.get(),
        milestones: [
          { name: "relationship", amount: stakeAmount.get() },
        ],
        expiry: expirySeconds,
      });

      // Maintain the os-storage index that loadContracts() reads. The kernel
      // does not return its assigned id, so we mint a stable contract id (also
      // used as the escrowId for sign/break) and persist a full StoredContract
      // under the SAME prefix (contracts:<id>) the list reader consumes.
      const contractId = generateContractId();
      const creatorAddr = address.get();
      const stored: StoredContract = {
        id: contractId,
        party1: creatorAddr,
        party2: partnerValue,
        stake: Math.round(stake * 1e8),
        party1Signed: true,
        party2Signed: false,
        createdTime: nowSeconds,
        startTime: nowSeconds,
        duration: durationSeconds,
        signDeadline: expirySeconds,
        active: false,
        completed: false,
        cancelled: false,
        title: titleValue,
        terms: termsValue,
        milestonesReached: 0,
        totalPenaltyPaid: 0,
        breakupInitiator: "",
      };

      // The escrow is already created on-chain at this point, so a failure of
      // the index write would otherwise strand the stake in an escrow the UI
      // can never surface (the contracts: list would never include it). Roll
      // the escrow back via refund() before propagating the failure. The
      // contractId IS the escrowId by invariant (see generateContractId), so
      // refund(String(contractId)) targets the escrow we just created.
      try {
        await storageService.set(storageKey(contractId), stored);
      } catch (storageError) {
        try {
          await escrowService.refund(String(contractId));
        } catch (refundError) {
          // Compensation failed too: the stake is still escrowed but the index
          // write failed. Surface a distinct, actionable error so the user
          // knows the funds are recoverable rather than lost.
          const recoverable = new Error(
            t("contractCreateFundsRecoverable", { id: contractId }),
          );
          actionNotice.set(recoverable.message);
          throw recoverable;
        }
        // Refund succeeded: the on-chain stake was returned, so report the
        // create as failed (not a misleading success) and re-throw.
        throw storageError;
      }

      eventBus.emit("breakup:created", { action: t("contractCreated") });

      // Hint badge for relationship contract (fire-and-forget)
      badgeService.award("relationship-contract", "").catch(() => {});

      // Reset form
      partnerAddress.set("");
      stakeAmount.set("");
      duration.set("");
      contractTitle.set("");
      contractTerms.set("");
      lastSubmittedTitle.set(titleValue);
      actionNotice.set(t("contractSubmitted", { title: titleValue }));

      await loadContracts();
    } catch (e) {
      if (isOsBoundaryError(e)) {
        const normalized = new Error(t("contractActionUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      if (isWalletBoundaryError(e)) {
        const normalized = new Error(t("contractWalletUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Sign a contract via EscrowProxy.fund().
   * The edge function handles the matching stake transfer + sign contract call.
   */
  const signContract = async (contract: { id: number; stake: number }) => {
    if (isLoading.get()) return;

    actionNotice.set(t("contractSigning", { id: contract.id }));
    isLoading.set(true);
    try {
      await escrowService.fund(String(contract.id));

      eventBus.emit("breakup:signed", { action: t("contractSigned") });
      actionNotice.set(t("contractSigned"));
      await loadContracts();
    } catch (e) {
      if (isOsBoundaryError(e)) {
        const normalized = new Error(t("contractActionUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      if (isWalletBoundaryError(e)) {
        const normalized = new Error(t("contractWalletUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Break a contract via EscrowProxy.completeMilestone().
   * The edge function handles the triggerBreakup contract call.
   */
  const breakContract = async (contract: { id: number }) => {
    if (isLoading.get()) return;

    actionNotice.set(t("contractBreaking", { id: contract.id }));
    isLoading.set(true);
    try {
      await escrowService.completeMilestone(String(contract.id), 0);

      eventBus.emit("breakup:broken", { action: t("contractBroken") });
      actionNotice.set(t("contractBroken"));
      await loadContracts();
    } catch (e) {
      if (isOsBoundaryError(e)) {
        const normalized = new Error(t("contractActionUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      if (isWalletBoundaryError(e)) {
        const normalized = new Error(t("contractWalletUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      throw e;
    } finally {
      isLoading.set(false);
    }
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
    serviceNotice,
    actionNotice,
    validationNotice,
    lastSubmittedTitle,

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
