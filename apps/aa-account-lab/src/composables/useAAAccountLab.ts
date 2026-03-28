/**
 * useAAAccountLab — Domain logic for AA Account Lab
 *
 * Encapsulates all AA account registration and inspection logic.
 * Receives ChainService + EventBus from PlatformServices instead of
 * directly consuming useWallet / useContractInteraction composables.
 */

import { ref, reactive, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { deriveAAAccountIdHash } from "@shared/utils/aa-account";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

// ============================================================================
// Types
// ============================================================================

export interface UseAAAccountLabOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useAAAccountLab({ chain, eventBus, t }: UseAAAccountLabOptions) {
  const integration = getExternalIntegrationConfig("testnet");
  const aaCore = integration.contracts.aaCore;
  const defaultVerifier = integration.contracts.aaWeb3AuthVerifier;

  // -- Inspect form state --
  const inspectForm = reactive({ accountIdInput: "" });

  // -- Register form state --
  const registerForm = reactive({
    accountIdInput: "",
    verifierHash: defaultVerifier,
    verifierParamsHex: "",
    hookHash: "",
    backupOwner: "",
    escapeTimelock: "2592000",
  });

  // -- Inspected state --
  const currentVerifier = ref(t("notAvailable"));
  const currentHook = ref(t("notAvailable"));
  const currentBackupOwner = ref(t("notAvailable"));
  const inspectedAccountIdHash = ref("");

  // -- Loading states --
  const isInspecting = ref(false);
  const isSubmitting = ref(false);

  // -- Display values --
  const aaCoreDisplay = computed(() => aaCore);
  const defaultVerifierDisplay = computed(() => defaultVerifier);
  const networkDisplay = computed(() => t("testnet"));

  // -- Helpers --
  function deriveAccountIdHash(input: string): string {
    try {
      return deriveAAAccountIdHash(input);
    } catch {
      throw new Error(t("invalidAccountId"));
    }
  }

  function normalizeHashOrZero(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "0x0000000000000000000000000000000000000000";
    const normalized = trimmed.startsWith("N") ? addressToScriptHash(trimmed) : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidHash"));
    return normalized;
  }

  function normalizeBackupOwner(value: string): string {
    const normalized = value.trim().startsWith("N") ? addressToScriptHash(value.trim()) : normalizeScriptHash(value.trim());
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidBackupOwner"));
    return normalized;
  }

  // -- Actions --
  const inspectAccount = async () => {
    try {
      isInspecting.value = true;
      const accountIdHash = deriveAccountIdHash(inspectForm.accountIdInput);
      inspectedAccountIdHash.value = accountIdHash;
      const accountId = `0x${accountIdHash}`;

      const [verifierResult, hookResult, backupResult] = await Promise.all([
        chain.invokeRead(aaCore, "getVerifier", [{ type: "Hash160", value: accountId }]),
        chain.invokeRead(aaCore, "getHook", [{ type: "Hash160", value: accountId }]),
        chain.invokeRead(aaCore, "getBackupOwner", [{ type: "Hash160", value: accountId }]),
      ]);

      currentVerifier.value = String(parseInvokeResult(verifierResult) || t("notAvailable"));
      currentHook.value = String(parseInvokeResult(hookResult) || t("notAvailable"));
      currentBackupOwner.value = String(parseInvokeResult(backupResult) || t("notAvailable"));

      eventBus.emit("inspect:success", { accountId });
    } catch (error: unknown) {
      eventBus.emit("inspect:error", { message: formatErrorMessage(error, t("invalidAccountId")) });
      throw error;
    } finally {
      isInspecting.value = false;
    }
  };

  const submitRegister = async () => {
    try {
      isSubmitting.value = true;
      const accountIdHash = deriveAccountIdHash(registerForm.accountIdInput);
      const verifierHash = normalizeHashOrZero(registerForm.verifierHash);
      const hookHash = normalizeHashOrZero(registerForm.hookHash);
      const backupOwner = normalizeBackupOwner(registerForm.backupOwner);
      const escapeTimelock = parseInt(registerForm.escapeTimelock, 10) || 2592000;
      const verifierParams = registerForm.verifierParamsHex.trim().replace(/^0x/, "");

      await chain.invokeWrite(aaCore, "registerAccount", [
        { type: "Hash160", value: `0x${accountIdHash}` },
        { type: "Hash160", value: verifierHash },
        { type: "ByteArray", value: verifierParams },
        { type: "Hash160", value: hookHash },
        { type: "Hash160", value: backupOwner },
        { type: "Integer", value: String(escapeTimelock) },
      ]);

      eventBus.emit("register:success", { accountId: `0x${accountIdHash}` });
    } catch (error: unknown) {
      eventBus.emit("register:error", { message: formatErrorMessage(error, t("invalidAccountId")) });
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  };

  const loadAll = async () => {
    // No initial data to load — inspect is user-triggered
  };

  return {
    // -- Form state --
    inspectForm,
    registerForm,

    // -- Inspected state --
    currentVerifier,
    currentHook,
    currentBackupOwner,
    inspectedAccountIdHash,

    // -- Loading --
    isInspecting,
    isSubmitting,

    // -- Display values --
    aaCoreDisplay,
    defaultVerifierDisplay,
    networkDisplay,
    aaCore,

    // -- Actions --
    inspectAccount,
    submitRegister,
    loadAll,
  };
}

export type UseAAAccountLabReturn = ReturnType<typeof useAAAccountLab>;
