/**
 * useAAPermissionsLab -- Domain logic for AA Permissions Lab (OS Services)
 *
 * Uses createObservable instead of Vue ref/computed/reactive.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { ChainService } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { normalizeScriptHash } from "@shared/utils/neo";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";

export interface UseAAPermissionsLabOptions {
  chain: ChainService;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAPermissionsLab({ chain, storageService, t }: UseAAPermissionsLabOptions) {
  const network = getNetwork();
  const aaCore = getExternalIntegrationConfig(network).contracts.aaCore;

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

  const formatPermissionValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return t("notAvailable");
    }
    return String(value);
  };

  // 20-byte script hash, optional 0x prefix (e.g. 0x + 40 hex chars).
  // The prefix group must be (0x)? — `0x?` would mean "literal 0, optional x"
  // and reject a bare un-prefixed 40-hex hash (which normalizeScriptHash accepts).
  const SCRIPT_HASH_RE = /^(0x)?[0-9a-fA-F]{40}$/;
  // Even-length hex byte string, optional 0x prefix (empty payload allowed).
  const HEX_BYTES_RE = /^(0x)?([0-9a-fA-F]{2})*$/;

  const requireScriptHash = (raw: string) => {
    const value = String(raw ?? "").trim();
    if (!SCRIPT_HASH_RE.test(value)) {
      throw new Error(t("invalidHash"));
    }
    return value;
  };

  const requireHexBytes = (raw: string) => {
    const value = String(raw ?? "").trim();
    if (!HEX_BYTES_RE.test(value)) {
      throw new Error(t("invalidParams"));
    }
    return value;
  };

  const refreshState = async () => {
    try {
      isRefreshing.set(true);
      requireScriptHash(form.accountIdHash);
      const accountId = normalizeScriptHash(form.accountIdHash).replace(/^0x/, "");
      const [verifier, hook, backup] = await Promise.all([
        chain.read("getVerifier", [{ type: "Hash160", value: `0x${accountId}` }], { scriptHash: aaCore }),
        chain.read("getHook", [{ type: "Hash160", value: `0x${accountId}` }], { scriptHash: aaCore }),
        chain.read("getBackupOwner", [{ type: "Hash160", value: `0x${accountId}` }], { scriptHash: aaCore }),
      ]);
      currentVerifier.set(formatPermissionValue(verifier));
      currentHook.set(formatPermissionValue(hook));
      currentBackupOwner.set(formatPermissionValue(backup));

      if (chain.isConnected.get()) {
        storageService.set(`permissions:${accountId}`, {
          verifier: currentVerifier.get(),
          hook: currentHook.get(),
          backupOwner: currentBackupOwner.get(),
          inspectedAt: Date.now(),
        }).catch(() => {});
      }
    } catch (error: unknown) {
      throw error;
    } finally {
      isRefreshing.set(false);
    }
  };

  const submitVerifier = async () => {
    try {
      isVerifierBusy.set(true);
      requireScriptHash(form.accountIdHash);
      requireScriptHash(form.verifierHash);
      requireHexBytes(form.verifierParamsHex);
      await chain.invoke("updateVerifier", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.verifierHash) },
        { type: "ByteArray", value: form.verifierParamsHex.trim().replace(/^0x/, "") },
      ], { scriptHash: aaCore });
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
      requireScriptHash(form.accountIdHash);
      requireScriptHash(form.hookHash);
      await chain.invoke("updateHook", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.hookHash) },
      ], { scriptHash: aaCore });
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
