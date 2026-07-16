import { createDerived, createObservable, createReadCell } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { FrameworkContractArg } from "@framework/index";
import { addressToScriptHash } from "@shared/utils/neo";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";
import {
  buildPendingPermissionTransaction,
  buildProposalContext,
  explicitPermissionNetwork,
  isPermissionBindingCurrent,
  isPermissionUnlockReady,
  normalizePermissionHash,
  normalizeVerifierParams,
  parsePermissionBoolean,
  parsePermissionHash,
  parsePermissionTimestamp,
  readPermissionTransactionState,
  permissionContractOperation,
  permissionOperationEvent,
  permissionTransactionSatisfied,
  requirePermissionHash,
  restorePendingPermissionTransaction,
  restoreProposalContext,
  validatePendingTimes,
  ZERO_HASH,
  type PendingPermissionTransaction,
  type PermissionLane,
  type PermissionNetwork,
  type PermissionOperation,
  type PermissionProposalContext,
  type PermissionSnapshot,
  type PermissionTransactionState,
} from "../permissions";

export interface UseAAPermissionsLabOptions {
  app: MiniAppFramework;
  network: PermissionNetwork;
  t: (key: string, params?: Record<string, string | number>) => string;
  transactionStateReader?: (
    network: PermissionNetwork,
    txid: string,
  ) => Promise<PermissionTransactionState>;
}

export interface PermissionWriteOutcome {
  txid: string;
  operation: PermissionOperation;
  confirmed: boolean;
  immediateInstall: boolean;
}

const PENDING_TRANSACTION_KEY = "permissions/pending-transaction-v1";
const STORAGE_PROBE_KEY = "permissions/storage-probe-v1";
const PROPOSAL_CONTEXT_KEYS: Record<PermissionLane, string> = {
  verifier: "permissions/proposal-verifier-v1",
  hook: "permissions/proposal-hook-v1",
};

function errorKey(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.startsWith("permissionReadInvalid:")) return "permissionReadInvalid";
  if (/^[a-z][a-zA-Z]+$/.test(raw)) return raw;
  return "permissionOperationFailed";
}

export function useAAPermissionsLab({
  app,
  network,
  t,
  transactionStateReader = readPermissionTransactionState,
}: UseAAPermissionsLabOptions) {
  const aaCore = requirePermissionHash(
    getExternalIntegrationConfig(network).contracts.aaCore,
    false,
  );

  const form = {
    accountIdHash: "",
    verifierHash: "",
    verifierParamsHex: "",
    hookHash: "",
  };

  /**
   * The one on-chain truth this lab renders: the inspected account's
   * PermissionSnapshot, held in a platform read-cell (read-cell adoption).
   * `value === undefined` IS "nothing has been inspected yet" — every binding
   * observable below is a projection of this single cell, so the nine
   * hand-fanned observables can never drift apart. The cell's epoch guard owns
   * the read lane's last-write-wins (the job `readEpoch` used to hand-roll);
   * verified-write paths publish straight onto `value` — they just
   * round-tripped the new truth, so they own the snapshot as much as a read.
   */
  const snapshotCell = createReadCell<PermissionSnapshot>(() =>
    readPermissionSnapshot(form.accountIdHash),
  );

  // These project a hash160, or "" for the zero hash — which
  // `parsePermissionHash` returns to mean "this account has NO binding on that
  // lane". "" is therefore a real reading, not an absence, and the two must
  // not be conflated: they stay `undefined` while the cell holds no snapshot
  // (nothing has been inspected yet) so the chrome can tell "not inspected"
  // apart from "inspected, and nothing is bound".
  const currentVerifier = createDerived<string | undefined>(
    () => snapshotCell.value.get()?.verifier,
    [snapshotCell.value],
  );
  const currentHook = createDerived<string | undefined>(
    () => snapshotCell.value.get()?.hook,
    [snapshotCell.value],
  );
  const currentBackupOwner = createDerived<string | undefined>(
    () => snapshotCell.value.get()?.backupOwner,
    [snapshotCell.value],
  );
  const inspectedAccountId = createDerived(
    () => snapshotCell.value.get()?.accountId ?? "",
    [snapshotCell.value],
  );
  const permissionSnapshot = createDerived<PermissionSnapshot | null>(
    () => snapshotCell.value.get() ?? null,
    [snapshotCell.value],
  );
  const hasInspected = createDerived(
    () => snapshotCell.value.get() !== undefined,
    [snapshotCell.value],
  );

  /**
   * Chrome read-outs for the three bindings above. The shell renders manifest
   * bindings with no gate of its own, so an uninspected account published three
   * blank tiles — a void wearing a quiet costume.
   *
   * Three states, kept apart:
   *   · `undefined` — not inspected. The manifest's `pendingKey` says so.
   *   · ""          — inspected, and the lane holds the zero hash. A real
   *                   reading, and it gets words rather than a blank tile.
   *   · a hash      — inspected, and this is the binding.
   *
   * The raw observables stay raw: the PlayArea compares them with `sameHash`.
   */
  const bindingDisplay = (source: Observable<string | undefined>) =>
    createDerived(() => {
      const value = source.get();
      if (value === undefined) return undefined;
      return value === "" ? t("bindingNone") : value;
    }, [source]);
  const currentVerifierDisplay = bindingDisplay(currentVerifier);
  const currentHookDisplay = bindingDisplay(currentHook);
  const currentBackupOwnerDisplay = bindingDisplay(currentBackupOwner);
  const hasPendingVerifier = createDerived(
    () => snapshotCell.value.get()?.hasPendingVerifier ?? false,
    [snapshotCell.value],
  );
  const hasPendingHook = createDerived(
    () => snapshotCell.value.get()?.hasPendingHook ?? false,
    [snapshotCell.value],
  );
  const pendingVerifierUnlockAt = createDerived(
    () => snapshotCell.value.get()?.pendingVerifierUnlockAt ?? 0,
    [snapshotCell.value],
  );
  const pendingHookUnlockAt = createDerived(
    () => snapshotCell.value.get()?.pendingHookUnlockAt ?? 0,
    [snapshotCell.value],
  );
  const proposalVerifier = createObservable<PermissionProposalContext | null>(null);
  const proposalHook = createObservable<PermissionProposalContext | null>(null);

  // "loading" only while a cell read is in flight — the write paths keep their
  // own busy flags below, exactly as before.
  const isRefreshing = createDerived(
    () => snapshotCell.status.get() === "loading",
    [snapshotCell.status],
  );
  const isVerifierBusy = createObservable(false);
  const isHookBusy = createObservable(false);
  const isRecovering = createObservable(false);
  const isCheckingWallet = createObservable(false);
  const readError = createObservable("");
  const lastWriteStatus = createObservable(t("transactionIdle"));
  const pendingTransaction = createObservable<PendingPermissionTransaction | null>(null);
  const pendingTxid = createObservable("");
  const storageHealthy = createObservable(true);
  const walletNetwork = createObservable("");
  const walletNetworkMatches = createObservable(false);

  // The cell's epoch owns value/status last-write-wins; this ticket owns the
  // caller-side effects a superseded refresh must NOT run (readError copy, the
  // proposal-context continuation, and the resolve-null-instead-of-rethrow
  // contract).
  let refreshTicket = 0;
  let disposed = false;

  const safeStorageGet = <T,>(key: string, fallback: T): T => {
    try {
      const value = app.storage.local.get<T>(key, fallback);
      return value ?? fallback;
    } catch {
      storageHealthy.set(false);
      return fallback;
    }
  };

  const safeStorageSet = (key: string, value: unknown) => {
    try {
      app.storage.local.set(key, value);
      return true;
    } catch {
      storageHealthy.set(false);
      return false;
    }
  };

  const safeStorageDelete = (key: string) => {
    try {
      app.storage.local.delete(key);
      return true;
    } catch {
      storageHealthy.set(false);
      return false;
    }
  };

  const assertRecoveryStorage = () => {
    const probe = { checkedAt: Date.now(), token: `${Date.now()}-${Math.random()}` };
    if (!safeStorageSet(STORAGE_PROBE_KEY, probe)) {
      throw new Error("recoveryStorageUnavailable");
    }
    const restored = safeStorageGet<{ checkedAt: number; token: string } | null>(
      STORAGE_PROBE_KEY,
      null,
    );
    if (restored?.token !== probe.token) {
      storageHealthy.set(false);
      throw new Error("recoveryStorageUnavailable");
    }
    if (!safeStorageDelete(STORAGE_PROBE_KEY)) {
      throw new Error("recoveryStorageUnavailable");
    }
    storageHealthy.set(true);
  };

  const connectedWalletHash = (fallbackAddress = "") => {
    const address = String(app.chain.address.get() ?? fallbackAddress).trim();
    if (!address) return "";
    const directHash = normalizePermissionHash(address, false);
    if (directHash) return directHash;
    try {
      return requirePermissionHash(addressToScriptHash(address), false);
    } catch {
      return "";
    }
  };

  const connectedWalletDisplay = {
    get: () => connectedWalletHash(),
    set: () => {},
    subscribe: (fn: () => void) => app.chain.address.subscribe(fn),
  };

  const clearProposalObservables = () => {
    proposalVerifier.set(null);
    proposalHook.set(null);
  };

  const clearSnapshot = () => {
    // Back to unread, NOT to "" — "" would claim this account has no verifier,
    // hook, or backup owner bound, which is a reading nobody took. Setting the
    // cell's value (rather than reset()) deliberately leaves the cell's epoch
    // alone: a refresh already in flight keeps its right to publish, exactly
    // as the fan-out clears behaved before the cell.
    snapshotCell.value.set(undefined);
    clearProposalObservables();
  };

  const proposalObservable = (lane: PermissionLane) =>
    lane === "verifier" ? proposalVerifier : proposalHook;

  const loadProposalContexts = (snapshot: PermissionSnapshot) => {
    for (const lane of ["verifier", "hook"] as const) {
      const key = PROPOSAL_CONTEXT_KEYS[lane];
      const raw = safeStorageGet<unknown>(key, null);
      const restored = restoreProposalContext(raw, snapshot);
      if (raw && !restored) safeStorageDelete(key);
      proposalObservable(lane).set(restored);
    }
  };

  // Runs after a snapshot lands on the cell — whichever lane published it
  // (a cell read, or a verified write's blessed `value.set`).
  const snapshotApplied = (snapshot: PermissionSnapshot) => {
    readError.set("");
    loadProposalContexts(snapshot);
  };

  const applySnapshot = (snapshot: PermissionSnapshot) => {
    // Blessed publish: the write paths just round-tripped this snapshot from
    // chain, so it is as authoritative as a cell read.
    snapshotCell.value.set(snapshot);
    snapshotApplied(snapshot);
  };

  const readPermissionSnapshot = async (accountInput: string): Promise<PermissionSnapshot> => {
    const accountId = requirePermissionHash(accountInput, false);
    const idArg = [app.chain.arg.hash160(accountId)];
    const [
      verifierRaw,
      hookRaw,
      backupOwnerRaw,
      pendingVerifierRaw,
      pendingHookRaw,
      pendingVerifierTimeRaw,
      pendingHookTimeRaw,
    ] = await Promise.all([
      app.chain.readRaw("getVerifier", idArg, { scriptHash: aaCore }),
      app.chain.readRaw("getHook", idArg, { scriptHash: aaCore }),
      app.chain.readRaw("getBackupOwner", idArg, { scriptHash: aaCore }),
      app.chain.readRaw("hasPendingVerifierUpdate", idArg, { scriptHash: aaCore }),
      app.chain.readRaw("hasPendingHookUpdate", idArg, { scriptHash: aaCore }),
      app.chain.readRaw("getPendingVerifierUpdateTime", idArg, { scriptHash: aaCore }),
      app.chain.readRaw("getPendingHookUpdateTime", idArg, { scriptHash: aaCore }),
    ]);

    return validatePendingTimes({
      network,
      aaCore,
      accountId,
      verifier: parsePermissionHash(verifierRaw, "verifier"),
      hook: parsePermissionHash(hookRaw, "hook"),
      backupOwner: parsePermissionHash(backupOwnerRaw, "backupOwner", false),
      hasPendingVerifier: parsePermissionBoolean(pendingVerifierRaw, "pendingVerifier"),
      hasPendingHook: parsePermissionBoolean(pendingHookRaw, "pendingHook"),
      pendingVerifierUnlockAt: parsePermissionTimestamp(
        pendingVerifierTimeRaw,
        "pendingVerifierTime",
      ),
      pendingHookUnlockAt: parsePermissionTimestamp(pendingHookTimeRaw, "pendingHookTime"),
      inspectedAt: Date.now(),
    });
  };

  const refreshState = async (accountInput = form.accountIdHash) => {
    const accountId = requirePermissionHash(accountInput, false);
    form.accountIdHash = accountId;
    const ticket = ++refreshTicket;
    // reset() invalidates any in-flight read's publish (the cell's epoch) and
    // returns the snapshot to unread; load() flips status to "loading" (the
    // isRefreshing projection) and publishes value/status only if this read is
    // still the newest when it settles.
    snapshotCell.reset();
    clearProposalObservables();
    readError.set("");
    try {
      const snapshot = await snapshotCell.load();
      if (disposed || ticket !== refreshTicket) return null;
      snapshotApplied(snapshot);
      return snapshot;
    } catch (error) {
      if (disposed || ticket !== refreshTicket) return null;
      // A concurrent verified write may have blessed a snapshot onto the cell
      // while this read was in flight; a failed read clears it all the same
      // (stale bindings must not survive a read the caller just watched fail).
      clearSnapshot();
      readError.set(t(errorKey(error)));
      throw error;
    }
  };

  const invalidateBinding = () => {
    refreshTicket += 1;
    snapshotCell.reset();
    clearProposalObservables();
    readError.set("");
  };

  const detectExactWalletNetwork = async () => {
    const detected = explicitPermissionNetwork(await app.chain.detectNetwork());
    walletNetwork.set(detected ?? "");
    walletNetworkMatches.set(detected === network);
    if (!detected) throw new Error("walletNetworkUnknown");
    if (detected !== network) throw new Error("walletNetworkMismatch");
    return detected;
  };

  const authorizeFreshBinding = async (accountId: string) => {
    const snapshot = permissionSnapshot.get();
    if (!isPermissionBindingCurrent(snapshot, network, aaCore, accountId)) {
      throw new Error("inspectRequired");
    }
    const ensuredAddress = await app.chain.ensureWallet();
    const walletHash = connectedWalletHash(ensuredAddress);
    if (!walletHash) throw new Error("walletAddressInvalid");
    await detectExactWalletNetwork();

    const freshOwner = parsePermissionHash(
      await app.chain.readRaw(
        "getBackupOwner",
        [app.chain.arg.hash160(accountId)],
        { scriptHash: aaCore },
      ),
      "backupOwner",
      false,
    );
    if (freshOwner !== snapshot?.backupOwner) {
      invalidateBinding();
      throw new Error("bindingChanged");
    }
    if (freshOwner !== walletHash) throw new Error("notBackupOwner");
    return walletHash;
  };

  const checkWalletAuthority = async () => {
    if (isCheckingWallet.get()) return false;
    isCheckingWallet.set(true);
    try {
      const accountId = requirePermissionHash(form.accountIdHash, false);
      await authorizeFreshBinding(accountId);
      return true;
    } finally {
      isCheckingWallet.set(false);
    }
  };

  const clearPendingTransaction = () => {
    pendingTransaction.set(null);
    pendingTxid.set("");
    safeStorageDelete(PENDING_TRANSACTION_KEY);
  };

  const persistPendingTransaction = (record: PendingPermissionTransaction) => {
    pendingTransaction.set(record);
    pendingTxid.set(record.txid);
    safeStorageSet(PENDING_TRANSACTION_KEY, record);
  };

  const persistProposalContext = (record: PendingPermissionTransaction) => {
    const context = buildProposalContext(record);
    safeStorageSet(PROPOSAL_CONTEXT_KEYS[record.lane], context);
    proposalObservable(record.lane).set(context);
  };

  const clearProposalContext = (lane: PermissionLane) => {
    safeStorageDelete(PROPOSAL_CONTEXT_KEYS[lane]);
    proposalObservable(lane).set(null);
  };

  const finalizeObservedTransaction = (
    record: PendingPermissionTransaction,
    snapshot: PermissionSnapshot,
  ) => {
    if (record.operation.startsWith("propose-")) {
      persistProposalContext(record);
    } else {
      clearProposalContext(record.lane);
    }
    clearPendingTransaction();
    applySnapshot(snapshot);
    lastWriteStatus.set(t("transactionConfirmed"));
  };

  const waitForTransactionState = async (
    record: PendingPermissionTransaction,
    eventConfirmed: boolean,
  ) => {
    try {
      const first = await readPermissionSnapshot(record.accountId);
      if (permissionTransactionSatisfied(record, first, eventConfirmed)) return first;
    } catch {
      // RPC/indexer lag is expected immediately after broadcast; poll below.
    }
    return app.chain.waitForState(
      () => readPermissionSnapshot(record.accountId),
      (snapshot) => permissionTransactionSatisfied(record, snapshot, eventConfirmed),
      { attempts: 3, firstDelayMs: 2_500, delayMs: 4_000 },
    );
  };

  const runWrite = async (input: {
    operation: PermissionOperation;
    args: FrameworkContractArg[];
    targetHash?: string;
    previousHash?: string;
    immediateInstall?: boolean;
  }): Promise<PermissionWriteOutcome> => {
    if (pendingTransaction.get()) throw new Error("transactionAlreadyPending");
    const accountId = requirePermissionHash(form.accountIdHash, false);
    assertRecoveryStorage();
    const walletHash = await authorizeFreshBinding(accountId);
    let record: PendingPermissionTransaction | null = null;
    const draft = {
      network,
      aaCore,
      accountId,
      walletHash,
      operation: input.operation,
      targetHash: input.targetHash,
      previousHash: input.previousHash,
    };

    const result = await app.chain.invoke(permissionContractOperation(input.operation), input.args, {
      scriptHash: aaCore,
      waitForEvent: permissionOperationEvent(input.operation),
      waitTimeoutMs: 45_000,
      onTransactionSent: (txid: string) => {
        try {
          record = buildPendingPermissionTransaction({ ...draft, txid });
          persistPendingTransaction(record);
        } catch {
          // A malformed/empty host txid is handled by the invoke result below.
        }
      },
    });
    if (!record) {
      if (!result.txid) throw new Error("transactionNotBroadcast");
      record = buildPendingPermissionTransaction({ ...draft, txid: result.txid });
      persistPendingTransaction(record);
    }
    if (result.txid && result.txid.toLowerCase() !== record.txid) {
      invalidateBinding();
      lastWriteStatus.set(t("transactionIdentityChanged"));
      return {
        txid: record.txid,
        operation: record.operation,
        confirmed: false,
        immediateInstall: Boolean(input.immediateInstall),
      };
    }

    const walletAfter = connectedWalletHash();
    let networkAfter: PermissionNetwork | null = null;
    try {
      networkAfter = explicitPermissionNetwork(await app.chain.detectNetwork());
    } catch {
      networkAfter = null;
    }
    walletNetwork.set(networkAfter ?? "");
    walletNetworkMatches.set(networkAfter === network);
    if (walletAfter !== walletHash || networkAfter !== network) {
      invalidateBinding();
      lastWriteStatus.set(t("transactionBindingChanged"));
      return {
        txid: record.txid,
        operation: record.operation,
        confirmed: false,
        immediateInstall: Boolean(input.immediateInstall),
      };
    }

    let confirmedSnapshot: PermissionSnapshot | null = null;
    try {
      confirmedSnapshot = await waitForTransactionState(
        record,
        result.verified === true && Boolean(result.event),
      );
    } catch {
      // The transaction is already broadcast and persisted. A read/indexer
      // outage is a recovery state, not evidence that the write failed.
      confirmedSnapshot = null;
    }
    if (confirmedSnapshot) {
      finalizeObservedTransaction(record, confirmedSnapshot);
    } else {
      lastWriteStatus.set(t("transactionAwaitingConfirmation"));
      invalidateBinding();
      pendingTransaction.set(record);
      pendingTxid.set(record.txid);
    }
    return {
      txid: record.txid,
      operation: record.operation,
      confirmed: Boolean(confirmedSnapshot),
      immediateInstall: Boolean(input.immediateInstall),
    };
  };

  const submitVerifier = async () => {
    isVerifierBusy.set(true);
    try {
      const snapshot = permissionSnapshot.get();
      const accountId = requirePermissionHash(form.accountIdHash, false);
      if (!isPermissionBindingCurrent(snapshot, network, aaCore, accountId)) {
        throw new Error("inspectRequired");
      }
      if (snapshot?.hasPendingVerifier) throw new Error("pendingVerifierExists");
      const target = requirePermissionHash(form.verifierHash);
      const previous = snapshot?.verifier || "";
      if (target === (previous || ZERO_HASH)) throw new Error("targetUnchanged");
      const params = normalizeVerifierParams(form.verifierParamsHex);
      const immediateInstall = !previous;
      return await runWrite({
        operation: immediateInstall ? "install-verifier" : "propose-verifier",
        args: [
          app.chain.arg.hash160(accountId),
          app.chain.arg.hash160(target),
          app.chain.arg.byteArray(params),
        ],
        targetHash: target,
        previousHash: previous || ZERO_HASH,
        immediateInstall,
      });
    } finally {
      isVerifierBusy.set(false);
    }
  };

  const submitHook = async () => {
    isHookBusy.set(true);
    try {
      const snapshot = permissionSnapshot.get();
      const accountId = requirePermissionHash(form.accountIdHash, false);
      if (!isPermissionBindingCurrent(snapshot, network, aaCore, accountId)) {
        throw new Error("inspectRequired");
      }
      if (snapshot?.hasPendingHook) throw new Error("pendingHookExists");
      const target = requirePermissionHash(form.hookHash);
      const previous = snapshot?.hook || "";
      if (target === (previous || ZERO_HASH)) throw new Error("targetUnchanged");
      const immediateInstall = !previous;
      return await runWrite({
        operation: immediateInstall ? "install-hook" : "propose-hook",
        args: [app.chain.arg.hash160(accountId), app.chain.arg.hash160(target)],
        targetHash: target,
        previousHash: previous || ZERO_HASH,
        immediateInstall,
      });
    } finally {
      isHookBusy.set(false);
    }
  };

  const runPendingAction = async (lane: PermissionLane, action: "confirm" | "cancel") => {
    const busy = lane === "verifier" ? isVerifierBusy : isHookBusy;
    busy.set(true);
    try {
      const snapshot = permissionSnapshot.get();
      const accountId = requirePermissionHash(form.accountIdHash, false);
      if (!isPermissionBindingCurrent(snapshot, network, aaCore, accountId)) {
        throw new Error("inspectRequired");
      }
      const pending = lane === "verifier"
        ? snapshot?.hasPendingVerifier
        : snapshot?.hasPendingHook;
      const unlockAt = lane === "verifier"
        ? snapshot?.pendingVerifierUnlockAt ?? 0
        : snapshot?.pendingHookUnlockAt ?? 0;
      if (!pending) throw new Error(lane === "verifier" ? "noPendingVerifier" : "noPendingHook");
      if (action === "confirm" && !isPermissionUnlockReady(unlockAt)) {
        throw new Error("timelockNotElapsed");
      }
      const context = proposalObservable(lane).get();
      const previous = lane === "verifier" ? snapshot?.verifier ?? "" : snapshot?.hook ?? "";
      return await runWrite({
        operation: `${action}-${lane}` as PermissionOperation,
        args: [app.chain.arg.hash160(accountId)],
        targetHash: context?.targetHash,
        previousHash: previous || ZERO_HASH,
      });
    } finally {
      busy.set(false);
    }
  };

  const confirmVerifier = () => runPendingAction("verifier", "confirm");
  const cancelVerifier = () => runPendingAction("verifier", "cancel");
  const confirmHook = () => runPendingAction("hook", "confirm");
  const cancelHook = () => runPendingAction("hook", "cancel");

  const reconcilePendingTransaction = async () => {
    const record = pendingTransaction.get();
    if (!record) return null;
    if (isRecovering.get()) return null;
    isRecovering.set(true);
    try {
      lastWriteStatus.set(t("transactionReconciling"));
      let event: unknown = null;
      try {
        event = await app.events.waitFor(record.txid, record.eventName, 5_000);
      } catch {
        event = null;
      }
      try {
        const snapshot = await readPermissionSnapshot(record.accountId);
        if (permissionTransactionSatisfied(record, snapshot, Boolean(event))) {
          finalizeObservedTransaction(record, snapshot);
          return snapshot;
        }
        applySnapshot(snapshot);
      } catch (error) {
        clearSnapshot();
        readError.set(t(errorKey(error)));
      }
      const transactionState = await transactionStateReader(record.network, record.txid);
      if (transactionState === "fault") {
        clearPendingTransaction();
        lastWriteStatus.set(t("transactionFaulted"));
        return null;
      }
      lastWriteStatus.set(t("transactionAwaitingConfirmation"));
      return null;
    } finally {
      isRecovering.set(false);
    }
  };

  const restoreTransaction = () => {
    const raw = safeStorageGet<unknown>(PENDING_TRANSACTION_KEY, null);
    const restored = restorePendingPermissionTransaction(raw, network, aaCore);
    if (raw && !restored) safeStorageDelete(PENDING_TRANSACTION_KEY);
    if (!restored) {
      clearPendingTransaction();
      return null;
    }
    pendingTransaction.set(restored);
    pendingTxid.set(restored.txid);
    form.accountIdHash = restored.accountId;
    lastWriteStatus.set(t("transactionRecoveryFound"));
    return restored;
  };

  const loadAll = async () => {
    try {
      assertRecoveryStorage();
    } catch {
      lastWriteStatus.set(t("recoveryStorageUnavailable"));
    }
    const restored = restoreTransaction();
    if (restored) {
      await reconcilePendingTransaction();
      return;
    }
    const accountId = normalizePermissionHash(form.accountIdHash, false);
    if (accountId) await refreshState(accountId);
  };

  const walletUnsubscribe = app.chain.address.subscribe(() => {
    const wallet = connectedWalletHash();
    if (!wallet) {
      walletNetwork.set("");
      walletNetworkMatches.set(false);
    }
  });

  const dispose = () => {
    disposed = true;
    refreshTicket += 1;
    walletUnsubscribe();
  };

  return {
    form,
    network,
    aaCore,
    currentVerifier,
    currentHook,
    currentBackupOwner,
    currentVerifierDisplay,
    currentHookDisplay,
    currentBackupOwnerDisplay,
    inspectedAccountId,
    permissionSnapshot,
    hasInspected,
    hasPendingVerifier,
    hasPendingHook,
    pendingVerifierUnlockAt,
    pendingHookUnlockAt,
    proposalVerifier,
    proposalHook,
    connectedWalletDisplay,
    walletNetwork,
    walletNetworkMatches,
    isRefreshing,
    isVerifierBusy,
    isHookBusy,
    isRecovering,
    isCheckingWallet,
    readError,
    lastWriteStatus,
    pendingTransaction,
    pendingTxid,
    storageHealthy,
    refreshState,
    invalidateBinding,
    submitVerifier,
    confirmVerifier,
    cancelVerifier,
    confirmHook,
    cancelHook,
    submitHook,
    reconcilePendingTransaction,
    checkWalletAuthority,
    loadAll,
    dispose,
  };
}

export type UseAAPermissionsLabReturn = ReturnType<typeof useAAPermissionsLab>;
