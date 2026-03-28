/**
 * useVaultBreaker — Vault break attempts, listing, and claiming
 *
 * Migrated to PlatformServices pattern:
 *   - useContractInteraction(hash) -> chain.read() / chain.invoke()
 *   - useStatusMessage() -> eventBus.emit()
 *   - useEvents().list -> chain.listEvents()
 *   - waitForListedEventByTransaction -> chain.waitForEvent()
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { parseStackItem, normalizeScriptHash } from "@shared/utils/neo";
import { bytesToHex, formatGas, toFixed8 } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

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
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultBreaker({ chain, eventBus, t }: UseVaultBreakerOptions) {
  const vaultIdInput = ref("");
  const attemptSecret = ref("");
  const vaultDetails = ref<VaultDetails | null>(null);
  const recentVaults = ref<RecentVault[]>([]);

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

  const toHex = (value: string) => {
    if (!value) return "";
    if (typeof TextEncoder === "undefined") {
      return Array.from(value)
        .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
    }
    return bytesToHex(new TextEncoder().encode(value));
  };

  const loadRecentVaults = async () => {
    try {
      const events = await chain.listEvents("VaultCreated", { limit: 12 });
      const vaults = (events as { state?: unknown[] }[])
        .map((evt) => {
          const values = Array.isArray(evt?.state)
            ? (evt.state as unknown[]).map(parseStackItem)
            : [];
          const id = String(values[0] ?? "");
          const creator = String(values[1] ?? "");
          const bountyValue = Number(values[2] ?? 0);
          if (!id) return null;
          return { id, creator, bounty: bountyValue };
        })
        .filter(Boolean) as RecentVault[];
      recentVaults.value = vaults;
    } catch (e) {
      console.error(
        "[unbreakable-vault] loadRecentVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "Recent vaults unavailable" });
    }
  };

  const loadVault = async () => {
    if (!vaultIdInput.value) return;
    try {
      const parsed = await chain.read("getVaultDetails", [
        { type: "Integer", value: vaultIdInput.value },
      ]);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error(t("vaultNotFound"));
      const data = parsed as Record<string, unknown>;
      const creator = String(data.creator || "");
      const creatorHash = normalizeScriptHash(creator);
      if (!creatorHash || /^0+$/.test(creatorHash)) throw new Error(t("vaultNotFound"));
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

  const attemptBreak = async () => {
    if (!canAttempt.value || chain.isProcessing.value) return;
    try {
      await chain.ensureWallet();
      const feeBase = vaultDetails.value?.attemptFee ?? toFixed8(ATTEMPT_FEE);

      // Step 1: Pay the attempt fee
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: String(feeBase) },
          { type: "String", value: `miniapp-unbreakablevault:attempt:${vaultIdInput.value}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 2: Attempt the break
      const result = await chain.invoke(
        "attemptBreak",
        [
          { type: "Integer", value: vaultIdInput.value },
          { type: "Hash160", value: chain.address.value as string },
          { type: "ByteArray", value: toHex(attemptSecret.value) },
        ],
        { waitForEvent: "AttemptMade", waitTimeoutMs: 30000 },
      );

      const evtRecord = result.event as { state?: unknown[] } | undefined;
      const values = Array.isArray(evtRecord?.state)
        ? evtRecord!.state.map(parseStackItem)
        : [];
      const success = Boolean(values[2] ?? false);

      if (success) {
        eventBus.emit("vault:broken", { action: t("broken") });
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
    isLoading: chain.isProcessing,
    loadRecentVaults,
    loadVault,
    attemptBreak,
    selectVault,
  };
}

export type UseVaultBreakerReturn = ReturnType<typeof useVaultBreaker>;
