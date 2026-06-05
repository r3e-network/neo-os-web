/**
 * useVaultBreaker — Vault listing, break attempts, and expired-vault reclaim
 *
 * Talks DIRECTLY to the standalone MiniAppUnbreakableVault contract via
 * ctx.services.chain. The earlier path read vault state through ctx.os.storage,
 * awarded badges through ctx.os.badge, and "claimed" bounties through
 * non-existent contract methods — all backed by the offline Morpheus OS kernel.
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
import type { ChainService } from "@shared/services/ChainService";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { formatGas } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import {
  ATTEMPT_MEMO,
  DEFAULT_ATTEMPT_FEE_BASE,
  MAX_RECENT_VAULTS,
  readRecentVaultDetails,
  readVaultDetails,
  type ChainVaultDetails,
} from "./vaultChain";

// ============================================================================
// Types
// ============================================================================

export interface VaultDetails {
  id: string;
  creator: string;
  bounty: number;
  attempts: number;
  broken: boolean;
  expired: boolean;
  status: string;
  winner: string;
  attemptFee: number;
  difficultyName: string;
  expiryTime: number;
  remainingDays: number;
}

export interface RecentVault {
  id: string;
  creator: string;
  bounty: number;
  status: string;
}

export interface UseVaultBreakerOptions {
  /** Shared chain service for wallet-signed direct contract calls + reads. */
  chainService: ChainService;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string) => string;
}

// ============================================================================
// Helpers
// ============================================================================

function base64FromBytes(bytes: number[]): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

function utf8Bytes(value: string): number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === "%" && i + 2 < encoded.length) {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

/** Encode a UTF-8 secret string as base64 for the ByteArray contract arg. */
function utf8ToBase64(value: string): string {
  return base64FromBytes(utf8Bytes(value));
}

/** Read a single state slot from an event payload. */
function eventSlot(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
}

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
  chainService,
  eventBus,
  t,
}: UseVaultBreakerOptions) {
  const vaultIdInput = createObservable("");
  const attemptSecret = createObservable("");
  const vaultDetails = createObservable<VaultDetails | null>(null);
  const recentVaults = createObservable<RecentVault[]>([]);
  const isLoading = createObservable(false);
  const isClaiming = createObservable(false);

  const canAttempt = createDerived(() => {
    const st = vaultDetails.get()?.status;
    return Boolean(
      vaultIdInput.get() &&
        attemptSecret.get().trim() &&
        vaultDetails.get() &&
        String(vaultDetails.get()?.id) === String(vaultIdInput.get()) &&
        st === "active",
    );
  }, []);

  /**
   * The current wallet may reclaim the escrowed bounty when the loaded vault has
   * passed its expiry unbroken (status "claimable") and they are its creator.
   * Reactive on both the loaded vault and the connected wallet address.
   */
  const canReclaim = createDerived(() => {
    const vault = vaultDetails.get();
    if (!vault) return false;
    const wallet = chainService.address.get();
    if (!wallet) return false;
    const reclaimable = vault.status === "claimable" || vault.status === "expired";
    return (
      reclaimable &&
      Boolean(vault.creator) &&
      ownerMatchesAddress(vault.creator, wallet)
    );
  }, [vaultDetails, chainService.address]);

  /**
   * Resolve the effective attempt fee (base units) for the loaded vault.
   *
   * getVaultDetails().attemptFee is already a base-unit integer set by the
   * contract from the vault's difficulty tier. Treat any non-positive value as
   * missing and fall back to the Easy-tier default (0.1 GAS).
   */
  const resolveAttemptFeeBase = (): string => {
    const fee = vaultDetails.get()?.attemptFee;
    return Number.isFinite(fee) && (fee as number) > 0
      ? String(Math.trunc(fee as number))
      : DEFAULT_ATTEMPT_FEE_BASE;
  };

  const attemptFeeDisplay = createDerived(() => {
    return formatGas(resolveAttemptFeeBase());
  }, [vaultDetails]);

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load the newest vaults straight from the contract. Replaces the old
   * os.storage list entirely.
   */
  const loadRecentVaults = async () => {
    try {
      const details = await readRecentVaultDetails(chainService, MAX_RECENT_VAULTS);
      recentVaults.set(details.map(toRecentVault));
    } catch (e) {
      console.error(
        "[unbreakable-vault] loadRecentVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "Recent vaults unavailable" });
    }
  };

  /**
   * Load a single vault's details from the contract.
   *
   * Returns `{ error }` with a human-readable message on failure so the
   * registered host action can surface a status toast (the "vault:*" eventBus
   * channel is not subscribed by the runtime). Returns `undefined` on success or
   * when there is no vault id to load.
   */
  const loadVault = async (): Promise<{ error: string } | undefined> => {
    const id = vaultIdInput.get();
    if (!id) return undefined;
    try {
      const detail = await readVaultDetails(chainService, id);
      if (!detail) throw new Error(t("vaultNotFound"));
      vaultDetails.set(toVaultDetails(detail));
    } catch (e) {
      const message = e instanceof Error ? e.message : t("loadFailed");
      eventBus.emit("vault:error", { message });
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
  const attemptBreak = async (): Promise<{ success: boolean } | undefined> => {
    if (!canAttempt.get() || isLoading.get()) return undefined;
    isLoading.set(true);
    try {
      const attemptFee = resolveAttemptFeeBase();
      const attacker = await chainService.ensureWallet();

      const result = await chainService.invokeWithPayment(
        attemptFee,
        ATTEMPT_MEMO,
        "attemptBreak",
        [
          { type: "Integer", value: vaultIdInput.get() },
          { type: "Hash160", value: attacker },
          { type: "ByteArray", value: utf8ToBase64(attemptSecret.get().trim()) },
        ],
        { waitForEvent: "AttemptMade" },
      );

      // AttemptMade(vaultId, attacker, success, attemptNumber) — slot 2 is the
      // boolean success flag, definitive at HALT.
      const successSlot = eventSlot(result.event, 2);
      const success =
        successSlot === true ||
        successSlot === "true" ||
        successSlot === 1 ||
        successSlot === "1";

      if (success) {
        eventBus.emit("vault:broken", { action: t("broken") });
      } else {
        eventBus.emit("vault:attempt_failed", { message: t("vaultAttemptFailed") });
      }

      attemptSecret.set("");
      await loadVault();
      await loadRecentVaults();
      return { success };
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("vaultAttemptFailed"),
      });
      throw e;
    } finally {
      isLoading.set(false);
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
  const settleVault = async (): Promise<{ success: boolean } | undefined> => {
    if (isClaiming.get() || isLoading.get()) return undefined;
    if (!canReclaim.get()) return undefined;

    isClaiming.set(true);
    try {
      await chainService.ensureWallet();
      const result = await chainService.invoke(
        "claimExpiredVault",
        [{ type: "Integer", value: vaultIdInput.get() }],
        { waitForEvent: "VaultExpired" },
      );
      // The VaultExpired event firing at HALT proves the refund settled; the
      // base TxResult.success only reflects that a txid was broadcast.
      const success = Boolean(result.event) || Boolean(result.success);

      if (success) {
        eventBus.emit("vault:settled", {
          mode: "reclaim",
          action: t("vaultReclaimed"),
        });
      }

      await loadVault();
      await loadRecentVaults();
      return { success };
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("settleFailed"),
      });
      throw e;
    } finally {
      isClaiming.set(false);
    }
  };

  return {
    vaultIdInput,
    attemptSecret,
    vaultDetails,
    recentVaults,
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
