/**
 * useVaultBreaker — Vault break attempts, listing, and claiming
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (EscrowProxy, PaymentProxy, StorageProxy, BadgeProxy) via
 * edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.listEvents("VaultCreated", { limit: 12 })
 *     chain.read("getVaultDetails", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("attemptBreak", [...], { waitForEvent: "AttemptMade" })
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.list("recentVaults:", 12)
 *     storageService.get("vault:<id>")
 *     paymentService.deposit(fee, "attempt:<vaultId>")
 *     escrowService.completeMilestone(vaultId, 0)
 *     badgeService.award("vault-breaker", "")
 */

import { ref, computed } from "vue";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { formatGas, toFixed8 } from "@shared/utils/format";

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
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
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

// ============================================================================
// Composable
// ============================================================================

export function useVaultBreaker({
  escrowService,
  paymentService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseVaultBreakerOptions) {
  const vaultIdInput = ref("");
  const attemptSecret = ref("");
  const vaultDetails = ref<VaultDetails | null>(null);
  const recentVaults = ref<RecentVault[]>([]);
  const isLoading = ref(false);

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const canAttempt = computed(() => {
    const st = vaultDetails.value?.status;
    return Boolean(
      vaultIdInput.value &&
        attemptSecret.value.trim() &&
        vaultDetails.value &&
        String(vaultDetails.value.id) === String(vaultIdInput.value) &&
        st === "active",
    );
  });

  const attemptFeeDisplay = computed(() => {
    const fallback = toFixed8(ATTEMPT_FEE);
    const fee = vaultDetails.value?.attemptFee ?? fallback;
    return formatGas(fee);
  });

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
      recentVaults.value = vaults;
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
   */
  const loadVault = async () => {
    if (!vaultIdInput.value) return;
    try {
      const data = await storageService.get(`vault:${vaultIdInput.value}`) as StoredVaultDetails | null;
      if (!data || typeof data !== "object") throw new Error(t("vaultNotFound"));

      const creator = String(data.creator || "");
      if (!creator || /^0+$/.test(creator)) throw new Error(t("vaultNotFound"));

      const st = String(data.status || "");
      const expired = Boolean(data.expired);
      const broken = Boolean(data.broken);

      vaultDetails.value = {
        id: vaultIdInput.value,
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
      };
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("loadFailed"),
      });
      vaultDetails.value = null;
    }
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Attempt to break a vault via PaymentProxy (fee) + EscrowProxy (attempt).
   * The edge functions handle wallet connection, fee transfer, and the
   * attemptBreak contract call.
   */
  const attemptBreak = async () => {
    if (!canAttempt.value || isLoading.value) return;
    isLoading.value = true;
    try {
      const feeBase = vaultDetails.value?.attemptFee ?? toFixed8(ATTEMPT_FEE);

      // Step 1: Pay the attempt fee via PaymentProxy
      await paymentService.deposit(
        String(feeBase),
        `miniapp-unbreakablevault:attempt:${vaultIdInput.value}`,
      );

      // Step 2: Attempt the break via EscrowProxy
      await escrowService.completeMilestone(vaultIdInput.value, 0);

      // Check the result from storage
      const result = await storageService.get(`attemptResult:${vaultIdInput.value}`) as { success?: boolean } | null;
      const success = Boolean(result?.success);

      if (success) {
        eventBus.emit("vault:broken", { action: t("broken") });
        // Hint badge for vault breaker (fire-and-forget)
        badgeService.award("vault-breaker", "").catch(() => {});
      } else {
        eventBus.emit("vault:attempt_failed", { message: t("vaultAttemptFailed") });
      }

      attemptSecret.value = "";
      await loadVault();
      await loadRecentVaults();
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("vaultAttemptFailed"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const selectVault = async (id: string) => {
    vaultIdInput.value = id;
    await loadVault();
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
