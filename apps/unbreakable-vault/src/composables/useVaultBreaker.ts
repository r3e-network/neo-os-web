/**
 * useVaultBreaker — Vault break attempts, listing, and claiming
 *
 * Uses the direct-prepaid MiniApp contract flow:
 *   GAS.transfer(wallet -> vault, attemptFee, "miniapp-unbreakablevault:attempt")
 *   attemptBreak(vaultId, attacker, secret)
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { ChainService } from "@shared/services/ChainService";
import { formatGas, toFixed8, toSafeNumber } from "@shared/utils/format";

// ============================================================================
// Constants
// ============================================================================

const ATTEMPT_FEE = 0.1;

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
}

export interface UseVaultBreakerOptions {
  /** Shared chain service for wallet-signed direct contract calls */
  chainService: ChainService;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string) => string;
}

// ============================================================================
// Helpers
// ============================================================================

interface StoredVaultDetails {
  id: string;
  creator: string;
  bounty: number;
  attemptCount: number;
  broken: boolean;
  expired: boolean;
  status: string;
  winner: string;
  attemptFee: number;
  difficultyName: string;
  expiryTime: number;
  remainingDays: number;
}

interface StoredRecentVault {
  id: string;
  creator: string;
  bounty: number;
}

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

function utf8ToBase64(value: string): string {
  return base64FromBytes(utf8Bytes(value));
}

/**
 * Normalize an attempt fee to a fixed8 raw integer string for payment.
 *
 * `attemptFee` is stored/read as a fixed8 raw integer (see formatGas usage in
 * the display derive). So an integer input is ALREADY in raw units and must be
 * passed through untouched — re-applying toFixed8 here would double-scale small
 * fees and massively overpay. Only a value that contains a decimal point is
 * treated as human GAS and scaled. Non-positive / non-finite input falls back
 * to the default 0.1 GAS attempt fee.
 */
function normalizeAttemptFeeFixed8(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return toFixed8(ATTEMPT_FEE);
  // Human-decimal GAS (e.g. "0.1") → scale to fixed8 raw.
  if (raw.includes(".")) {
    const scaled = toFixed8(raw);
    return scaled !== "0" ? scaled : toFixed8(ATTEMPT_FEE);
  }
  // Integer input is already a fixed8 raw value — pass through unchanged.
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return String(Math.trunc(numeric));
  }
  return toFixed8(ATTEMPT_FEE);
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultBreaker({
  chainService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseVaultBreakerOptions) {
  const vaultIdInput = createObservable("");
  const attemptSecret = createObservable("");
  const vaultDetails = createObservable<VaultDetails | null>(null);
  const recentVaults = createObservable<RecentVault[]>([]);
  const isLoading = createObservable(false);

  const toNumber = toSafeNumber;

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
   * Resolve the effective attempt fee (fixed8 raw) for a vault.
   *
   * loadVault stores attemptFee via toSafeNumber, which yields 0 (not
   * null/undefined) when the indexer record lacks the field — so a plain
   * `?? fallback` would let an absent fee show/pay 0 GAS. Treat any
   * non-positive / non-finite value as missing and fall back to the default
   * 0.1 GAS attempt fee.
   */
  const resolveAttemptFeeFixed8 = (): string => {
    const fallback = toFixed8(ATTEMPT_FEE);
    const fee = vaultDetails.get()?.attemptFee;
    return Number.isFinite(fee) && (fee as number) > 0 ? String(fee) : fallback;
  };

  const attemptFeeDisplay = createDerived(() => {
    return formatGas(resolveAttemptFeeFixed8());
  }, []);

  // ── Data Loading (via StorageProxy) ────────────────────────────────

  /**
   * Load recent vaults via StorageProxy.list().
   */
  const loadRecentVaults = async () => {
    try {
      const vaultMap = await storageService.list("recentVaults:", 12);
      const vaults: RecentVault[] = [];
      if (vaultMap && typeof vaultMap === "object") {
        for (const [, value] of Object.entries(vaultMap)) {
          const stored = value as StoredRecentVault;
          if (stored && stored.id) {
            vaults.push({
              id: String(stored.id),
              creator: String(stored.creator || ""),
              bounty: Number(stored.bounty ?? 0),
            });
          }
        }
      }
      recentVaults.set(vaults);
    } catch (e) {
      console.error(
        "[unbreakable-vault] loadRecentVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "Recent vaults unavailable" });
    }
  };

  /**
   * Load vault details via StorageProxy.get().
   *
   * Returns `{ error }` with a human-readable message on failure so the
   * registered host action can surface a status toast (the "vault:*" eventBus
   * channel is not subscribed by the runtime). Returns `undefined` on success
   * or when there is no vault id to load.
   */
  const loadVault = async (): Promise<{ error: string } | undefined> => {
    if (!vaultIdInput.get()) return undefined;
    try {
      const data = await storageService.get(`vault:${vaultIdInput.get()}`) as StoredVaultDetails | null;
      if (!data || typeof data !== "object") throw new Error(t("vaultNotFound"));

      const creator = String(data.creator || "");
      if (!creator || /^0+$/.test(creator)) throw new Error(t("vaultNotFound"));

      const st = String(data.status || "");
      const expired = Boolean(data.expired);
      const broken = Boolean(data.broken);

      vaultDetails.set({
        id: vaultIdInput.get(),
        creator,
        bounty: toNumber(data.bounty),
        attempts: toNumber(data.attemptCount),
        broken,
        expired,
        status: st || (broken ? "broken" : expired ? "expired" : "active"),
        winner: String(data.winner || ""),
        attemptFee: toNumber(data.attemptFee),
        difficultyName: String(data.difficultyName || ""),
        expiryTime: toNumber(data.expiryTime),
        remainingDays: toNumber(data.remainingDays),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : t("loadFailed");
      eventBus.emit("vault:error", { message });
      vaultDetails.set(null);
      return { error: message };
    }
    return undefined;
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Attempt to break a vault via the live Vault contract funded transaction flow.
   *
   * Returns `{ success }` so the registered host action can surface a status
   * toast (the "vault:*" eventBus channel is not subscribed by the runtime).
   * Returns `undefined` when the attempt is skipped (guard not satisfied).
   */
  const attemptBreak = async (): Promise<{ success: boolean } | undefined> => {
    if (!canAttempt.get() || isLoading.get()) return undefined;
    isLoading.set(true);
    try {
      const attemptFee = normalizeAttemptFeeFixed8(resolveAttemptFeeFixed8());
      const attacker = await chainService.ensureWallet();

      await chainService.invokeWithPayment(
        attemptFee,
        `miniapp-unbreakablevault:attempt:${vaultIdInput.get()}`,
        "attemptBreak",
        [
          { type: "Integer", value: vaultIdInput.get() },
          { type: "Hash160", value: attacker },
          { type: "ByteArray", value: utf8ToBase64(attemptSecret.get().trim()) },
        ],
        { waitForEvent: "AttemptMade" },
      );

      // Check the result from storage
      const result = await storageService.get(`attemptResult:${vaultIdInput.get()}`) as { success?: boolean } | null;
      const success = Boolean(result?.success);

      if (success) {
        eventBus.emit("vault:broken", { action: t("broken") });
        // Hint badge for vault breaker (fire-and-forget)
        badgeService.award("vault-breaker", "").catch(() => {});
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

  return {
    vaultIdInput,
    attemptSecret,
    vaultDetails,
    recentVaults,
    canAttempt,
    attemptFeeDisplay,
    isLoading,
    loadRecentVaults,
    loadVault,
    attemptBreak,
    selectVault,
  };
}

export type UseVaultBreakerReturn = ReturnType<typeof useVaultBreaker>;
