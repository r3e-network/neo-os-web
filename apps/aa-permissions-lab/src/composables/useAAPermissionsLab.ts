/**
 * useAAPermissionsLab — Domain logic for AA Permissions Lab
 *
 * Inspect and update verifier/hook bindings on the AA core contract.
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, reactive } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

export interface UseAAPermissionsLabOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAPermissionsLab({ chain, eventBus, t }: UseAAPermissionsLabOptions) {
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
      eventBus.emit("inspect:success", {});
    } catch (error: unknown) {
      eventBus.emit("inspect:error", { message: formatErrorMessage(error, t("inspectFailed")) });
      throw error;
    } finally {
      isRefreshing.value = false;
    }
  };

  const submitVerifier = async () => {
    try {
      isVerifierBusy.value = true;
      await chain.ensureWallet();
      await chain.invokeWrite(aaCore, "updateVerifier", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.verifierHash) },
        { type: "ByteArray", value: form.verifierParamsHex.trim().replace(/^0x/, "") },
      ]);
      eventBus.emit("verifier:success", {});
      await refreshState();
    } catch (error: unknown) {
      eventBus.emit("verifier:error", { message: formatErrorMessage(error, t("updateVerifierFailed")) });
      throw error;
    } finally {
      isVerifierBusy.value = false;
    }
  };

  const submitHook = async () => {
    try {
      isHookBusy.value = true;
      await chain.ensureWallet();
      await chain.invokeWrite(aaCore, "updateHook", [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.hookHash) },
      ]);
      eventBus.emit("hook:success", {});
      await refreshState();
    } catch (error: unknown) {
      eventBus.emit("hook:error", { message: formatErrorMessage(error, t("updateHookFailed")) });
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
