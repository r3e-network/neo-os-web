/**
 * useSealConsole -- Domain logic for Oracle Seal Console
 *
 * Receives OracleService from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService, ClipboardService, OraclePublicKeyResponse, ConfidentialStoreResponse } from "@shared/services";
import { encryptJsonWithOraclePublicKey, encryptTextWithOraclePublicKey } from "../utils/encryption";

export interface UseSealConsoleOptions {
  oracle: OracleService;
  clipboard: ClipboardService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSealConsole({ oracle, clipboard, t }: UseSealConsoleOptions) {
  const keyMeta = ref<OraclePublicKeyResponse | null>(null);
  const inputMode = ref<"json" | "text">("json");
  const fieldName = ref<"encrypted_payload" | "encrypted_params" | "encrypted_token">("encrypted_payload");
  const confidentialInput = ref(`{\n  "mode": "builtin",\n  "function": "math.modexp",\n  "input": {\n    "base": "2",\n    "exponent": "10",\n    "modulus": "17"\n  },\n  "target_chain": "neo_n3"\n}`);
  const ciphertext = ref("");
  const isLoadingKey = ref(false);
  const isSealing = ref(false);
  const isStoring = ref(false);
  const copiedKey = ref<"cipher" | "wrapper" | "ref" | null>(null);
  const storageName = ref("");
  const projectSlug = ref("");
  const boundRequester = ref("");
  const boundCallbackContract = ref("");
  const storedRef = ref<ConfidentialStoreResponse | null>(null);

  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const canSeal = computed(() => Boolean(keyMeta.value?.public_key && confidentialInput.value.trim()));
  const wrapperJson = computed(() => ciphertext.value ? JSON.stringify({ [fieldName.value]: ciphertext.value }, null, 2) : "");
  const refFieldName = computed(() => fieldName.value === "encrypted_payload" ? "encrypted_payload_ref" : fieldName.value === "encrypted_params" ? "encrypted_params_ref" : "");
  const canStoreRef = computed(() => Boolean(ciphertext.value && refFieldName.value));
  const refWrapperJson = computed(() => storedRef.value?.secret_ref && refFieldName.value
    ? JSON.stringify({ [refFieldName.value]: storedRef.value.secret_ref }, null, 2)
    : "");

  // State values for manifest bindings
  const modeDisplay = computed(() => t(inputMode.value === "json" ? "jsonMode" : "textMode"));
  const fieldDisplay = computed(() => t(fieldName.value === "encrypted_payload" ? "encryptedPayload" : fieldName.value === "encrypted_params" ? "encryptedParams" : "encryptedToken"));
  const algorithmDisplay = computed(() => keyMeta.value?.algorithm || t("notAvailable"));
  const networkDisplay = computed(() => keyMeta.value?.network || oracle.network);
  const contractDisplay = computed(() => keyMeta.value?.contract || t("notLoaded"));
  const sourceDisplay = computed(() => keyMeta.value?.source || t("notLoaded"));

  async function loadKey() {
    try {
      isLoadingKey.value = true;
      keyMeta.value = await oracle.getOraclePublicKey();
      return { success: true };
    } finally {
      isLoadingKey.value = false;
    }
  }

  async function sealPayload() {
    if (!keyMeta.value?.public_key) {
      throw new Error(t("oracleKeyUnavailable"));
    }
    try {
      isSealing.value = true;
      ciphertext.value = inputMode.value === "json"
        ? await encryptJsonWithOraclePublicKey(keyMeta.value.public_key, confidentialInput.value)
        : await encryptTextWithOraclePublicKey(keyMeta.value.public_key, confidentialInput.value);
      storedRef.value = null;
      return { success: true };
    } finally {
      isSealing.value = false;
    }
  }

  async function storeCiphertextRef() {
    if (!refFieldName.value) {
      throw new Error(t("refUnavailableForToken"));
    }
    if (!ciphertext.value) {
      throw new Error(t("ciphertextRequired"));
    }
    try {
      isStoring.value = true;
      storedRef.value = await oracle.storeConfidentialCiphertext({
        ciphertext: ciphertext.value,
        name: storageName.value || undefined,
        project_slug: projectSlug.value || undefined,
        requester_script_hash: boundRequester.value || undefined,
        callback_contract: boundCallbackContract.value || undefined,
        metadata: {
          app_id: "miniapp-oracle-seal-console",
          field: fieldName.value,
        },
      });
      return { success: true };
    } finally {
      isStoring.value = false;
    }
  }

  async function copyText(value: string, key: "cipher" | "wrapper" | "ref") {
    if (!value) return;
    const ok = await clipboard.copy(value, "copied");
    if (ok) {
      if (copyTimer !== undefined) {
        clearTimeout(copyTimer);
        copyTimer = undefined;
      }
      copiedKey.value = key;
      copyTimer = setTimeout(() => {
        if (copiedKey.value === key) copiedKey.value = null;
        copyTimer = undefined;
      }, 1500);
    }
  }

  function cleanup() {
    if (copyTimer !== undefined) {
      clearTimeout(copyTimer);
      copyTimer = undefined;
    }
  }

  const loadAll = async () => {
    await loadKey();
  };

  return {
    // State
    keyMeta,
    inputMode,
    fieldName,
    confidentialInput,
    ciphertext,
    isLoadingKey,
    isSealing,
    isStoring,
    copiedKey,
    storageName,
    projectSlug,
    boundRequester,
    boundCallbackContract,
    storedRef,
    canSeal,
    wrapperJson,
    refFieldName,
    canStoreRef,
    refWrapperJson,
    modeDisplay,
    fieldDisplay,
    algorithmDisplay,
    networkDisplay,
    contractDisplay,
    sourceDisplay,
    isRequesting: oracle.isRequesting,

    // Actions
    loadKey,
    sealPayload,
    storeCiphertextRef,
    copyText,
    cleanup,
    loadAll,
  };
}

export type UseSealConsoleReturn = ReturnType<typeof useSealConsole>;
