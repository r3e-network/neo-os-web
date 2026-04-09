/**
 * useSealConsole -- Domain logic for Oracle Seal Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService, ClipboardService, OraclePublicKeyResponse, ConfidentialStoreResponse } from "@shared/services";
import { encryptJsonWithOraclePublicKey, encryptTextWithOraclePublicKey } from "../utils/encryption";

export interface UseSealConsoleOptions {
  oracle: OracleService;
  clipboard: ClipboardService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSealConsole({ oracle, clipboard, t }: UseSealConsoleOptions) {
  const keyMeta = createObservable<OraclePublicKeyResponse | null>(null);
  const inputMode = createObservable<"json" | "text">("json");
  const fieldName = createObservable<"encrypted_payload" | "encrypted_params" | "encrypted_token">("encrypted_payload");
  const confidentialInput = createObservable(`{\n  "mode": "builtin",\n  "function": "math.modexp",\n  "input": {\n    "base": "2",\n    "exponent": "10",\n    "modulus": "17"\n  },\n  "target_chain": "neo_n3"\n}`);
  const ciphertext = createObservable("");
  const isLoadingKey = createObservable(false);
  const isSealing = createObservable(false);
  const isStoring = createObservable(false);
  const copiedKey = createObservable<"cipher" | "wrapper" | "ref" | null>(null);
  const storageName = createObservable("");
  const projectSlug = createObservable("");
  const boundRequester = createObservable("");
  const boundCallbackContract = createObservable("");
  const storedRef = createObservable<ConfidentialStoreResponse | null>(null);

  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const canSeal: Observable<boolean> = {
    get: () => Boolean(keyMeta.get()?.public_key && confidentialInput.get().trim()),
    set: () => {},
    subscribe: (fn) => {
      const u1 = keyMeta.subscribe(fn);
      const u2 = confidentialInput.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  const wrapperJson: Observable<string> = {
    get: () => ciphertext.get() ? JSON.stringify({ [fieldName.get()]: ciphertext.get() }, null, 2) : "",
    set: () => {},
    subscribe: (fn) => {
      const u1 = ciphertext.subscribe(fn);
      const u2 = fieldName.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  const refFieldName: Observable<string> = {
    get: () => {
      const fn = fieldName.get();
      return fn === "encrypted_payload" ? "encrypted_payload_ref" : fn === "encrypted_params" ? "encrypted_params_ref" : "";
    },
    set: () => {},
    subscribe: (fn) => fieldName.subscribe(fn),
  };

  const canStoreRef: Observable<boolean> = {
    get: () => Boolean(ciphertext.get() && refFieldName.get()),
    set: () => {},
    subscribe: (fn) => {
      const u1 = ciphertext.subscribe(fn);
      const u2 = fieldName.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  const refWrapperJson: Observable<string> = {
    get: () => {
      const ref = storedRef.get();
      const rfn = refFieldName.get();
      return ref?.secret_ref && rfn ? JSON.stringify({ [rfn]: ref.secret_ref }, null, 2) : "";
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = storedRef.subscribe(fn);
      const u2 = fieldName.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  // Display values for manifest bindings
  const modeDisplay: Observable<string> = {
    get: () => t(inputMode.get() === "json" ? "jsonMode" : "textMode"),
    set: () => {},
    subscribe: (fn) => inputMode.subscribe(fn),
  };

  const fieldDisplay: Observable<string> = {
    get: () => t(fieldName.get() === "encrypted_payload" ? "encryptedPayload" : fieldName.get() === "encrypted_params" ? "encryptedParams" : "encryptedToken"),
    set: () => {},
    subscribe: (fn) => fieldName.subscribe(fn),
  };

  const algorithmDisplay: Observable<string> = {
    get: () => keyMeta.get()?.algorithm || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => keyMeta.subscribe(fn),
  };

  const networkDisplay: Observable<string> = {
    get: () => keyMeta.get()?.network || oracle.network,
    set: () => {},
    subscribe: (fn) => keyMeta.subscribe(fn),
  };

  const contractDisplay: Observable<string> = {
    get: () => keyMeta.get()?.contract || t("notLoaded"),
    set: () => {},
    subscribe: (fn) => keyMeta.subscribe(fn),
  };

  const sourceDisplay: Observable<string> = {
    get: () => keyMeta.get()?.source || t("notLoaded"),
    set: () => {},
    subscribe: (fn) => keyMeta.subscribe(fn),
  };

  async function loadKey() {
    try {
      isLoadingKey.set(true);
      keyMeta.set(await oracle.getOraclePublicKey());
      return { success: true };
    } finally {
      isLoadingKey.set(false);
    }
  }

  async function sealPayload() {
    if (!keyMeta.get()?.public_key) {
      throw new Error(t("oracleKeyUnavailable"));
    }
    try {
      isSealing.set(true);
      const encrypted = inputMode.get() === "json"
        ? await encryptJsonWithOraclePublicKey(keyMeta.get()!.public_key, confidentialInput.get())
        : await encryptTextWithOraclePublicKey(keyMeta.get()!.public_key, confidentialInput.get());
      ciphertext.set(encrypted);
      storedRef.set(null);
      return { success: true };
    } finally {
      isSealing.set(false);
    }
  }

  async function storeCiphertextRef() {
    if (!refFieldName.get()) {
      throw new Error(t("refUnavailableForToken"));
    }
    if (!ciphertext.get()) {
      throw new Error(t("ciphertextRequired"));
    }
    try {
      isStoring.set(true);
      storedRef.set(await oracle.storeConfidentialCiphertext({
        ciphertext: ciphertext.get(),
        name: storageName.get() || undefined,
        project_slug: projectSlug.get() || undefined,
        requester_script_hash: boundRequester.get() || undefined,
        callback_contract: boundCallbackContract.get() || undefined,
        metadata: {
          app_id: "miniapp-oracle-seal-console",
          field: fieldName.get(),
        },
      }));
      return { success: true };
    } finally {
      isStoring.set(false);
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
      copiedKey.set(key);
      copyTimer = setTimeout(() => {
        if (copiedKey.get() === key) copiedKey.set(null);
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

  const isRequesting: Observable<boolean> = {
    get: () => oracle.isRequesting,
    set: () => {},
    subscribe: () => () => {},
  };

  return {
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
    isRequesting,
    loadKey,
    sealPayload,
    storeCiphertextRef,
    copyText,
    cleanup,
    loadAll,
  };
}

export type UseSealConsoleReturn = ReturnType<typeof useSealConsole>;
