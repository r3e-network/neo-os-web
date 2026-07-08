/**
 * useAAPermissionsLab -- Domain logic for AA Permissions Lab (OS Services)
 *
 * Uses createObservable instead of Vue ref/computed/reactive.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
  parseInvokeResult,
} from "@shared/utils/neo";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";

export interface UseAAPermissionsLabOptions {
  app: MiniAppFramework;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAPermissionsLab({ app, storageService, t }: UseAAPermissionsLabOptions) {
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

  // True once a read completes — gates the "configured" chip and the detail
  // grid so typing junk hex never asserts unfetched state.
  const hasInspected = createObservable(false);

  // Two-phase rotation state (UnifiedSmartWalletV3 uses propose -> timelock ->
  // confirm). When a pending update exists the UI shows a confirm/cancel banner.
  const hasPendingVerifier = createObservable(false);
  const hasPendingHook = createObservable(false);
  const pendingVerifierUnlockAt = createObservable(0);
  const pendingHookUnlockAt = createObservable(0);

  const isRefreshing = createObservable(false);
  const isVerifierBusy = createObservable(false);
  const isHookBusy = createObservable(false);

  // Hash160 reads come back little-endian; parseHash160 reverses them to the
  // canonical 0x display form so they match the hashes the user types directly
  // below. Empty/zero reads collapse to the localized placeholder.
  const formatPermissionValue = (value: unknown) => {
    const display = parseHash160(value);
    if (!display || /^0x0{40}$/i.test(display)) {
      return t("notAvailable");
    }
    return display;
  };

  // The connected wallet as a bare lowercase script hash, "" when disconnected.
  const connectedWalletHash = (): string => {
    const addr = app.chain.address.get();
    if (!addr) return "";
    // framework-exempt: false-not-throw comparison key — an unparsable wallet
    // address must compare as "" (assertAuthorized defers to the contract),
    // not throw the way app.chain.arg.hash160 / app.wallet.scriptHash() would.
    try {
      const hash = addressToScriptHash(addr).replace(/^0x/, "").toLowerCase();
      return /^[0-9a-f]{40}$/.test(hash) ? hash : "";
    } catch {
      return "";
    }
  };

  // Reactive 0x display of the connected wallet, for the authorization check.
  const connectedWalletDisplay = {
    get: () => {
      const hash = connectedWalletHash();
      return hash ? `0x${hash}` : "";
    },
    set: () => {},
    subscribe: (fn: () => void) => app.chain.address.subscribe(fn),
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
      const idArg = [app.chain.arg.hash160(`0x${accountId}`)];
      const [
        verifier,
        hook,
        backup,
        pendingVerifier,
        pendingHook,
        pendingVerifierTime,
        pendingHookTime,
      ] = await Promise.all([
        app.chain.readRaw("getVerifier", idArg, { scriptHash: aaCore }),
        app.chain.readRaw("getHook", idArg, { scriptHash: aaCore }),
        app.chain.readRaw("getBackupOwner", idArg, { scriptHash: aaCore }),
        app.chain.readRaw("hasPendingVerifierUpdate", idArg, { scriptHash: aaCore }),
        app.chain.readRaw("hasPendingHookUpdate", idArg, { scriptHash: aaCore }),
        app.chain.readRaw("getPendingVerifierUpdateTime", idArg, { scriptHash: aaCore }),
        app.chain.readRaw("getPendingHookUpdateTime", idArg, { scriptHash: aaCore }),
      ]);
      currentVerifier.set(formatPermissionValue(verifier));
      currentHook.set(formatPermissionValue(hook));
      currentBackupOwner.set(formatPermissionValue(backup));
      hasPendingVerifier.set(Boolean(parseInvokeResult(pendingVerifier)));
      hasPendingHook.set(Boolean(parseInvokeResult(pendingHook)));
      pendingVerifierUnlockAt.set(Number(parseInvokeResult(pendingVerifierTime) ?? 0));
      pendingHookUnlockAt.set(Number(parseInvokeResult(pendingHookTime) ?? 0));
      hasInspected.set(true);

      if (app.wallet.isConnected()) {
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

  // Block a write when the connected wallet is not the account's backup owner.
  // The contract enforces owner authorization, so an unauthorized signer would
  // otherwise hit a raw on-chain ABORT after signing. Only enforced once a read
  // resolved the backup owner and a wallet is connected; an unknown owner (read
  // not yet done) lets the contract be the final authority.
  const assertAuthorized = () => {
    const wallet = connectedWalletHash();
    const owner = currentBackupOwner.get().replace(/^0x/i, "").toLowerCase();
    if (!wallet || !/^[0-9a-f]{40}$/.test(owner)) return;
    if (owner !== wallet) {
      throw new Error(t("notBackupOwner"));
    }
  };

  const submitVerifier = async () => {
    try {
      isVerifierBusy.set(true);
      requireScriptHash(form.accountIdHash);
      requireScriptHash(form.verifierHash);
      requireHexBytes(form.verifierParamsHex);
      assertAuthorized();
      await app.chain.invoke("updateVerifier", [
        app.chain.arg.hash160(form.accountIdHash),
        app.chain.arg.hash160(form.verifierHash),
        app.chain.arg.byteArray(form.verifierParamsHex.trim().replace(/^0x/, "")),
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
      assertAuthorized();
      await app.chain.invoke("updateHook", [
        app.chain.arg.hash160(form.accountIdHash),
        app.chain.arg.hash160(form.hookHash),
      ], { scriptHash: aaCore });
      await refreshState();
    } catch (error: unknown) {
      throw error;
    } finally {
      isHookBusy.set(false);
    }
  };

  // Second phase of the two-step rotation: confirm/cancel a pending proposal.
  // The same account-id Hash160 arg drives all four contract calls.
  const runPendingAction = async (
    operation: string,
    busy: ReturnType<typeof createObservable<boolean>>,
  ) => {
    try {
      busy.set(true);
      requireScriptHash(form.accountIdHash);
      await app.chain.invoke(operation, [
        app.chain.arg.hash160(form.accountIdHash),
      ], { scriptHash: aaCore });
      await refreshState();
    } catch (error: unknown) {
      throw error;
    } finally {
      busy.set(false);
    }
  };

  const confirmVerifier = () => runPendingAction("confirmVerifierUpdate", isVerifierBusy);
  const cancelVerifier = () => runPendingAction("cancelVerifierUpdate", isVerifierBusy);
  const confirmHook = () => runPendingAction("confirmHookUpdate", isHookBusy);
  const cancelHook = () => runPendingAction("cancelHookUpdate", isHookBusy);

  const loadAll = async () => {};

  return {
    form,
    currentVerifier,
    currentHook,
    currentBackupOwner,
    hasInspected,
    hasPendingVerifier,
    hasPendingHook,
    pendingVerifierUnlockAt,
    pendingHookUnlockAt,
    connectedWalletDisplay,
    isRefreshing,
    isVerifierBusy,
    isHookBusy,
    aaCore,
    refreshState,
    submitVerifier,
    confirmVerifier,
    cancelVerifier,
    confirmHook,
    cancelHook,
    submitHook,
    loadAll,
  };
}

export type UseAAPermissionsLabReturn = ReturnType<typeof useAAPermissionsLab>;
