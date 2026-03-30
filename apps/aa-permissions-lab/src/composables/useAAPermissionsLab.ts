/**
 * useAAPermissionsLab — Domain logic for AA Permissions Lab (OS Services)
 *
 * This app primarily uses the AA platform service for account abstraction
 * operations. The chain service is retained for aaCore contract reads/writes
 * since there is no OS-level AA proxy.
 *
 * What changed:
 * - StorageProxy added for caching inspected permissions state
 * - ChainService retained for aaCore contract reads/writes
 *
 * The composable calls:
 *   chain.invokeRead(aaCore, "getVerifier", [...])      — read verifier
 *   chain.invokeRead(aaCore, "getHook", [...])          — read hook
 *   chain.invokeRead(aaCore, "getBackupOwner", [...])   — read backup
 *   chain.invokeWrite(aaCore, "updateVerifier", [...])  — update verifier
 *   chain.invokeWrite(aaCore, "updateHook", [...])      — update hook
 *   storageService.set(`permissions:${hash}`, data)     — cache results
 */

import { ref, reactive } from "vue";
import type { ChainService } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

export interface UseAAPermissionsLabOptions {
  /** ChainService for aaCore contract reads/writes (platform service) */
  chain: ChainService;
  /** OS StorageProxy for caching inspected state */
  storageService: StorageProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAPermissionsLab({ chain, storageService, t }: UseAAPermissionsLabOptions) {
  const aaCore = getExternalIntegrationConfig("testnet").contracts.aaCore;

  const form = reactive({
    accountIdHash: "",
    verifierHash: "",
    verifierParamsHex: "",
    hookHash: "",
  });

  const currentVerifier = ref(t("notAvailable"));
  const currentHook = ref(t("notAvailable"));
  const currentBackupOwner = ref(t("notAvailable"));

  const isRefreshing = ref(false);
  const isVerifierBusy = ref(false);
  const isHookBusy = ref(false);

  /**
   * Refresh AA account permissions state.
   * Uses chain.invokeRead for aaCore contract reads (platform service),
   * then caches results via StorageProxy for persistence.
   */
  const refreshState = async () => {
    try {
      isRefreshing.value = true;
      const accountId = normalizeScriptHash(form.accountIdHash).replace(/^0x/, "");
      const [verifier, hook, backup] = await Promise.all([
        chain.invokeRead(aaCore, "getVerifier", [{ type: "Hash160", value: `0x${accountId}` }]),
        chain.invokeRead(aaCore, "getHook", [{ type: "Hash160", value: `0x${accountId}` }]),
        chain.invokeRead(aaCore, "getBackupOwner", [{ type: "Hash160", value: `0x${accountId}` }]),
      ]);
      currentVerifier.value = String(parseInvokeResult(verifier) || t("notAvailable"));
      currentHook.value = String(parseInvokeResult(hook) || t("notAvailable"));
      currentBackupOwner.value = String(parseInvokeResult(backup) || t("notAvailable"));

      // Cache inspected permissions state via StorageProxy
      storageService.set(`permissions:${accountId}`, {
        verifier: currentVerifier.value,
        hook: currentHook.value,
        backupOwner: currentBackupOwner.value,
        inspectedAt: Date.now(),
      }).catch(() => {});
    } catch (error: unknown) {
      throw error;
    } finally {
      isRefreshing.value = false;
    }
  };

  /**
   * Update verifier binding on the aaCore contract.
   * Uses chain.invokeWrite (platform service) for the write operation.
   */
  const submitVerifier = async () => {
    try {
      isVerifierBusy.value = true;
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
      isVerifierBusy.value = false;
    }
  };

  /**
   * Update hook binding on the aaCore contract.
   * Uses chain.invokeWrite (platform service) for the write operation.
   */
  const submitHook = async () => {
    try {
      isHookBusy.value = true;
      await chain.ensureWallet();
      await chain.invokeWrite(aaCore, "updateHook", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.hookHash) },
      ]);
      await refreshState();
    } catch (error: unknown) {
      throw error;
    } finally {
      isHookBusy.value = false;
    }
  };

  const loadAll = async () => {
    // No initial data to load — inspect is user-triggered
  };

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
