import { createObservable, type Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import {
  getAAAppWorkspaceUrl,
  getAAIdentityWorkspaceUrl,
  getExternalIntegrationConfig,
} from "@shared/constants/rpc";
import {
  FIRST_TIME_RECOVERY_SETUP_AVAILABLE,
  MIN_RECOVERY_DELAY_MS,
  accountsMatch,
  buildRecoveryWorkspaceUrl,
  isPendingRecoveryWrite,
  normalizeAccount,
  parseGuardianSetupPackage,
  parseRecoveryProfileId,
  readRecoveryProfile,
  requireRecoveryContext,
  verifyRecoveryWrite,
  waitForRecoveryTransactionOutcome,
  type GuardianSetupPackage,
  type PendingRecoveryWrite,
  type RecoveryContext,
  type RecoveryProfile,
} from "./recovery-guardian";

export type GuardianJourneyState =
  | "idle"
  | "loading"
  | "unconfigured"
  | "binding-required"
  | "legacy"
  | "legacy-policy"
  | "protected"
  | "collecting"
  | "waiting"
  | "ready"
  | "pending-transaction"
  | "failed";

export type RecoveryActionResult =
  | { status: "confirmed"; txid: string }
  | { status: "pending"; txid: string }
  | { status: "fault"; txid: string }
  | { status: "confirmation-required"; txid: "" };

interface Options {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const PENDING_RECOVERY_STORAGE_KEY = "state/pendingRecoveryWrite";
const RECOVERY_STORAGE_PROBE_KEY = "recovery-journal-probe";

function derived<T>(get: () => T, dependencies: Observable<unknown>[]): Observable<T> {
  return {
    get,
    set: () => {},
    subscribe: (listener) => {
      const unsubs = dependencies.map((dependency) => dependency.subscribe(listener));
      return () => unsubs.forEach((unsubscribe) => unsubscribe());
    },
  };
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function txidFrom(value: unknown): string {
  const txid = clean((value as { txid?: unknown } | null)?.txid);
  return /^0x[0-9a-fA-F]{64}$/.test(txid) ? txid : "";
}

function formatError(error: unknown, t: Options["t"], fallback = "recoveryActionFailed"): string {
  const message = error instanceof Error ? clean(error.message) : clean(error);
  const known = new Set([
    "invalidRecoveryProfileId",
    "recoveryChainContextMismatch",
    "recoveryReadMalformed",
    "recoveryReadFailed",
    "recoveryReadUnavailable",
    "recoveryReadInconsistent",
    "recoveryAABindingMismatch",
    "recoveryProfileChanged",
    "setupPackageInvalidJson",
    "setupPackageInvalid",
    "setupPackageContainsSecret",
    "setupProfileMustBeAccountId",
    "setupAccountIdTextInvalid",
    "setupAccountInvalid",
    "setupGuardiansInvalid",
    "setupThresholdInvalid",
    "setupDelayInvalid",
    "setupVerifierInvalid",
    "setupProfileMismatch",
    "setupAlreadyConfigured",
    "setupContractUpgradeRequired",
    "walletInvalid",
    "ownerWalletRequired",
    "newOwnerWalletRequired",
    "recoveryProfileRequired",
    "recoveryAAProfileRequired",
    "recoveryExpiryInvalid",
    "recoveryWorkspaceInvalid",
    "recoveryPendingRequired",
    "recoveryNotReady",
    "recoveryTransactionFaulted",
    "recoveryConfirmationMissing",
    "recoveryEventMismatch",
    "recoveryReadbackMismatch",
    "pendingRecoveryBlocksWrites",
    "pendingRecoveryRecordInvalid",
    "recoveryStorageUnavailable",
    "recoveryStorageUnavailableAfterBroadcast",
  ]);
  return message && known.has(message) ? t(message) : t(fallback);
}

function openExternal(url: string) {
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}

export function useRecoveryGuardian({ app, t }: Options) {
  const initialProfile = clean(app.platform.launch.params?.accountId);
  const profileInput = createObservable(initialProfile);
  const setupPackageText = createObservable("");
  const recoveryExpiryMinutes = createObservable("30");
  const profile = createObservable<RecoveryProfile | null>(null);
  const setupPreview = createObservable<GuardianSetupPackage | null>(null);
  const network = createObservable("");
  const verifierHash = createObservable("");
  const aaCoreHash = createObservable("");
  const morpheusOracleHash = createObservable("");
  const isLoading = createObservable(false);
  const isWalletConnecting = createObservable(false);
  const isSubmitting = createObservable(false);
  const isRecovering = createObservable(false);
  const activeAction = createObservable("");
  const lastError = createObservable("");
  const lastSuccess = createObservable("");
  const transactionNotice = createObservable("");
  const confirmationKind = createObservable("");
  const setupWriteAvailable = createObservable(FIRST_TIME_RECOVERY_SETUP_AVAILABLE);
  const storageHealthy = createObservable(true);
  let storedPending: unknown = null;
  try {
    storedPending = app.storage.local.get<unknown>(PENDING_RECOVERY_STORAGE_KEY, null);
  } catch {
    storageHealthy.set(false);
  }
  // Persistence is owned explicitly below instead of app.state.persisted so a
  // storage exception cannot interrupt observable notification after broadcast.
  const pendingWrite = createObservable<PendingRecoveryWrite | null>(
    storedPending as PendingRecoveryWrite | null,
  );
  let readEpoch = 0;

  const walletAddress: Observable<string> = {
    get: () => app.chain.address.get() || "",
    set: () => {},
    subscribe: (listener) => app.chain.address.subscribe(listener),
  };

  const journeyState = derived<GuardianJourneyState>(() => {
    if (isLoading.get()) return "loading";
    if (pendingWrite.get()) return "pending-transaction";
    const current = profile.get();
    if (!current) return lastError.get() && storageHealthy.get() ? "failed" : "idle";
    if (!current.profileId.isAAAccountId) return "legacy";
    if (!current.aaBindingVerified) return "binding-required";
    if (!current.configured) return "unconfigured";
    if (!current.pending.active) {
      return current.timelockMs < MIN_RECOVERY_DELAY_MS ? "legacy-policy" : "protected";
    }
    if (current.pending.approvedCount < current.threshold) return "collecting";
    return Date.now() >= current.pending.executableAt ? "ready" : "waiting";
  }, [isLoading, pendingWrite, profile, lastError, storageHealthy]);

  const approvedCount = derived(() => profile.get()?.pending.approvedCount ?? 0, [profile]);
  const threshold = derived(() => profile.get()?.threshold ?? 0, [profile]);
  const guardianCount = derived(() => profile.get()?.masterNullifiers.length ?? 0, [profile]);
  const recoveryTarget = derived(() => profile.get()?.pending.newOwner ?? "", [profile]);
  const executableAt = derived(() => profile.get()?.pending.executableAt ?? 0, [profile]);
  const isConfigured = derived(() => profile.get()?.configured === true, [profile]);
  const canUseIdentityWorkspace = derived(
    () => Boolean(
      profile.get()?.configured &&
      profile.get()?.profileId.isAAAccountId &&
      profile.get()?.aaBindingVerified,
    ),
    [profile],
  );

  const setFailure = (error: unknown, fallback?: string) => {
    lastSuccess.set("");
    if (!pendingWrite.get()) transactionNotice.set("");
    confirmationKind.set("");
    lastError.set(formatError(error, t, fallback));
  };
  const setSuccess = (key: string) => {
    lastError.set("");
    transactionNotice.set("");
    confirmationKind.set("");
    lastSuccess.set(t(key));
  };
  const setTransactionNotice = (key: string) => {
    lastError.set("");
    lastSuccess.set("");
    transactionNotice.set(t(key));
  };
  const setConfirmationPrompt = (kind: "setup" | "cancel" | "finalize", key: string) => {
    confirmationKind.set(kind);
    setTransactionNotice(key);
  };

  const assertRecoveryStorage = () => {
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      app.storage.local.set(RECOVERY_STORAGE_PROBE_KEY, marker);
      const restored = app.storage.local.get(RECOVERY_STORAGE_PROBE_KEY, "");
      app.storage.local.delete(RECOVERY_STORAGE_PROBE_KEY);
      const removed = app.storage.local.get(RECOVERY_STORAGE_PROBE_KEY, "");
      if (restored !== marker || removed !== "") throw new Error("recoveryStorageUnavailable");
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      throw new Error("recoveryStorageUnavailable");
    }
  };

  const pendingWritesMatch = (left: PendingRecoveryWrite, right: PendingRecoveryWrite) =>
    JSON.stringify(left) === JSON.stringify(right);

  const persistPendingWrite = (record: PendingRecoveryWrite) => {
    try {
      assertRecoveryStorage();
      pendingWrite.set(record);
      app.storage.local.set(PENDING_RECOVERY_STORAGE_KEY, record);
      const restored = app.storage.local.get<unknown>(PENDING_RECOVERY_STORAGE_KEY, null);
      if (!isPendingRecoveryWrite(restored) || !pendingWritesMatch(restored, record)) {
        throw new Error("recoveryStorageUnavailableAfterBroadcast");
      }
      storageHealthy.set(true);
    } catch {
      // createObservable updates its in-memory value before notifying the
      // persisted subscriber. Keep that exact broadcast visible even when the
      // backing store rejects or drops the write, so the current session can
      // still confirm it and can never sign a replacement transaction.
      if (pendingWrite.get() !== record) {
        try { pendingWrite.set(record); } catch { /* keep the in-memory value */ }
      }
      storageHealthy.set(false);
      throw new Error("recoveryStorageUnavailableAfterBroadcast");
    }
  };

  const clearPendingWrite = (): boolean => {
    const existing = pendingWrite.get();
    const missing = `missing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      assertRecoveryStorage();
      pendingWrite.set(null);
      app.storage.local.delete(PENDING_RECOVERY_STORAGE_KEY);
      if (app.storage.local.get<unknown>(PENDING_RECOVERY_STORAGE_KEY, missing) !== missing) {
        throw new Error("recoveryStorageUnavailable");
      }
      storageHealthy.set(true);
      return true;
    } catch {
      // If clearing cannot be proven, restore the in-memory guard. Rechecking
      // the same tx is safe; allowing a replacement signature is not.
      if (existing && pendingWrite.get() !== existing) {
        try { pendingWrite.set(existing); } catch { /* keep the in-memory value */ }
      }
      storageHealthy.set(false);
      return false;
    }
  };

  const hydratePendingContext = (pending: PendingRecoveryWrite) => {
    const integration = getExternalIntegrationConfig(pending.network);
    profileInput.set(pending.profileHex);
    network.set(pending.network);
    verifierHash.set(pending.verifierHash);
    aaCoreHash.set(pending.aaCoreHash || integration.contracts.aaCore);
    morpheusOracleHash.set(pending.morpheusOracleHash || integration.contracts.morpheusOracle);
  };

  const restoredPending = pendingWrite.get();
  try {
    assertRecoveryStorage();
  } catch {
    lastError.set(t("recoveryStorageUnavailable"));
  }
  if (restoredPending && !isPendingRecoveryWrite(restoredPending)) {
    if (clearPendingWrite()) lastError.set(t("pendingRecoveryRecordInvalid"));
    else lastError.set(t("recoveryStorageUnavailable"));
  } else if (restoredPending) {
    hydratePendingContext(restoredPending);
    transactionNotice.set(t("recoveryTransactionPending"));
  }

  const setContext = (context: RecoveryContext) => {
    network.set(context.network);
    verifierHash.set(context.verifierHash);
    aaCoreHash.set(context.aaCoreHash);
    morpheusOracleHash.set(context.morpheusOracleHash);
  };

  const resolveContext = async (expectedNetwork?: RecoveryProfile["sourceNetwork"]) => {
    const context = await requireRecoveryContext(app);
    if (expectedNetwork && context.network !== expectedNetwork) {
      throw new Error("recoveryChainContextMismatch");
    }
    return context;
  };

  const getContext = async (expectedNetwork?: RecoveryProfile["sourceNetwork"]) => {
    const context = await resolveContext(expectedNetwork);
    setContext(context);
    return context;
  };

  const assertCurrentProfile = (expected: RecoveryProfile) => {
    const currentId = parseRecoveryProfileId(profileInput.get());
    if (profile.get() !== expected || currentId?.hex !== expected.profileId.hex) {
      throw new Error("recoveryProfileChanged");
    }
  };

  async function loadProfile(options: { quiet?: boolean } = {}) {
    if (pendingWrite.get()) {
      setFailure(new Error("pendingRecoveryBlocksWrites"));
      return null;
    }
    const requestId = ++readEpoch;
    const parsed = parseRecoveryProfileId(profileInput.get());
    if (!parsed) {
      isLoading.set(false);
      activeAction.set("");
      profile.set(null);
      setupPreview.set(null);
      setFailure(new Error("invalidRecoveryProfileId"));
      return null;
    }
    isLoading.set(true);
    activeAction.set("load");
    lastError.set("");
    lastSuccess.set("");
    transactionNotice.set("");
    // Clear the previous snapshot before the read. A failed RPC must never
    // leave stale guardian state looking current.
    profile.set(null);
    setupPreview.set(null);
    confirmationKind.set("");
    try {
      const context = await resolveContext();
      const next = await readRecoveryProfile(context, parsed);
      if (
        requestId !== readEpoch ||
        parseRecoveryProfileId(profileInput.get())?.hex !== parsed.hex
      ) return null;
      setContext(context);
      profile.set(next);
      if (!options.quiet) setSuccess("recoveryProfileLoaded");
      return next;
    } catch (error) {
      if (requestId === readEpoch) setFailure(error, "recoveryProfileLoadFailed");
      return null;
    } finally {
      if (requestId === readEpoch) {
        isLoading.set(false);
        activeAction.set("");
      }
    }
  }

  async function connectWallet() {
    isWalletConnecting.set(true);
    activeAction.set("connect");
    lastError.set("");
    try {
      const address = await app.chain.ensureWallet();
      if (!normalizeAccount(address)) throw new Error("walletInvalid");
      setSuccess("walletConnected");
      return address;
    } catch (error) {
      setFailure(error, "walletConnectionFailed");
      return "";
    } finally {
      isWalletConnecting.set(false);
      activeAction.set("");
    }
  }

  function buildIdentityUrl(current: RecoveryProfile, newOwner: string): string {
    const minutes = Number(recoveryExpiryMinutes.get());
    return buildRecoveryWorkspaceUrl({
      baseUrl: getAAIdentityWorkspaceUrl(current.sourceNetwork),
      profile: current,
      verifierHash: verifierHash.get(),
      newOwner,
      expiryMinutes: minutes,
    });
  }

  async function continueRecovery() {
    const current = profile.get();
    if (!current?.configured) {
      setFailure(new Error("recoveryProfileRequired"));
      return "";
    }
    if (!current.profileId.isAAAccountId) {
      setFailure(new Error("recoveryAAProfileRequired"));
      return "";
    }
    isWalletConnecting.set(true);
    activeAction.set("continue");
    lastError.set("");
    try {
      const wallet = await app.chain.ensureWallet();
      assertCurrentProfile(current);
      const actorHash = normalizeAccount(wallet);
      if (!actorHash) throw new Error("walletInvalid");
      await getContext(current.sourceNetwork);
      const target = current.pending.active ? current.pending.newOwner : actorHash;
      if (current.pending.active && !accountsMatch(actorHash, target)) {
        throw new Error("newOwnerWalletRequired");
      }
      const url = buildIdentityUrl(current, target);
      openExternal(url);
      return url;
    } catch (error) {
      setFailure(error, "recoveryWorkspaceFailed");
      return "";
    } finally {
      isWalletConnecting.set(false);
      activeAction.set("");
    }
  }

  function openAAWorkspace() {
    const current = profile.get();
    const profileId = current?.profileId.isAAAccountId
      ? current.profileId.hex
      : parseRecoveryProfileId(profileInput.get())?.isAAAccountId
        ? parseRecoveryProfileId(profileInput.get())!.hex
        : "";
    const targetNetwork = current?.sourceNetwork ?? (network.get() === "testnet" ? "testnet" : "mainnet");
    const url = new URL(getAAAppWorkspaceUrl(targetNetwork));
    if (profileId) url.searchParams.set("accountId", profileId);
    openExternal(url.toString());
    return url.toString();
  }

  async function reviewSetupPackage() {
    if (!FIRST_TIME_RECOVERY_SETUP_AVAILABLE) {
      setFailure(new Error("setupContractUpgradeRequired"));
      return null;
    }
    if (pendingWrite.get()) {
      setFailure(new Error("pendingRecoveryBlocksWrites"));
      return null;
    }
    lastError.set("");
    lastSuccess.set("");
    transactionNotice.set("");
    confirmationKind.set("");
    const requestId = ++readEpoch;
    isLoading.set(true);
    activeAction.set("review-setup");
    profile.set(null);
    setupPreview.set(null);
    try {
      const parsedPackage = parseGuardianSetupPackage(setupPackageText.get());
      profileInput.set(parsedPackage.profileId.hex);
      const context = await resolveContext();
      const chainProfile = await readRecoveryProfile(context, parsedPackage.profileId);
      if (
        requestId !== readEpoch ||
        parseRecoveryProfileId(profileInput.get())?.hex !== parsedPackage.profileId.hex
      ) return null;
      setContext(context);
      profile.set(chainProfile);
      if (chainProfile.configured) throw new Error("setupAlreadyConfigured");
      if (!chainProfile.aaBindingVerified) throw new Error("recoveryAABindingMismatch");
      setupPreview.set(parsedPackage);
      setSuccess("setupPackageReviewed");
      return parsedPackage;
    } catch (error) {
      if (requestId === readEpoch) {
        setupPreview.set(null);
        setFailure(error, "setupPackageReviewFailed");
      }
      return null;
    } finally {
      if (requestId === readEpoch) {
        isLoading.set(false);
        activeAction.set("");
      }
    }
  }

  const persistWrite = (
    draft: Omit<PendingRecoveryWrite, "txid">,
    transactionId: string,
  ): PendingRecoveryWrite | null => {
    const candidate = { ...draft, txid: transactionId };
    if (!isPendingRecoveryWrite(candidate)) return null;
    try {
      persistPendingWrite(candidate);
      setTransactionNotice("recoveryTransactionPending");
    } catch (error) {
      setFailure(error);
      throw error;
    }
    return candidate;
  };

  async function finishPending(pending: PendingRecoveryWrite, wait = true): Promise<RecoveryActionResult> {
    isRecovering.set(true);
    activeAction.set("confirm-transaction");
    try {
      const outcome = await waitForRecoveryTransactionOutcome(pending, wait ? 12 : 1);
      if (outcome.state === "unknown") {
        setTransactionNotice("recoveryTransactionPending");
        return { status: "pending", txid: pending.txid };
      }
      if (outcome.state === "fault") {
        if (!clearPendingWrite()) {
          setFailure(new Error("recoveryStorageUnavailable"));
          return { status: "pending", txid: pending.txid };
        }
        setFailure(new Error("recoveryTransactionFaulted"));
        return { status: "fault", txid: pending.txid };
      }
      const confirmed = await verifyRecoveryWrite(pending, outcome);
      profile.set(confirmed);
      if (!clearPendingWrite()) {
        setFailure(new Error("recoveryStorageUnavailable"));
        return { status: "pending", txid: pending.txid };
      }
      confirmationKind.set("");
      setSuccess(
        pending.kind === "setup"
          ? "setupConfirmed"
          : pending.kind === "cancel"
            ? "cancelConfirmed"
            : "finalizeConfirmed",
      );
      return { status: "confirmed", txid: pending.txid };
    } catch (error) {
      // A HALT with a mismatched event/readback remains visible for manual
      // recovery. Never turn an ambiguous write into a success toast.
      setFailure(error, "recoveryConfirmationFailed");
      return { status: "pending", txid: pending.txid };
    } finally {
      isRecovering.set(false);
      activeAction.set("");
    }
  }

  async function submitSetup(): Promise<RecoveryActionResult | null> {
    if (!FIRST_TIME_RECOVERY_SETUP_AVAILABLE) {
      setFailure(new Error("setupContractUpgradeRequired"));
      return null;
    }
    if (pendingWrite.get()) {
      setFailure(new Error("pendingRecoveryBlocksWrites"));
      return null;
    }
    const setup = setupPreview.get();
    const current = profile.get();
    if (!setup || !current || current.configured || !current.aaBindingVerified || current.profileId.hex !== setup.profileId.hex) {
      setFailure(new Error("setupProfileMismatch"));
      return null;
    }
    if (confirmationKind.get() !== "setup") {
      setConfirmationPrompt("setup", "setupConfirmationPrompt");
      return { status: "confirmation-required", txid: "" };
    }
    isSubmitting.set(true);
    activeAction.set("setup");
    lastError.set("");
    try {
      assertRecoveryStorage();
      const wallet = await app.chain.ensureWallet();
      assertCurrentProfile(current);
      const actorHash = normalizeAccount(wallet);
      if (!actorHash) throw new Error("walletInvalid");
      const context = await getContext(current.sourceNetwork);
      const latest = await readRecoveryProfile(context, setup.profileId);
      assertCurrentProfile(current);
      if (latest.configured || !latest.aaBindingVerified) throw new Error("setupProfileMismatch");
      profile.set(latest);
      if (!accountsMatch(actorHash, latest.aaBackupOwner)) throw new Error("ownerWalletRequired");
      const draft: Omit<PendingRecoveryWrite, "txid"> = {
        version: 1,
        kind: "setup",
        createdAt: Date.now(),
        network: context.network,
        verifierHash: context.verifierHash,
        profileHex: setup.profileId.hex,
        actorHash,
        beforeOwner: actorHash,
        beforeNonce: "0",
        accountIdText: setup.accountIdText,
        accountAddress: setup.accountAddress,
        aaCoreHash: context.aaCoreHash,
        morpheusOracleHash: context.morpheusOracleHash,
        threshold: setup.threshold,
        timelockMs: setup.timelockMs,
        guardianCommitments: setup.guardianCommitments,
        morpheusVerifier: setup.morpheusVerifier,
      };
      let persisted: PendingRecoveryWrite | null = null;
      const result = await app.chain.invoke("setupRecovery", [
        app.chain.arg.byteArray(setup.profileId.hex),
        app.chain.arg.string(setup.accountIdText),
        app.chain.arg.string("neo_n3"),
        app.chain.arg.hash160(actorHash),
        app.chain.arg.hash160(context.aaCoreHash),
        app.chain.arg.hash160(setup.accountAddress),
        app.chain.arg.hash160(context.morpheusOracleHash),
        app.chain.arg.array(setup.guardianCommitments.map((value) => app.chain.arg.byteArray(value))),
        app.chain.arg.integer(setup.threshold),
        app.chain.arg.integer(setup.timelockMs),
        app.chain.arg.publicKey(setup.morpheusVerifier),
      ], {
        scriptHash: context.verifierHash,
        notify: "silent",
        onTransactionSent: (transactionId) => {
          persisted = persistWrite(draft, transactionId);
        },
      });
      const resultTxid = txidFrom(result);
      if (!persisted && resultTxid) persisted = persistWrite(draft, resultTxid);
      if (!persisted) throw new Error("recoveryConfirmationMissing");
      return await finishPending(persisted);
    } catch (error) {
      setFailure(error, "setupFailed");
      return null;
    } finally {
      isSubmitting.set(false);
      activeAction.set("");
    }
  }

  async function submitCancel(): Promise<RecoveryActionResult | null> {
    if (pendingWrite.get()) {
      setFailure(new Error("pendingRecoveryBlocksWrites"));
      return null;
    }
    const current = profile.get();
    if (!current?.configured || !current.pending.active) {
      setFailure(new Error("recoveryPendingRequired"));
      return null;
    }
    if (confirmationKind.get() !== "cancel") {
      setConfirmationPrompt("cancel", "cancelConfirmationPrompt");
      return { status: "confirmation-required", txid: "" };
    }
    isSubmitting.set(true);
    activeAction.set("cancel");
    lastError.set("");
    try {
      assertRecoveryStorage();
      const wallet = await app.chain.ensureWallet();
      assertCurrentProfile(current);
      const actorHash = normalizeAccount(wallet);
      if (!actorHash) throw new Error("walletInvalid");
      const context = await getContext(current.sourceNetwork);
      const latest = await readRecoveryProfile(context, current.profileId);
      assertCurrentProfile(current);
      profile.set(latest);
      if (!latest.configured || !latest.pending.active) throw new Error("recoveryPendingRequired");
      if (!accountsMatch(actorHash, latest.owner)) throw new Error("ownerWalletRequired");
      const draft: Omit<PendingRecoveryWrite, "txid"> = {
        version: 1,
        kind: "cancel",
        createdAt: Date.now(),
        network: context.network,
        verifierHash: context.verifierHash,
        profileHex: latest.profileId.hex,
        actorHash,
        beforeOwner: latest.owner,
        beforeNonce: latest.recoveryNonce,
      };
      let persisted: PendingRecoveryWrite | null = null;
      const result = await app.chain.invoke("cancelRecovery", [
        app.chain.arg.byteArray(latest.profileId.hex),
      ], {
        scriptHash: context.verifierHash,
        notify: "silent",
        onTransactionSent: (transactionId) => {
          persisted = persistWrite(draft, transactionId);
        },
      });
      const resultTxid = txidFrom(result);
      if (!persisted && resultTxid) persisted = persistWrite(draft, resultTxid);
      if (!persisted) throw new Error("recoveryConfirmationMissing");
      return await finishPending(persisted);
    } catch (error) {
      setFailure(error, "cancelFailed");
      return null;
    } finally {
      isSubmitting.set(false);
      activeAction.set("");
    }
  }

  async function submitFinalize(): Promise<RecoveryActionResult | null> {
    if (pendingWrite.get()) {
      setFailure(new Error("pendingRecoveryBlocksWrites"));
      return null;
    }
    const current = profile.get();
    if (!current?.configured || !current.pending.active) {
      setFailure(new Error("recoveryPendingRequired"));
      return null;
    }
    if (
      current.pending.approvedCount < current.threshold ||
      current.pending.executableAt <= 0 || Date.now() < current.pending.executableAt
    ) {
      setFailure(new Error("recoveryNotReady"));
      return null;
    }
    if (confirmationKind.get() !== "finalize") {
      setConfirmationPrompt("finalize", "finalizeConfirmationPrompt");
      return { status: "confirmation-required", txid: "" };
    }
    isSubmitting.set(true);
    activeAction.set("finalize");
    lastError.set("");
    try {
      assertRecoveryStorage();
      const wallet = await app.chain.ensureWallet();
      assertCurrentProfile(current);
      const actorHash = normalizeAccount(wallet);
      if (!actorHash) throw new Error("walletInvalid");
      const context = await getContext(current.sourceNetwork);
      const latest = await readRecoveryProfile(context, current.profileId);
      assertCurrentProfile(current);
      profile.set(latest);
      if (!latest.configured || !latest.pending.active) throw new Error("recoveryPendingRequired");
      if (
        latest.pending.approvedCount < latest.threshold ||
        latest.pending.executableAt <= 0 || Date.now() < latest.pending.executableAt
      ) throw new Error("recoveryNotReady");
      if (!accountsMatch(actorHash, latest.pending.newOwner)) throw new Error("newOwnerWalletRequired");
      const draft: Omit<PendingRecoveryWrite, "txid"> = {
        version: 1,
        kind: "finalize",
        createdAt: Date.now(),
        network: context.network,
        verifierHash: context.verifierHash,
        profileHex: latest.profileId.hex,
        actorHash,
        beforeOwner: latest.owner,
        beforeNonce: latest.recoveryNonce,
        expectedNewOwner: latest.pending.newOwner,
      };
      let persisted: PendingRecoveryWrite | null = null;
      const result = await app.chain.invoke("finalizeRecovery", [
        app.chain.arg.byteArray(latest.profileId.hex),
      ], {
        scriptHash: context.verifierHash,
        notify: "silent",
        onTransactionSent: (transactionId) => {
          persisted = persistWrite(draft, transactionId);
        },
      });
      const resultTxid = txidFrom(result);
      if (!persisted && resultTxid) persisted = persistWrite(draft, resultTxid);
      if (!persisted) throw new Error("recoveryConfirmationMissing");
      return await finishPending(persisted);
    } catch (error) {
      setFailure(error, "finalizeFailed");
      return null;
    } finally {
      isSubmitting.set(false);
      activeAction.set("");
    }
  }

  async function recoverPendingWrite() {
    const pending = pendingWrite.get();
    if (!pending) return null;
    if (isRecovering.get()) return { status: "pending" as const, txid: pending.txid };
    return finishPending(pending, false);
  }

  function refreshRecoveryStorage() {
    try {
      assertRecoveryStorage();
      const inMemory = pendingWrite.get();
      if (inMemory) {
        if (!isPendingRecoveryWrite(inMemory)) {
          if (!clearPendingWrite()) throw new Error("recoveryStorageUnavailable");
          setFailure(new Error("pendingRecoveryRecordInvalid"));
          return true;
        }
        // A broadcast can outlive a transient storage failure. Restore the
        // exact in-memory journal and verify its readback before confirmation
        // resumes, so a reload cannot lose the replay lock.
        persistPendingWrite(inMemory);
        hydratePendingContext(inMemory);
        setTransactionNotice("recoveryTransactionPending");
        return true;
      }

      // The initial storage read may itself have failed. Once storage returns,
      // reconcile any durable journal before enabling a new signature.
      const stored = app.storage.local.get<unknown>(PENDING_RECOVERY_STORAGE_KEY, null);
      if (stored !== null) {
        if (!isPendingRecoveryWrite(stored)) {
          pendingWrite.set(stored as PendingRecoveryWrite);
          if (!clearPendingWrite()) throw new Error("recoveryStorageUnavailable");
          setFailure(new Error("pendingRecoveryRecordInvalid"));
          return true;
        }
        pendingWrite.set(stored);
        hydratePendingContext(stored);
        setTransactionNotice("recoveryTransactionPending");
        return true;
      }

      setSuccess("recoveryStorageRestored");
      return true;
    } catch (error) {
      setFailure(error);
      return false;
    }
  }

  function setField(field: string, value: unknown) {
    if (pendingWrite.get()) {
      setFailure(new Error("pendingRecoveryBlocksWrites"));
      return;
    }
    const text = String(value ?? "");
    if (field === "profileInput") {
      readEpoch += 1;
      isLoading.set(false);
      activeAction.set("");
      profileInput.set(text);
      profile.set(null);
      setupPreview.set(null);
    } else if (field === "setupPackageText") {
      readEpoch += 1;
      isLoading.set(false);
      activeAction.set("");
      setupPackageText.set(text);
      setupPreview.set(null);
    } else if (field === "recoveryExpiryMinutes") {
      recoveryExpiryMinutes.set(text);
    }
    confirmationKind.set("");
    transactionNotice.set("");
    lastError.set("");
    lastSuccess.set("");
  }

  function clearConfirmation() {
    confirmationKind.set("");
    transactionNotice.set("");
  }

  return {
    profileInput,
    setupPackageText,
    recoveryExpiryMinutes,
    profile,
    setupPreview,
    network,
    verifierHash,
    aaCoreHash,
    morpheusOracleHash,
    walletAddress,
    isLoading,
    isWalletConnecting,
    isSubmitting,
    isRecovering,
    activeAction,
    lastError,
    lastSuccess,
    transactionNotice,
    confirmationKind,
    setupWriteAvailable,
    storageHealthy,
    pendingWrite,
    journeyState,
    approvedCount,
    threshold,
    guardianCount,
    recoveryTarget,
    executableAt,
    isConfigured,
    canUseIdentityWorkspace,
    loadProfile,
    connectWallet,
    continueRecovery,
    openAAWorkspace,
    reviewSetupPackage,
    submitSetup,
    submitCancel,
    submitFinalize,
    recoverPendingWrite,
    refreshRecoveryStorage,
    setField,
    clearConfirmation,
  };
}
