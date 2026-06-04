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
 * Mint a stable numeric contract id used ONLY as the os-storage index key
 * suffix (`contracts:<id>`). This is a local, client-side record id and is
 * deliberately NOT reused as the on-chain escrow id: the kernel assigns its
 * own sequential escrow id (MiniAppMilestoneEscrow CreateEscrow returns
 * `TotalEscrows() + 1`), which we capture separately and persist as
 * StoredContract.escrowId. All escrow operations (fund/complete/refund) target
 * that captured kernel escrowId, never the storage-key id.
 */
const generateContractId = (): number => Date.now();

/**
 * Extract the kernel-assigned escrow id from whatever `escrowService.create()`
 * resolves to, when it is available. The os-escrow-create edge function emits a
 * `CreateEscrow` intent; in environments that reconcile the executed return
 * value the proxy surfaces the sequential escrow id as a bare string/number or
 * wrapped in an object (`{ escrowId }`, `{ id }`). In the standard wallet-relay
 * path, however, the signed-but-unconfirmed invocation only yields `{ txid }`
 * (the post-execution stack is not known until the tx mines), so this returns
 * null and the caller falls back to the local storage-key id, advancing the
 * lifecycle optimistically and overlaying authoritative state via
 * `escrowService.get()` once it resolves. Anything that is not a
 * positive-integer-looking id therefore yields null by design.
 */
const extractEscrowId = (result: unknown): string | null => {
  const fromScalar = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return String(Math.trunc(value));
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed) && trimmed !== "0") return trimmed;
    }
    return null;
  };

  const scalar = fromScalar(result);
  if (scalar) return scalar;

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    return (
      fromScalar(obj.escrowId) ??
      fromScalar(obj.escrow_id) ??
      fromScalar(obj.id) ??
      null
    );
  }
  return null;
};

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
  /**
   * The kernel-assigned escrow id (sequential, from CreateEscrow). This is the
   * canonical id every escrow operation targets — distinct from `id`, which is
   * only the os-storage index suffix. Optional for backward compatibility with
   * records written before this field existed; absence falls back to `id`.
   */
  escrowId?: string;
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

  /**
   * Live escrow snapshot read from escrowService.get(escrowId). Only the fields
   * that advance the relationship lifecycle are consumed; everything else falls
   * back to the static creation record. `funded`/`active` flips pending→active
   * once party2 signs (escrow.fund), `completed` flips active→broken once the
   * milestone is completed (escrow.complete).
   */
  interface LiveEscrowState {
    funded?: boolean;
    active?: boolean;
    completed?: boolean;
    cancelled?: boolean;
  }

  const parseContract = (
    data: StoredContract,
    live?: LiveEscrowState,
  ): RelationshipContractView | null => {
    if (!data || typeof data !== "object") return null;

    const party1 = String(data.party1 ?? "");
    const party2 = String(data.party2 ?? "");
    const stakeRaw = String(data.stake ?? "0");
    // The live escrow state (kernel source of truth) takes precedence over the
    // write-once creation snapshot so the status lifecycle actually advances
    // after sign/break instead of being frozen at 'pending'.
    const party2Signed = Boolean(live?.funded ?? data.party2Signed);
    const startTimeSeconds = Number(data.startTime ?? 0);
    const durationSeconds = Number(data.duration ?? 0);
    const active = Boolean(live?.active ?? data.active);
    const completed = Boolean(live?.completed ?? data.completed);
    const cancelled = Boolean(live?.cancelled ?? data.cancelled);
    const title = String(data.title ?? "");
    const terms = String(data.terms ?? "");
    const escrowId = data.escrowId ? String(data.escrowId) : String(data.id);

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
      escrowId,
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

  /**
   * Read the live escrow lifecycle flags for a contract from the kernel via
   * escrowService.get(escrowId). Returns undefined on any boundary/parse error
   * so the caller falls back to the static creation snapshot rather than
   * dropping the contract from the list.
   */
  const fetchLiveEscrowState = async (
    escrowId: string,
  ): Promise<LiveEscrowState | undefined> => {
    if (!escrowId || !/^\d+$/.test(escrowId)) return undefined;
    try {
      const raw = await escrowService.get(escrowId);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
      const obj = raw as Record<string, unknown>;
      return {
        funded: obj.funded != null ? Boolean(obj.funded) : undefined,
        active: obj.active != null ? Boolean(obj.active) : undefined,
        completed: obj.completed != null ? Boolean(obj.completed) : undefined,
        cancelled: obj.cancelled != null ? Boolean(obj.cancelled) : undefined,
      };
    } catch {
      // Live hydration is best-effort: never let a single escrow read failure
      // wipe the whole list. The static snapshot still renders the contract.
      return undefined;
    }
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
      const storedRecords: StoredContract[] = [];
      if (contractMap && typeof contractMap === "object") {
        for (const [, value] of Object.entries(contractMap)) {
          const stored = value as StoredContract;
          if (stored && stored.id) storedRecords.push(stored);
        }
      }
      // Hydrate live escrow state per record so status advances past the
      // write-once creation snapshot (sign -> active, break -> broken). Reads
      // run in parallel and are individually fault-tolerant.
      const liveStates = await Promise.all(
        storedRecords.map((stored) =>
          fetchLiveEscrowState(stored.escrowId ? String(stored.escrowId) : String(stored.id)),
        ),
      );
      const contractViews: RelationshipContractView[] = [];
      storedRecords.forEach((stored, index) => {
        const view = parseContract(stored, liveStates[index]);
        if (view) contractViews.push(view);
      });
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
      // receives the human-decimal GAS string and scales by 10^8 itself, and
      // resolves to the kernel-assigned escrow id (CreateEscrow returns the
      // sequential TotalEscrows()+1). Capture it as the canonical id for
      // sign/break/refund — the storage-key id below is only a local index.
      const nowSeconds = Math.floor(Date.now() / 1000);
      const durationSeconds = durationDays * 86400;
      const expirySeconds = nowSeconds + durationSeconds;
      const createResult = await escrowService.create({
        beneficiary: partnerValue,
        amount: stakeAmount.get(),
        milestones: [
          { name: "relationship", amount: stakeAmount.get() },
        ],
        expiry: expirySeconds,
      });

      // Maintain the os-storage index that loadContracts() reads. The kernel
      // assigns its OWN sequential escrow id (returned above); persist THAT as
      // the canonical escrowId. The storage-key id is a separate local index so
      // the two are never conflated. If the create response did not surface a
      // usable escrow id (e.g. a wallet-less standalone render that only yields
      // a txid), fall back to the storage-key id to keep the record listable.
      const contractId = generateContractId();
      const resolvedEscrowId = extractEscrowId(createResult) ?? String(contractId);
      const creatorAddr = address.get();
      const stored: StoredContract = {
        id: contractId,
        escrowId: resolvedEscrowId,
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
      // the escrow back via refund() before propagating the failure, targeting
      // the kernel-assigned escrow id we captured above (resolvedEscrowId), not
      // the local storage-key id.
      try {
        await storageService.set(storageKey(contractId), stored);
      } catch (storageError) {
        try {
          await escrowService.refund(resolvedEscrowId);
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
   * Resolve the canonical kernel escrow id for a contract action. Newer views
   * carry `escrowId`; fall back to the stringified storage id for legacy
   * records or test callers that only pass `{ id }`.
   */
  const resolveEscrowId = (contract: { id: number; escrowId?: string }): string =>
    contract.escrowId && /^\d+$/.test(String(contract.escrowId))
      ? String(contract.escrowId)
      : String(contract.id);

  /**
   * Optimistically patch the stored creation snapshot after a successful escrow
   * mutation so the lifecycle advances even if the live escrow read is delayed
   * or unavailable. Best-effort: a write failure is swallowed because the next
   * loadContracts() hydrates authoritative state from escrowService.get().
   */
  const patchStoredContract = async (
    id: number,
    patch: Partial<StoredContract>,
  ): Promise<void> => {
    try {
      const existing = (await storageService.get(storageKey(id))) as
        | StoredContract
        | null
        | undefined;
      if (existing && typeof existing === "object") {
        await storageService.set(storageKey(id), { ...existing, ...patch });
      }
    } catch {
      // Non-fatal: live hydration in loadContracts() is the source of truth.
    }
  };

  /**
   * Sign a contract via EscrowProxy.fund().
   * The edge function handles the matching stake transfer + sign contract call.
   */
  const signContract = async (contract: { id: number; stake: number; escrowId?: string }) => {
    if (isLoading.get()) return;

    actionNotice.set(t("contractSigning", { id: contract.id }));
    isLoading.set(true);
    try {
      await escrowService.fund(resolveEscrowId(contract));

      // Advance the stored lifecycle pending -> active so the card flips to the
      // signed state and exposes Break (loadContracts re-hydrates live state).
      await patchStoredContract(contract.id, { party2Signed: true, active: true });

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
  const breakContract = async (contract: { id: number; escrowId?: string }) => {
    if (isLoading.get()) return;

    actionNotice.set(t("contractBreaking", { id: contract.id }));
    isLoading.set(true);
    try {
      await escrowService.completeMilestone(resolveEscrowId(contract), 0);

      // Advance the stored lifecycle active -> broken (completed) so the card
      // reflects the terminal state immediately.
      await patchStoredContract(contract.id, { active: false, completed: true });

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
