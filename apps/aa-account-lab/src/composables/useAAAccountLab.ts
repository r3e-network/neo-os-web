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
import { deriveAAAccountIdHash } from "@shared/utils/aa-account";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

export interface UseAAAccountLabOptions {
  chain: ChainService;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAAccountLab({ chain, storageService, t }: UseAAAccountLabOptions) {
  const integration = getExternalIntegrationConfig("testnet");
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
    get: () => t("testnet"),
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
      const escapeTimelock = parseInt(registerForm.escapeTimelock, 10) || 2592000;
      const verifierParams = registerForm.verifierParamsHex.trim().replace(/^0x/, "");

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
