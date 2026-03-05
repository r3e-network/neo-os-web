import { ref, computed } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { parseStackItem, normalizeScriptHash } from "@shared/utils/neo";
import { bytesToHex, formatGas, toFixed8 } from "@shared/utils/format";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const ATTEMPT_FEE = 0.1;

/** Handles vault break attempts, listing vaults, and claiming rewards. */
export function useVaultBreaker(APP_ID: string, t: (key: string) => string) {
  const {
    address,
    ensureWallet,
    ensureContractAddress,
    contractAddress,
    read,
    invoke,
    isProcessing: isLoading,
  } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();
  const { status, setStatus, clearStatus } = useStatusMessage();

  const vaultIdInput = ref("");
  const attemptSecret = ref("");
  const vaultDetails = ref<{
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
  } | null>(null);

  const recentVaults = ref<{ id: string; creator: string; bounty: number }[]>([]);

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
      st === "active"
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
      const res = await listEvents({ app_id: APP_ID, event_name: "VaultCreated", limit: 12 });
      const vaults = res.events
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
          const id = String(values[0] ?? "");
          const creator = String(values[1] ?? "");
          const bountyValue = Number(values[2] ?? 0);
          if (!id) return null;
          return { id, creator, bounty: bountyValue };
        })
        .filter(Boolean) as { id: string; creator: string; bounty: number }[];
      recentVaults.value = vaults;
    } catch (_e: unknown) {
      // Recent vaults load failure is non-critical
    }
  };

  const loadVault = async () => {
    if (!vaultIdInput.value) return;
    clearStatus();
    try {
      const parsed = await read("GetVaultDetails", [{ type: "Integer", value: vaultIdInput.value }]);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("vaultNotFound"));
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
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("loadFailed")), "error");
      vaultDetails.value = null;
    }
  };

  const attemptBreak = async () => {
    if (!canAttempt.value || isLoading.value) return;
    clearStatus();
    try {
      await ensureWallet();
      const feeBase = vaultDetails.value?.attemptFee ?? toFixed8(ATTEMPT_FEE);
      const result = await invoke(formatGas(feeBase), `vault:attempt:${vaultIdInput.value}`, "attemptBreak", [
        { type: "Integer", value: vaultIdInput.value },
        { type: "Hash160", value: address.value as string },
        { type: "ByteArray", value: toHex(attemptSecret.value) },
      ]);
      const resRecord = result?.tx as Record<string, unknown> | undefined;
      const stackArr = resRecord?.stack as unknown[] | undefined;
      const firstItem = stackArr?.[0] as Record<string, unknown> | undefined;
      const success = Boolean(firstItem?.value ?? resRecord?.result);
      setStatus(success ? t("broken") : t("vaultAttemptFailed"), success ? "success" : "error");
      attemptSecret.value = "";
      await loadVault();
      await loadRecentVaults();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("vaultAttemptFailed")), "error");
    }
  };

  const selectVault = (id: string) => {
    vaultIdInput.value = id;
    loadVault();
  };

  return {
    vaultIdInput,
    attemptSecret,
    vaultDetails,
    recentVaults,
    canAttempt,
    attemptFeeDisplay,
    isLoading,
    status,
    setStatus,
    clearStatus,
    loadRecentVaults,
    loadVault,
    attemptBreak,
    selectVault,
  };
}
