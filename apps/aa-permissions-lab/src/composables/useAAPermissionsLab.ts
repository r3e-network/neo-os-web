/**
 * useAAPermissionsLab -- Domain logic for AA Permissions Lab (OS Services)
 *
 * Uses createObservable instead of Vue ref/computed/reactive.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { ChainService } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

export interface UseAAPermissionsLabOptions {
  chain: ChainService;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAPermissionsLab({ chain, storageService, t }: UseAAPermissionsLabOptions) {
  const aaCore = getExternalIntegrationConfig("testnet").contracts.aaCore;

  const form = {
    accountIdHash: "",
    verifierHash: "",
    verifierParamsHex: "",
    hookHash: "",
  };

  const currentVerifier = createObservable(t("notAvailable"));
  const currentHook = createObservable(t("notAvailable"));
  const currentBackupOwner = createObservable(t("notAvailable"));

  const isRefreshing = createObservable(false);
  const isVerifierBusy = createObservable(false);
  const isHookBusy = createObservable(false);

  const refreshState = async () => {
    try {
      isRefreshing.set(true);
      const accountId = normalizeScriptHash(form.accountIdHash).replace(/^0x/, "");
      const [verifier, hook, backup] = await Promise.all([
        chain.invokeRead(aaCore, "getVerifier", [{ type: "Hash160", value: `0x${accountId}` }]),
        chain.invokeRead(aaCore, "getHook", [{ type: "Hash160", value: `0x${accountId}` }]),
        chain.invokeRead(aaCore, "getBackupOwner", [{ type: "Hash160", value: `0x${accountId}` }]),
      ]);
      currentVerifier.set(String(parseInvokeResult(verifier) || t("notAvailable")));
      currentHook.set(String(parseInvokeResult(hook) || t("notAvailable")));
      currentBackupOwner.set(String(parseInvokeResult(backup) || t("notAvailable")));

      storageService.set(`permissions:${accountId}`, {
        verifier: currentVerifier.get(),
        hook: currentHook.get(),
        backupOwner: currentBackupOwner.get(),
        inspectedAt: Date.now(),
      }).catch(() => {});
    } catch (error: unknown) {
      throw error;
    } finally {
      isRefreshing.set(false);
    }
  };

  const submitVerifier = async () => {
    try {
      isVerifierBusy.set(true);
      await chain.ensureWallet();
      await chain.invokeWrite(aaCore, "updateVerifier", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.verifierHash) },
        { type: "ByteArray", value: form.verifierParamsHex.trim().replace(/^0x/, "") },
      ]);
      await refreshState();
    } catch (error: unknown) {
      throw error;
    } finally {
      isVerifierBusy.set(false);
    }
  };

  const submitHook = async () => {
    try {
      isHookBusy.set(true);
      await chain.ensureWallet();
      await chain.invokeWrite(aaCore, "updateHook", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.hookHash) },
      ]);
      await refreshState();
    } catch (error: unknown) {
      throw error;
    } finally {
      isHookBusy.set(false);
    }
  };

  const loadAll = async () => {};

  return {
    form,
    currentVerifier,
    currentHook,
    currentBackupOwner,
    isRefreshing,
    isVerifierBusy,
    isHookBusy,
    aaCore,
    refreshState,
    submitVerifier,
    submitHook,
    loadAll,
  };
}

export type UseAAPermissionsLabReturn = ReturnType<typeof useAAPermissionsLab>;
