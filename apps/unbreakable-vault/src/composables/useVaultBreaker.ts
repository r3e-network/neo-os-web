/**
 * useVaultBreaker — Vault listing, break attempts, and expired-vault reclaim
 *
 * Talks DIRECTLY to the standalone MiniAppUnbreakableVault contract via the
 * MiniApp framework (ctx.framework / app.chain). The earlier path read vault
 * state through ctx.os.storage, awarded badges through ctx.os.badge, and
 * "claimed" bounties through non-existent contract methods — all backed by the
 * offline Morpheus OS kernel.
 *
 * Contract interaction model (verified against the deployed ABI at
 * 0x78fbd57ccfae14fff4b043a82eb491de542d8eb0 + the live-validate harness):
 *
 *   READS (chain.read, default app contract script hash):
 *     totalVaults()              -> Integer (vaults are ids 1..totalVaults)
 *     getVaultDetails(vaultId)   -> Map (normalized in vaultChain.ts)
 *
 *   ATTEMPT (deposit-then-act):
 *     1. transfer(attacker, CONTRACT, attemptFeeBaseUnits,
 *        "miniapp-unbreakablevault:attempt") { scriptHash: GAS_HASH } — the
 *        OnNEP17Payment handler credits the prepaid attempt fee.
 *     2. attemptBreak(vaultId, attacker, secretBytes) -> Boolean. The outcome is
 *        read from the "AttemptMade" event: AttemptMade(vaultId, attacker,
 *        success, attemptNumber). On success the contract pays the bounty to the
 *        attacker ATOMICALLY (event "VaultBroken") — there is no separate claim.
 *
 *   RECLAIM (no payment — the escrow already holds the bounty):
 *     claimExpiredVault(vaultId) — refunds the creator once the vault has passed
 *     its expiry without being broken (status "claimable"). Event "VaultExpired".
 *
 * AMOUNT CONVENTION: attempt fee + bounty are GAS in BASE UNITS (1e8 per GAS).
 * getVaultDetails().attemptFee is already a base-unit integer.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { formatGas } from "@shared/utils/format";
import {
  ATTEMPT_MEMO,
  MAX_RECENT_VAULTS,
  isContractAddressUnavailableError,
  readRecentVaultDetails,
  readVaultDetails,
  type ChainVaultDetails,
} from "./vaultChain";
import {
  VaultVerificationError,
  VAULT_EVENT_WAIT_MS,
  requireCanonicalVaultContext,
  requireWritableVaultContext,
  utf8ToBase64,
  type PendingVaultOperation,
  type VaultFinalization,
} from "./vaultSafety";
import type { createVaultSafety } from "./vaultSafety";

// ============================================================================
// Types
// ============================================================================

export interface VaultDetails {
  id: string;
  creator: string;
  /** GAS base units. */
  bounty: string;
  attempts: number;
  broken: boolean;
  expired: boolean;
  status: string;
  winner: string;
  /** GAS base units. */
  attemptFee: string;
  difficultyName: string;
  expiryTime: number;
  remainingDays: number;
  /** Creator-set title — the name of what the challenger is trying to break. */
  title: string;
  /** Creator-set public hint / lore shown to challengers before they pay. */
  description: string;
}

export interface RecentVault {
  id: string;
  creator: string;
  /** GAS base units. */
  bounty: string;
  status: string;
}

export interface UseVaultBreakerOptions {
  /** MiniApp framework (ctx.framework) for wallet-signed contract calls + reads. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string) => string;
  safety: ReturnType<typeof createVaultSafety>;
}

export type VaultAttemptOutcome =
  | { status: "confirmed"; broken: boolean; finalization: VaultFinalization }
  | { status: "pending"; pending: PendingVaultOperation };

export type VaultReclaimOutcome =
  | { status: "confirmed"; finalization: VaultFinalization }
  | { status: "pending"; pending: PendingVaultOperation };

// ============================================================================
// Helpers
// ============================================================================

/** Milliseconds in one day — vault times are unix epoch milliseconds. */
const DAY_MS = 86_400_000;

function remainingDaysFrom(expiryTimeMs: number): number {
  if (!Number.isFinite(expiryTimeMs) || expiryTimeMs <= 0) return 0;
  const remaining = expiryTimeMs - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

function toVaultDetails(detail: ChainVaultDetails): VaultDetails {
  return {
    id: detail.id,
    creator: detail.creator,
    bounty: detail.bounty,
    attempts: detail.attemptCount,
    broken: detail.broken,
    expired: detail.expired,
    status: detail.status,
    winner: detail.winner,
    attemptFee: detail.attemptFee,
    difficultyName: detail.difficultyName,
    expiryTime: detail.expiryTime,
    remainingDays: remainingDaysFrom(detail.expiryTime),
    title: detail.title,
    description: detail.description,
  };
}

function toRecentVault(detail: ChainVaultDetails): RecentVault {
  return {
    id: detail.id,
    creator: detail.creator,
    bounty: detail.bounty,
    status: detail.status,
  };
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultBreaker({
  app,
  t,
  safety,
}: UseVaultBreakerOptions) {
  const vaultIdInput = createObservable("");
  const attemptSecret = createObservable("");
  const vaultDetails = createObservable<VaultDetails | null>(null);
  const recentVaults = createObservable<RecentVault[]>([]);
  const catalogReadError = createObservable("");
  const isLoading = createObservable(false);
  const isClaiming = createObservable(false);
  let vaultLoadEpoch = 0;
  let recentLoadEpoch = 0;

  const canAttempt = createDerived(() => {
    const vault = vaultDetails.get();
    const st = vault?.status;
    return Boolean(
      vaultIdInput.get() &&
      attemptSecret.get().trim() &&
      vault &&
      String(vault.id) === String(vaultIdInput.get()) &&
      /^\d+$/.test(vault.attemptFee) &&
      BigInt(vault.attemptFee) > 0n &&
      st === "active",
    );
  }, [vaultIdInput, attemptSecret, vaultDetails]);

  /**
   * The current wallet may reclaim the escrowed bounty when the loaded vault has
   * passed its expiry unbroken (status "claimable") and they are its creator.
   * Reactive on both the loaded vault and the connected wallet address.
   */
  const canReclaim = createDerived(() => {
    const vault = vaultDetails.get();
    if (!vault) return false;
    const wallet = app.chain.address.get();
    if (!wallet) return false;
    const reclaimable =
      vault.status === "claimable" || vault.status === "expired";
    const hasEscrow = /^\d+$/.test(vault.bounty) && BigInt(vault.bounty) > 0n;
    return (
      reclaimable &&
      hasEscrow &&
      Boolean(vault.creator) &&
      ownerMatchesAddress(vault.creator, wallet)
    );
  }, [vaultDetails, app.chain.address]);

  /**
   * Resolve the effective attempt fee (base units) for the loaded vault.
   *
   * getVaultDetails().attemptFee is already a base-unit integer set by the
   * contract from the vault's difficulty tier. Treat any non-positive value as
   * missing and fall back to the Easy-tier default (0.1 GAS).
   */
  const resolveAttemptFeeBase = (): string => {
    const fee = vaultDetails.get()?.attemptFee;
    if (fee && /^\d+$/.test(fee) && BigInt(fee) > 0n) return fee;
    return "";
  };

  const attemptFeeDisplay = createDerived(() => {
    const fee = resolveAttemptFeeBase();
    return fee ? formatGas(fee) : "";
  }, [vaultDetails]);

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load the newest vaults straight from the contract. Replaces the old
   * os.storage list entirely.
   */
  const loadRecentVaults = async () => {
    const epoch = ++recentLoadEpoch;
    try {
      const context = await requireCanonicalVaultContext(app, t("chainContextMismatch"));
      const details = await readRecentVaultDetails(
        app,
        MAX_RECENT_VAULTS,
        context.contractHash,
      );
      const current = await requireCanonicalVaultContext(app, t("chainContextMismatch"));
      if (
        epoch !== recentLoadEpoch
        || current.network !== context.network
        || current.contractHash !== context.contractHash
      ) return;
      recentVaults.set(details.map(toRecentVault));
      catalogReadError.set("");
    } catch (e) {
      if (epoch !== recentLoadEpoch) return;
      if (isContractAddressUnavailableError(e)) {
        recentVaults.set([]);
        catalogReadError.set("");
        return;
      }
      catalogReadError.set(t("catalogReadFailed"));
      console.error(
        "[unbreakable-vault] loadRecentVaults error:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Load a single vault's details from the contract.
   *
   * Returns `{ error }` with a human-readable message on failure so the
   * registered host action can surface a status toast. Returns `undefined` on
   * success or when there is no vault id to load.
   */
  const loadVault = async (): Promise<{ error: string } | undefined> => {
    const epoch = ++vaultLoadEpoch;
    const id = vaultIdInput.get().trim();
    if (!id) return undefined;
    if (!/^[1-9]\d*$/.test(id)) {
      vaultDetails.set(null);
      return { error: t("invalidVaultId") };
    }
    try {
      const context = await requireCanonicalVaultContext(app, t("chainContextMismatch"));
      const detail = await readVaultDetails(app, id, context.contractHash);
      if (!detail) throw new Error(t("vaultNotFound"));
      const current = await requireCanonicalVaultContext(app, t("chainContextMismatch"));
      if (
        epoch !== vaultLoadEpoch
        || vaultIdInput.get().trim() !== id
        || current.network !== context.network
        || current.contractHash !== context.contractHash
      ) return undefined;
      vaultDetails.set(toVaultDetails(detail));
    } catch (e) {
      if (epoch !== vaultLoadEpoch || vaultIdInput.get().trim() !== id) return undefined;
      const message = app.errors.messageOf(e, t("loadFailed"));
      vaultDetails.set(null);
      return { error: message };
    }
    return undefined;
  };

  // ── Actions (direct on-chain calls) ────────────────────────────────

  /**
   * Attempt to break a vault via the deposit-then-act contract flow:
   *   transfer(GAS, "miniapp-unbreakablevault:attempt") » attemptBreak(...).
   *
   * The outcome is read from the AttemptMade event (slot 2 = success). On a
   * correct secret the contract pays the bounty to the attacker in the same
   * transaction — there is no separate claim step.
   *
   * Returns `{ success }` so the registered host action can surface a status
   * toast. Returns `undefined` when the attempt is skipped (guard not satisfied).
   */
  const attemptBreak = async (receiptId?: string): Promise<VaultAttemptOutcome | undefined> => {
    if (!canAttempt.get() || isLoading.get()) return undefined;
    const releaseOperation = safety.beginOperation();
    isLoading.set(true);
    try {
      safety.assertNoPending();
      const targetId = vaultIdInput.get().trim();
      const normalizedSecret = attemptSecret.get().trim();
      const loadedAtStart = vaultDetails.get();
      const assertAttemptSnapshot = () => {
        const current = vaultDetails.get();
        if (
          !targetId
          || !normalizedSecret
          || loadedAtStart?.id !== targetId
          || vaultIdInput.get().trim() !== targetId
          || attemptSecret.get().trim() !== normalizedSecret
          || current?.id !== targetId
          || current.status !== "active"
        ) throw new Error(t("operationContextChanged"));
      };
      assertAttemptSnapshot();
      const attacker = await app.chain.ensureWallet();
      const context = await requireWritableVaultContext(app, t);
      const before = await readVaultDetails(app, targetId, context.contractHash);
      if (!before || before.id !== targetId || before.status !== "active") {
        throw new Error(t("vaultNotActive"));
      }
      const attemptFee = String(before.attemptFee);
      if (!/^\d+$/.test(attemptFee) || BigInt(attemptFee) <= 0n) {
        throw new Error(t("attemptFeeUnavailable"));
      }
      vaultDetails.set(toVaultDetails(before));
      assertAttemptSnapshot();
      const draft = await safety.prepare("attempt", attacker, {
        vaultId: targetId,
        amountFixed8: attemptFee,
        beforeAttempts: String(before.attemptCount),
        beforeBounty: String(before.bounty),
      });
      assertAttemptSnapshot();
      const args = [
        app.chain.arg.integer(targetId),
        app.chain.arg.hash160(attacker),
        app.chain.arg.byteArray(utf8ToBase64(normalizedSecret)),
      ];
      const onTransactionSent = (id: string) => safety.persistAction(draft, id);

      const result = context.network === "mainnet"
        ? await (() => {
            const normalizedReceipt = String(receiptId ?? "").trim();
            if (!/^[1-9]\d*$/.test(normalizedReceipt)) throw new Error(t("receiptIdRequired"));
            return app.funds.receiptPay({
              operation: "attemptBreak",
              args,
              receiptId: normalizedReceipt,
              scriptHash: context.contractHash,
              waitForEvent: "AttemptMade",
              waitTimeoutMs: VAULT_EVENT_WAIT_MS,
              onTransactionSent,
              notify: "silent",
            });
          })()
        : await app.chain.invokeWithPayment(
            attemptFee,
            ATTEMPT_MEMO,
            "attemptBreak",
            args,
            {
              scriptHash: context.contractHash,
              waitForEvent: "AttemptMade",
              waitTimeoutMs: VAULT_EVENT_WAIT_MS,
              onPaymentSent: (id) => safety.persistPayment(draft, id),
              onTransactionSent,
            },
          );
      if (result.txid) safety.persistAction(draft, result.txid);
      const pending = safety.pendingOperation.get();
      if (!pending) throw new Error(t("transactionIdUnavailable"));
      if (result.verified === true && result.event && pending) {
        const finalization = await safety.finalize(pending, result.event);
        attemptSecret.set("");
        vaultDetails.set(toVaultDetails(finalization.vault));
        await loadRecentVaults();
        return {
          status: "confirmed",
          broken: finalization.broken === true,
          finalization,
        };
      }
      return { status: "pending", pending: pending! };
    } catch (error) {
      if (error instanceof VaultVerificationError) throw error;
      const pending = safety.pendingOperation.get();
      if (pending) return { status: "pending", pending };
      throw error;
    } finally {
      isLoading.set(false);
      releaseOperation();
    }
  };

  const selectVault = async (id: string) => {
    vaultIdInput.set(id);
    return loadVault();
  };

  /**
   * Reclaim the escrowed bounty on an expired, unbroken vault.
   *
   * This is a no-payment contract call (the escrow already holds the bounty),
   * so it uses the direct `invoke` flow. The caller is gated by `canReclaim`;
   * this function re-validates so it is safe to call directly from a host
   * action. `claimExpiredVault` takes only the vault id.
   *
   * Returns `{ success }` so the registered host action can surface a status
   * toast, or `undefined` when no reclaim was attempted.
   */
  const settleVault = async (): Promise<VaultReclaimOutcome | undefined> => {
    if (isClaiming.get() || isLoading.get()) return undefined;
    if (!canReclaim.get()) return undefined;
    const releaseOperation = safety.beginOperation();
    isClaiming.set(true);
    try {
      safety.assertNoPending();
      const id = vaultIdInput.get().trim();
      const selectedAtStart = vaultDetails.get();
      if (!id || selectedAtStart?.id !== id) throw new Error(t("operationContextChanged"));
      const player = await app.chain.ensureWallet();
      const context = await requireWritableVaultContext(app, t);
      const before = await readVaultDetails(app, id, context.contractHash);
      if (
        !before
        || before.id !== id
        || !["claimable", "expired"].includes(before.status)
        || !/^\d+$/.test(before.bounty)
        || BigInt(before.bounty) <= 0n
        || !ownerMatchesAddress(before.creator, player)
      ) throw new Error(t("vaultNotReclaimable"));
      const draft = await safety.prepare("reclaim", player, {
        vaultId: id,
        beforeBounty: String(before.bounty),
      });
      if (vaultIdInput.get().trim() !== id || vaultDetails.get()?.id !== id) {
        throw new Error(t("operationContextChanged"));
      }
      const result = await app.chain.invoke(
        "claimExpiredVault",
        [app.chain.arg.integer(id)],
        {
          scriptHash: context.contractHash,
          waitForEvent: "VaultExpired",
          waitTimeoutMs: VAULT_EVENT_WAIT_MS,
          onTransactionSent: (targetTxid) => safety.persistAction(draft, targetTxid),
        },
      );
      if (result.txid) safety.persistAction(draft, result.txid);
      const pending = safety.pendingOperation.get();
      if (!pending) throw new Error(t("transactionIdUnavailable"));
      if (result.verified === true && result.event && pending) {
        const finalization = await safety.finalize(pending, result.event);
        vaultDetails.set(toVaultDetails(finalization.vault));
        await loadRecentVaults();
        return { status: "confirmed", finalization };
      }
      return { status: "pending", pending: pending! };
    } catch (error) {
      if (error instanceof VaultVerificationError) throw error;
      const pending = safety.pendingOperation.get();
      if (pending) return { status: "pending", pending };
      throw error;
    } finally {
      isClaiming.set(false);
      releaseOperation();
    }
  };

  return {
    vaultIdInput,
    attemptSecret,
    vaultDetails,
    recentVaults,
    catalogReadError,
    canAttempt,
    canReclaim,
    attemptFeeDisplay,
    isLoading,
    isClaiming,
    loadRecentVaults,
    loadVault,
    attemptBreak,
    settleVault,
    selectVault,
  };
}

export type UseVaultBreakerReturn = ReturnType<typeof useVaultBreaker>;
