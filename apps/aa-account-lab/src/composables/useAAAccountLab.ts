/**
 * useAAAccountLab -- Domain logic for AA Account Lab (OS Services)
 *
 * Uses createObservable instead of Vue ref/computed/reactive.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import {
  deriveAAAccountIdHash,
  AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS,
} from "@shared/utils/aa-account";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";

export interface UseAAAccountLabOptions {
  chain: ChainService;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAAccountLab({ chain, storageService, t }: UseAAAccountLabOptions) {
  const network = getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const aaCore = integration.contracts.aaCore;
  const defaultVerifier = integration.contracts.aaWeb3AuthVerifier;

  // Form state (plain objects, not reactive -- mutations happen through actions)
  const inspectForm = { accountIdInput: "" };
  const registerForm = {
    accountIdInput: "",
    verifierHash: defaultVerifier,
    verifierParamsHex: "",
    hookHash: "",
    backupOwner: "",
    escapeTimelock: "2592000",
  };

  // Inspected state
  const currentVerifier = createObservable(t("notAvailable"));
  const currentHook = createObservable(t("notAvailable"));
  const currentBackupOwner = createObservable(t("notAvailable"));
  // Explicit flag: true once a read has completed successfully, regardless of
  // whether the account has a verifier set. Distinguishes "not inspected yet"
  // from "inspected, verifier is empty".
  const hasInspected = createObservable(false);

  // Loading states
  const isInspecting = createObservable(false);
  const isSubmitting = createObservable(false);

  // Display values
  const aaCoreDisplay: Observable<string> = {
    get: () => aaCore,
    set: () => {},
    subscribe: () => () => {},
  };

  const defaultVerifierDisplay: Observable<string> = {
    get: () => defaultVerifier,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  // Helpers
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

  // Parse + validate the escape timelock before any chain round-trip. Rejects
  // non-integers, 0, negatives, and out-of-range values (uint32 / 7-90 day
  // bounds enforced by the contract) with a clear, immediate, localized error
  // instead of a confusing low-level wallet failure.
  function parseEscapeTimelock(value: string): number {
    const trimmed = String(value || "").trim();
    if (!/^[0-9]+$/.test(trimmed)) throw new Error(t("invalidTimelock"));
    const seconds = Number.parseInt(trimmed, 10);
    if (
      !Number.isInteger(seconds) ||
      seconds < AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS ||
      seconds > AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS
    ) {
      throw new Error(t("invalidTimelock"));
    }
    return seconds;
  }

  // Strip an optional 0x prefix and validate that the verifier params are valid
  // even-length hex before sending as a ByteArray arg, so odd-length or non-hex
  // input surfaces a localized error instead of an opaque serialization failure.
  function sanitizeVerifierParams(value: string): string {
    const normalized = String(value || "").trim().replace(/^0x/i, "");
    if (normalized && (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized))) {
      throw new Error(t("invalidVerifierParams"));
    }
    return normalized;
  }

  const inspectAccount = async () => {
    try {
      isInspecting.set(true);
      const accountIdHash = deriveAccountIdHash(inspectForm.accountIdInput);
      const accountId = `0x${accountIdHash}`;

      const [verifierResult, hookResult, backupResult] = await Promise.all([
        chain.read("getVerifier", [{ type: "Hash160", value: accountId }], { scriptHash: aaCore }),
        chain.read("getHook", [{ type: "Hash160", value: accountId }], { scriptHash: aaCore }),
        chain.read("getBackupOwner", [{ type: "Hash160", value: accountId }], { scriptHash: aaCore }),
      ]);

      currentVerifier.set(String(parseInvokeResult(verifierResult) || t("notAvailable")));
      currentHook.set(String(parseInvokeResult(hookResult) || t("notAvailable")));
      currentBackupOwner.set(String(parseInvokeResult(backupResult) || t("notAvailable")));
      // The read succeeded: surface the detail grid even when verifier/hook are
      // empty, rather than masking it behind the "not inspected" placeholder.
      hasInspected.set(true);

      storageService.set(`account:${accountIdHash}`, {
        verifier: currentVerifier.get(),
        hook: currentHook.get(),
        backupOwner: currentBackupOwner.get(),
        inspectedAt: Date.now(),
      }).catch(() => {});
    } catch (error: unknown) {
      throw error;
    } finally {
      isInspecting.set(false);
    }
  };

  const submitRegister = async () => {
    try {
      isSubmitting.set(true);
      const accountIdHash = deriveAccountIdHash(registerForm.accountIdInput);
      const verifierHash = normalizeHashOrZero(registerForm.verifierHash);
      const hookHash = normalizeHashOrZero(registerForm.hookHash);
      const backupOwner = normalizeBackupOwner(registerForm.backupOwner);
      const escapeTimelock = parseEscapeTimelock(registerForm.escapeTimelock);
      const verifierParams = sanitizeVerifierParams(registerForm.verifierParamsHex);

      await chain.invoke(
        "registerAccount",
        [
          { type: "Hash160", value: `0x${accountIdHash}` },
          { type: "Hash160", value: verifierHash },
          { type: "ByteArray", value: verifierParams },
          { type: "Hash160", value: hookHash },
          { type: "Hash160", value: backupOwner },
          { type: "Integer", value: String(escapeTimelock) },
        ],
        { scriptHash: aaCore },
      );

      storageService.set(`registered:${accountIdHash}`, {
        verifier: verifierHash,
        hook: hookHash,
        backupOwner,
        escapeTimelock,
        registeredAt: Date.now(),
      }).catch(() => {});
    } catch (error: unknown) {
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  };

  const loadAll = async () => {};

  return {
    inspectForm,
    registerForm,
    currentVerifier,
    currentHook,
    currentBackupOwner,
    hasInspected,
    isInspecting,
    isSubmitting,
    aaCoreDisplay,
    defaultVerifierDisplay,
    networkDisplay,
    aaCore,
    inspectAccount,
    submitRegister,
    loadAll,
  };
}

export type UseAAAccountLabReturn = ReturnType<typeof useAAAccountLab>;
