/**
 * Production session-key lifecycle for one Neo Abstract Account.
 *
 * Local draft state never claims chain authority. Account ownership, verifier
 * binding, session state, allowance, writes, and recovery all come from the
 * exact network/account/contract tuple inspected immediately before use.
 */
import { createObservable, type Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import {
  getNetwork,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import {
  generateAASessionKeyPair,
} from "@shared/utils/aa-account";
import {
  DEFAULT_SESSION_ALLOWED_METHOD,
  DEFAULT_SESSION_DAPP_ID,
  DEFAULT_SESSION_SPONSOR_AMOUNT,
  getDefaultSessionExpiryTimestamp,
} from "../launch";
import {
  CANONICAL_SESSION_KEY_CONTRACTS,
  explicitNeoNetwork,
  matchesConfiguredSession,
  normalizeSessionAccount,
  readSessionAccount,
  readSessionRecord,
  readSessionTransactionState,
  requireSessionWriteContext,
  resolveSessionReadContext,
  sessionAccountsMatch,
  type SessionAccountSnapshot,
  type SessionAccountReadStatus,
  type SessionKeyContext,
  type SessionRecordRead,
  type SessionRecordStatus,
  type SessionTransactionState,
} from "../session-key-chain";
import type { DecodedSessionKey } from "../utils/sessionKeyDecode";

export interface OnChainSessionView {
  decoded: DecodedSessionKey;
  spentGas: string;
}

type SessionWriteKind = "configure" | "revoke";
export type SessionWritePhase =
  | "idle"
  | "preparing"
  | "confirming"
  | "confirmed"
  | "recoverable"
  | "context-mismatch"
  | "failed";

export interface PendingSessionWrite {
  version: 1;
  kind: SessionWriteKind;
  network: NeoNetwork;
  aaCore: string;
  verifier: string;
  accountIdHash: string;
  owner: string;
  txid: string;
  createdAt: number;
  publicKey?: string;
  targetContract?: string;
  allowedMethod?: string;
  expiresAt?: number;
  spendingLimitRaw?: string;
}

type SessionConfiguration = {
  txid: string;
  accountIdHash: string;
  publicKey: string;
  targetContract: string;
  allowedMethod: string;
  expiresAt: number;
};

export interface UseAASessionKeyLabOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  transactionStateReader?: (network: NeoNetwork, txid: string) => Promise<SessionTransactionState>;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

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

function validTxid(value: unknown): string {
  const txid = clean(value).toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(txid) ? txid : "";
}

export function isPendingSessionWrite(value: unknown): value is PendingSessionWrite {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingSessionWrite>;
  if (
    pending.version !== 1 ||
    (pending.kind !== "configure" && pending.kind !== "revoke") ||
    !explicitNeoNetwork(pending.network) ||
    !normalizeSessionAccount(pending.aaCore, true) ||
    !normalizeSessionAccount(pending.verifier, true) ||
    !normalizeSessionAccount(pending.accountIdHash, true) ||
    !normalizeSessionAccount(pending.owner, true) ||
    (pending.txid !== "" && !validTxid(pending.txid)) ||
    !Number.isFinite(pending.createdAt) || Number(pending.createdAt) <= 0
  ) return false;
  if (pending.kind === "revoke") return true;
  return /^(02|03)[0-9a-f]{64}$/i.test(clean(pending.publicKey)) &&
    Boolean(normalizeSessionAccount(pending.targetContract, true)) &&
    Boolean(clean(pending.allowedMethod)) &&
    Number.isSafeInteger(pending.expiresAt) && Number(pending.expiresAt) > 0 &&
    /^\d+$/.test(clean(pending.spendingLimitRaw));
}

function errorKey(error: unknown, fallback: string): string {
  const key = error instanceof Error ? clean(error.message) : clean(error);
  return key || fallback;
}

export function useAASessionKeyLab({
  app,
  t,
  transactionStateReader = readSessionTransactionState,
}: UseAASessionKeyLabOptions) {
  /**
   * Display copy for a caught error. Internal throws carry bare i18n keys and
   * localize via t(); anything outside the catalog (t() echoes unknown keys
   * verbatim, which used to leak raw English chain errors into lastError)
   * routes through app.errors.messageOf so wallet/VM/RPC failures show the
   * same localized family copy notify.error uses.
   */
  const failureMessage = (error: unknown, fallbackKey: string): string => {
    const key = errorKey(error, fallbackKey);
    const localized = t(key);
    return localized !== key ? localized : app.errors.messageOf(error, t(fallbackKey));
  };
  const initialNetwork = explicitNeoNetwork(app.platform.launch.network) || resolveNeoNetwork(getNetwork());
  const initialContracts = CANONICAL_SESSION_KEY_CONTRACTS[initialNetwork];

  const form = {
    accountSeed: "",
    sessionPublicKey: "",
    targetContract: "",
    allowedMethod: DEFAULT_SESSION_ALLOWED_METHOD,
    expiresAt: getDefaultSessionExpiryTimestamp(),
    spendingLimit: "0.1",
    description: "",
    dappId: DEFAULT_SESSION_DAPP_ID,
    sponsorAmount: DEFAULT_SESSION_SPONSOR_AMOUNT,
  };

  const sponsorState = createObservable<Record<string, unknown> | null>(null);
  const generatedPrivateKey = createObservable("");
  const generatedPublicKey = createObservable("");
  const lastConfigured = createObservable<SessionConfiguration | null>(null);
  const lastTransactionId = createObservable("");
  const isSubmitting = createObservable(false);
  const isRevoking = createObservable(false);
  const isInspecting = createObservable(false);
  const isRecovering = createObservable(false);
  const isCheckingSponsorship = createObservable(false);
  const accountReadStatus = createObservable<SessionAccountReadStatus>("idle");
  const sessionReadStatus = createObservable<SessionRecordStatus>("idle");
  const inspectedAccountIdHash = createObservable("");
  const accountOwner = createObservable("");
  const accountVerifier = createObservable("");
  const verifierBound = createObservable(false);
  const walletNetwork = createObservable("");
  const activeNetwork = createObservable<NeoNetwork>(initialNetwork);
  const allowanceSupported = createObservable(initialContracts.allowanceSupported);
  const lastError = createObservable("");
  const writePhase = createObservable<SessionWritePhase>("idle");
  const onChainSession = createObservable<string | null>(null);
  const hasOnChainSession = createObservable(false);
  const onChainSessionView = createObservable<OnChainSessionView | null>(null);
  const pendingWrite = app.state.persisted<PendingSessionWrite | null>("pendingSessionWrite", null);

  const restoredPending = pendingWrite.get();
  if (restoredPending && !isPendingSessionWrite(restoredPending)) {
    pendingWrite.set(null);
  } else if (restoredPending) {
    writePhase.set(restoredPending.txid ? "recoverable" : "preparing");
    activeNetwork.set(restoredPending.network);
  }

  let inspectEpoch = 0;

  function normalizeHashOrAddress(value: string): string {
    const trimmed = clean(value);
    if (!trimmed) throw new Error("invalidTargetContract");
    const normalized = trimmed.startsWith("N")
      ? addressToScriptHash(trimmed)
      : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error("invalidTargetContract");
    return normalized.toLowerCase();
  }

  function normalizeSessionPublicKey(value: string): string {
    const normalized = clean(value).replace(/^0x/i, "").toLowerCase();
    if (!/^(02|03)[0-9a-f]{64}$/.test(normalized)) {
      throw new Error("invalidSessionPublicKey");
    }
    return normalized;
  }

  function normalizeExpiry(value: string): number {
    const parsed = Number.parseInt(clean(value), 10);
    if (!Number.isSafeInteger(parsed) || parsed <= Math.floor(Date.now() / 1000)) {
      throw new Error("invalidExpiry");
    }
    return parsed;
  }

  function normalizeAllowedMethod(value: string): string {
    const method = clean(value);
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(method)) {
      throw new Error("invalidAllowedMethod");
    }
    return method;
  }

  function normalizeSpendingLimit(value: string): string {
    const trimmed = clean(value);
    if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("invalidSpendingLimit");
    const [whole, fraction = ""] = trimmed.split(".");
    if (fraction.length > 8) throw new Error("invalidSpendingLimit");
    const base = `${whole}${(fraction + "00000000").slice(0, 8)}`.replace(/^0+(?=\d)/, "");
    return base || "0";
  }

  function accountIdHash(): string {
    const normalized = normalizeSessionAccount(form.accountSeed);
    if (!normalized) throw new Error("invalidSessionAccountId");
    return normalized;
  }

  const derivedAccountIdHash = derived(() => {
    try {
      return form.accountSeed.trim() ? accountIdHash() : "";
    } catch {
      return "";
    }
  }, []);

  const normalizedAllowedMethod = derived(
    () => clean(form.allowedMethod) || t("notAvailable"),
    [],
  );
  const normalizedTargetContract = derived(() => {
    try {
      return form.targetContract.trim() ? normalizeHashOrAddress(form.targetContract) : "";
    } catch {
      return "";
    }
  }, []);

  const walletDisplay = derived(
    () => app.chain.address.get() || t("notConnected"),
    [app.chain.address],
  );
  const ownerAuthorityStatus = derived(() => {
    if (accountReadStatus.get() !== "ready" || !accountOwner.get()) return "unverified";
    const wallet = app.chain.address.get();
    if (!wallet) return "disconnected";
    return sessionAccountsMatch(wallet, accountOwner.get()) ? "owner" : "mismatch";
  }, [accountReadStatus, accountOwner, app.chain.address]);
  const sessionStatusDisplay = derived(() => {
    const status = sessionReadStatus.get();
    if (status === "active") return t("sessionActive");
    if (status === "expired") return t("sessionExpired");
    if (status === "absent") return t("sessionAbsent");
    if (status === "unavailable") return t("sessionUnavailable");
    return t("sessionNotInspected");
  }, [sessionReadStatus]);
  const accountStatusDisplay = derived(() => t(`sessionAccount${accountReadStatus.get()[0]?.toUpperCase()}${accountReadStatus.get().slice(1)}`), [accountReadStatus]);
  const sessionVerifierDisplay = derived(
    () => CANONICAL_SESSION_KEY_CONTRACTS[activeNetwork.get()].verifier,
    [activeNetwork],
  );
  const aaCoreDisplay = derived(
    () => CANONICAL_SESSION_KEY_CONTRACTS[activeNetwork.get()].aaCore,
    [activeNetwork],
  );
  const networkDisplay = derived(() => t(activeNetwork.get() === "mainnet" ? "mainnet" : "testnet"), [activeNetwork]);
  const sponsorStatusDisplay = derived(
    () => sponsorStatusText(sponsorState.get()),
    [sponsorState],
  );
  const canConfigure = derived(() =>
    accountReadStatus.get() === "ready" && verifierBound.get() &&
    ownerAuthorityStatus.get() === "owner" && sessionReadStatus.get() === "absent" &&
    !pendingWrite.get(),
  [accountReadStatus, verifierBound, ownerAuthorityStatus, sessionReadStatus, pendingWrite]);
  const canRevoke = derived(() =>
    accountReadStatus.get() === "ready" && verifierBound.get() &&
    ownerAuthorityStatus.get() === "owner" &&
    (sessionReadStatus.get() === "active" || sessionReadStatus.get() === "expired") &&
    !pendingWrite.get(),
  [accountReadStatus, verifierBound, ownerAuthorityStatus, sessionReadStatus, pendingWrite]);

  function sponsorStatusText(state: Record<string, unknown> | null): string {
    if (!state) return t("sponsorNotChecked");
    if (typeof state.approved === "boolean") return state.approved ? t("sponsorApproved") : t("sponsorNotApproved");
    if (typeof state.eligible === "boolean") return state.eligible ? t("sponsorEligible") : t("sponsorNotEligible");
    return t("checked");
  }

  function sponsorDetails(state: Record<string, unknown> | null) {
    if (!state) return [{ label: t("sponsorship"), value: t("sponsorNotChecked") }];
    const items = [{ label: t("sponsorship"), value: sponsorStatusText(state) }];
    const amount = clean(state.amount ?? state.sponsorAmount ?? state.sponsoredAmount ?? state.gas ?? state.budget);
    const requestId = clean(state.requestId ?? state.id ?? state.sponsorRequestId ?? state.txid);
    if (amount) items.push({ label: t("sponsorAmount"), value: amount });
    if (requestId) items.push({ label: t("sponsorRequestId"), value: requestId });
    return items;
  }

  const detailItems = derived(() => [
    { label: t("network"), value: networkDisplay.get() },
    { label: t("accountIdHash"), value: inspectedAccountIdHash.get() || derivedAccountIdHash.get() || t("notAvailable") },
    { label: t("accountOwner"), value: accountOwner.get() || t("notAvailable") },
    { label: t("sessionVerifier"), value: accountVerifier.get() || sessionVerifierDisplay.get() },
    { label: t("sessionPublicKey"), value: onChainSessionView.get()?.decoded.pubKey || generatedPublicKey.get() || t("notAvailable") },
    { label: t("targetContract"), value: onChainSessionView.get()?.decoded.targetContract || normalizedTargetContract.get() || t("notAvailable") },
    { label: t("allowedMethod"), value: onChainSessionView.get()?.decoded.method || normalizedAllowedMethod.get() },
    { label: t("lastTx"), value: lastTransactionId.get() || pendingWrite.get()?.txid || t("notAvailable") },
    ...sponsorDetails(sponsorState.get()),
  ], [activeNetwork, inspectedAccountIdHash, accountOwner, accountVerifier, onChainSessionView, generatedPublicKey, lastTransactionId, pendingWrite, sponsorState]);

  function applySessionRecord(record: SessionRecordRead) {
    sessionReadStatus.set(record.status);
    const present = Boolean(record.decoded) && (record.status === "active" || record.status === "expired");
    hasOnChainSession.set(present);
    onChainSession.set(record.decoded ? JSON.stringify(record.decoded) : null);
    onChainSessionView.set(record.decoded ? { decoded: record.decoded, spentGas: record.spentGas } : null);
  }

  function applySnapshot(snapshot: SessionAccountSnapshot) {
    accountReadStatus.set(snapshot.status);
    inspectedAccountIdHash.set(snapshot.accountIdHash);
    accountOwner.set(snapshot.owner);
    accountVerifier.set(snapshot.verifier);
    verifierBound.set(snapshot.verifierBound && snapshot.canonicalCoreBound);
    applySessionRecord(snapshot.session);
  }

  function clearLiveSnapshot(status: SessionAccountReadStatus = "idle") {
    accountReadStatus.set(status);
    accountOwner.set("");
    accountVerifier.set("");
    verifierBound.set(false);
    sessionReadStatus.set(status === "unavailable" ? "unavailable" : "idle");
    hasOnChainSession.set(false);
    onChainSession.set(null);
    onChainSessionView.set(null);
  }

  function generateSessionKey() {
    const pair = generateAASessionKeyPair();
    form.sessionPublicKey = pair.publicKey;
    generatedPublicKey.set(pair.publicKey);
    generatedPrivateKey.set(pair.privateKey);
    lastError.set("");
  }

  async function checkSponsor() {
    isCheckingSponsorship.set(true);
    try {
      const result = await app.aa.sponsorship.check({ dappId: form.dappId });
      sponsorState.set(result as unknown as Record<string, unknown>);
    } finally {
      isCheckingSponsorship.set(false);
    }
  }

  async function requestSponsor() {
    isCheckingSponsorship.set(true);
    try {
      const amount = clean(form.sponsorAmount);
      if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw new Error("invalidSponsorAmount");
      const result = await app.aa.sponsorship.request(amount, { dappId: form.dappId });
      sponsorState.set(result as unknown as Record<string, unknown>);
      if (!result.approved) throw new Error("sponsorRequestUnavailable");
    } finally {
      isCheckingSponsorship.set(false);
    }
  }

  async function inspectSessionKey() {
    const requestId = ++inspectEpoch;
    isInspecting.set(true);
    clearLiveSnapshot("loading");
    lastError.set("");
    try {
      const requestedHash = accountIdHash();
      inspectedAccountIdHash.set(requestedHash);
      const { context, detectedNetwork } = await resolveSessionReadContext(app);
      if (requestId !== inspectEpoch || accountIdHash() !== requestedHash) return null;
      activeNetwork.set(context.network);
      walletNetwork.set(detectedNetwork);
      allowanceSupported.set(context.allowanceSupported);
      const snapshot = await readSessionAccount(app, context, requestedHash);
      if (requestId !== inspectEpoch || accountIdHash() !== requestedHash) return null;
      applySnapshot(snapshot);
      if (snapshot.status === "unavailable") lastError.set(t("sessionAccountReadUnavailable"));
      return snapshot;
    } catch (error) {
      if (requestId === inspectEpoch) {
        clearLiveSnapshot("unavailable");
        lastError.set(failureMessage(error, "sessionAccountReadUnavailable"));
      }
      return null;
    } finally {
      if (requestId === inspectEpoch) isInspecting.set(false);
    }
  }

  async function connectOwnerWallet() {
    await app.chain.ensureWallet();
    return inspectSessionKey();
  }

  function buildSessionKeyArgs(context: SessionKeyContext, params: {
    accountIdHash: string;
    publicKey: string;
    targetContract: string;
    allowedMethod: string;
    expiresAt: number;
    spendingLimitRaw: string;
    description: string;
  }) {
    const args = [
      app.chain.arg.hash160(params.accountIdHash),
      app.chain.arg.byteArray(params.publicKey),
      app.chain.arg.hash160(params.targetContract),
      app.chain.arg.string(params.allowedMethod),
      // Neo Runtime.Time and the deployed verifier store milliseconds.
      app.chain.arg.integer(BigInt(params.expiresAt) * 1000n),
    ];
    if (context.allowanceSupported) {
      args.push(app.chain.arg.integer(params.spendingLimitRaw));
      args.push(app.chain.arg.string(params.description));
    }
    if (args.length !== context.setSessionKeyArity) throw new Error("sessionCanonicalContextMismatch");
    return args;
  }

  async function requireFreshOwnerContext(options: { requireExistingSession: boolean }) {
    if (pendingWrite.get()) throw new Error("sessionPendingBlocksWrites");
    const wallet = await app.chain.ensureWallet();
    const context = await requireSessionWriteContext(app);
    activeNetwork.set(context.network);
    walletNetwork.set(context.network);
    allowanceSupported.set(context.allowanceSupported);
    const hash = accountIdHash();
    const snapshot = await readSessionAccount(app, context, hash);
    applySnapshot(snapshot);
    if (snapshot.status !== "ready") throw new Error(snapshot.status === "missing" ? "sessionAccountMissing" : "sessionAccountReadUnavailable");
    if (!snapshot.verifierBound) throw new Error("sessionVerifierBindingMismatch");
    if (!sessionAccountsMatch(wallet, snapshot.owner)) throw new Error("sessionOwnerWalletRequired");
    const hasRecord = snapshot.session.status === "active" || snapshot.session.status === "expired";
    if (options.requireExistingSession && !hasRecord) throw new Error("sessionRevokeRequiresLiveRecord");
    if (!options.requireExistingSession && hasRecord) throw new Error("sessionExistingMustRevoke");
    return { context, hash, snapshot };
  }

  function persistDraft(value: PendingSessionWrite) {
    pendingWrite.set(value);
    writePhase.set(value.txid ? "confirming" : "preparing");
  }

  function persistTxid(draft: PendingSessionWrite, txidValue: unknown) {
    const txid = validTxid(txidValue);
    if (!txid) return null;
    const next = { ...draft, txid };
    persistDraft(next);
    lastTransactionId.set(txid);
    return next;
  }

  function clearPendingAsConfirmed(txid: string) {
    pendingWrite.set(null);
    lastTransactionId.set(txid);
    writePhase.set("confirmed");
    lastError.set("");
  }

  async function confirmConfigure(pending: PendingSessionWrite) {
    const context: SessionKeyContext = {
      network: pending.network,
      aaCore: pending.aaCore,
      verifier: pending.verifier,
      allowanceSupported: CANONICAL_SESSION_KEY_CONTRACTS[pending.network].allowanceSupported,
      setSessionKeyArity: CANONICAL_SESSION_KEY_CONTRACTS[pending.network].setSessionKeyArity,
    };
    return app.chain.waitForState(
      () => readSessionRecord(app, context, pending.accountIdHash),
      (record) => matchesConfiguredSession(record, {
        publicKey: pending.publicKey!,
        targetContract: pending.targetContract!,
        allowedMethod: pending.allowedMethod!,
        expiresAt: pending.expiresAt!,
        spendingLimitRaw: pending.spendingLimitRaw!,
      }, context.allowanceSupported),
    );
  }

  async function confirmRevoke(pending: PendingSessionWrite) {
    const contracts = CANONICAL_SESSION_KEY_CONTRACTS[pending.network];
    const context: SessionKeyContext = {
      network: pending.network,
      aaCore: pending.aaCore,
      verifier: pending.verifier,
      allowanceSupported: contracts.allowanceSupported,
      setSessionKeyArity: contracts.setSessionKeyArity,
    };
    return app.chain.waitForState(
      () => readSessionRecord(app, context, pending.accountIdHash),
      (record) => record.status === "absent",
    );
  }

  async function configureSessionKey() {
    isSubmitting.set(true);
    writePhase.set("preparing");
    lastError.set("");
    try {
      const { context, hash, snapshot } = await requireFreshOwnerContext({ requireExistingSession: false });
      const publicKey = normalizeSessionPublicKey(form.sessionPublicKey);
      const targetContract = normalizeHashOrAddress(form.targetContract);
      const allowedMethod = normalizeAllowedMethod(form.allowedMethod);
      const expiresAt = normalizeExpiry(form.expiresAt);
      const spendingLimitRaw = context.allowanceSupported ? normalizeSpendingLimit(form.spendingLimit) : "0";
      const draft: PendingSessionWrite = {
        version: 1,
        kind: "configure",
        network: context.network,
        aaCore: context.aaCore,
        verifier: context.verifier,
        accountIdHash: hash,
        owner: snapshot.owner,
        txid: "",
        createdAt: Date.now(),
        publicKey,
        targetContract,
        allowedMethod,
        expiresAt,
        spendingLimitRaw,
      };
      persistDraft(draft);
      let submitted = draft;
      const result = await app.chain.invoke(
        "callVerifier",
        [
          app.chain.arg.hash160(hash),
          app.chain.arg.string("setSessionKey"),
          app.chain.arg.array(buildSessionKeyArgs(context, {
            accountIdHash: hash,
            publicKey,
            targetContract,
            allowedMethod,
            expiresAt,
            spendingLimitRaw,
            description: clean(form.description),
          })),
        ],
        {
          scriptHash: context.aaCore,
          onTransactionSent: (txid) => {
            submitted = persistTxid(draft, txid) ?? submitted;
          },
        },
      );
      submitted = persistTxid(draft, result.txid) ?? submitted;
      if (!submitted.txid) throw new Error("sessionTransactionIdMissing");
      const confirmed = await confirmConfigure(submitted);
      if (!confirmed) {
        writePhase.set("recoverable");
        throw new Error("sessionConfirmationPending");
      }
      applySessionRecord(confirmed);
      lastConfigured.set({ txid: submitted.txid, accountIdHash: hash, publicKey, targetContract, allowedMethod, expiresAt });
      clearPendingAsConfirmed(submitted.txid);
      return { status: "confirmed" as const, txid: submitted.txid };
    } catch (error) {
      const key = errorKey(error, "sessionConfigureFailed");
      const pending = pendingWrite.get();
      if (!pending?.txid) {
        pendingWrite.set(null);
        writePhase.set("failed");
      } else {
        writePhase.set("recoverable");
      }
      if (key === "sessionWalletNetworkMismatch" || key === "sessionWalletNetworkUnverified" || key === "sessionCanonicalContextMismatch") {
        walletNetwork.set("");
        clearLiveSnapshot("unavailable");
      }
      lastError.set(failureMessage(error, "sessionConfigureFailed"));
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  }

  async function revokeSessionKey() {
    isRevoking.set(true);
    writePhase.set("preparing");
    lastError.set("");
    try {
      const { context, hash, snapshot } = await requireFreshOwnerContext({ requireExistingSession: true });
      const draft: PendingSessionWrite = {
        version: 1,
        kind: "revoke",
        network: context.network,
        aaCore: context.aaCore,
        verifier: context.verifier,
        accountIdHash: hash,
        owner: snapshot.owner,
        txid: "",
        createdAt: Date.now(),
      };
      persistDraft(draft);
      let submitted = draft;
      const result = await app.chain.invoke(
        "callVerifier",
        [
          app.chain.arg.hash160(hash),
          app.chain.arg.string("clearSessionKey"),
          app.chain.arg.array([app.chain.arg.hash160(hash)]),
        ],
        {
          scriptHash: context.aaCore,
          onTransactionSent: (txid) => {
            submitted = persistTxid(draft, txid) ?? submitted;
          },
        },
      );
      submitted = persistTxid(draft, result.txid) ?? submitted;
      if (!submitted.txid) throw new Error("sessionTransactionIdMissing");
      const confirmed = await confirmRevoke(submitted);
      if (!confirmed) {
        writePhase.set("recoverable");
        throw new Error("sessionConfirmationPending");
      }
      applySessionRecord(confirmed);
      lastConfigured.set(null);
      clearPendingAsConfirmed(submitted.txid);
      return { status: "confirmed" as const, txid: submitted.txid };
    } catch (error) {
      const key = errorKey(error, "sessionRevokeFailed");
      const pending = pendingWrite.get();
      if (!pending?.txid) {
        pendingWrite.set(null);
        writePhase.set("failed");
      } else {
        writePhase.set("recoverable");
      }
      if (key === "sessionWalletNetworkMismatch" || key === "sessionWalletNetworkUnverified" || key === "sessionCanonicalContextMismatch") {
        walletNetwork.set("");
        clearLiveSnapshot("unavailable");
      }
      lastError.set(failureMessage(error, "sessionRevokeFailed"));
      throw error;
    } finally {
      isRevoking.set(false);
    }
  }

  async function recoverPendingWrite() {
    const pending = pendingWrite.get();
    if (!pending) return { status: "none" as const, txid: "" };
    if (!pending.txid) {
      pendingWrite.set(null);
      writePhase.set("failed");
      lastError.set(t("sessionUnsignedDraftCleared"));
      return { status: "cleared" as const, txid: "" };
    }
    if (isRecovering.get()) return { status: "pending" as const, txid: pending.txid };
    isRecovering.set(true);
    try {
      const { context } = await resolveSessionReadContext(app);
      if (
        context.network !== pending.network ||
        !sessionAccountsMatch(context.aaCore, pending.aaCore) ||
        !sessionAccountsMatch(context.verifier, pending.verifier)
      ) {
        writePhase.set("context-mismatch");
        lastError.set(t("sessionPendingContextMismatch"));
        return { status: "context-mismatch" as const, txid: pending.txid };
      }
      const record = await readSessionRecord(app, context, pending.accountIdHash);
      const confirmed = pending.kind === "revoke"
        ? record.status === "absent"
        : matchesConfiguredSession(record, {
            publicKey: pending.publicKey!,
            targetContract: pending.targetContract!,
            allowedMethod: pending.allowedMethod!,
            expiresAt: pending.expiresAt!,
            spendingLimitRaw: pending.spendingLimitRaw!,
          }, context.allowanceSupported);
      if (!confirmed) {
        const transactionState = await transactionStateReader(pending.network, pending.txid);
        if (transactionState === "fault") {
          pendingWrite.set(null);
          writePhase.set("failed");
          lastError.set(t("sessionTransactionFaulted"));
          return { status: "fault" as const, txid: pending.txid };
        }
        writePhase.set("recoverable");
        lastError.set(t(record.status === "unavailable" ? "sessionAccountReadUnavailable" : "sessionConfirmationPending"));
        return { status: "pending" as const, txid: pending.txid };
      }
      applySessionRecord(record);
      clearPendingAsConfirmed(pending.txid);
      return { status: "confirmed" as const, txid: pending.txid };
    } catch (error) {
      const key = errorKey(error, "sessionRecoveryFailed");
      writePhase.set(
        key === "sessionWalletNetworkMismatch" || key === "sessionCanonicalContextMismatch"
          ? "context-mismatch"
          : "recoverable",
      );
      walletNetwork.set("");
      lastError.set(failureMessage(error, "sessionRecoveryFailed"));
      return {
        status: writePhase.get() === "context-mismatch" ? "context-mismatch" as const : "pending" as const,
        txid: pending.txid,
      };
    } finally {
      isRecovering.set(false);
    }
  }

  async function loadAll() {
    if (pendingWrite.get()) await recoverPendingWrite();
    if (form.accountSeed.trim()) await inspectSessionKey();
  }

  return {
    form,
    generatedPrivateKey,
    generatedPublicKey,
    lastConfigured,
    lastTransactionId,
    isSubmitting,
    isRevoking,
    isInspecting,
    isRecovering,
    isCheckingSponsorship,
    onChainSession,
    hasOnChainSession,
    onChainSessionView,
    accountReadStatus,
    sessionReadStatus,
    inspectedAccountIdHash,
    accountOwner,
    accountVerifier,
    verifierBound,
    walletNetwork,
    activeNetwork,
    allowanceSupported,
    ownerAuthorityStatus,
    lastError,
    writePhase,
    pendingWrite,
    canConfigure,
    canRevoke,
    sponsorState,
    derivedAccountIdHash,
    normalizedAllowedMethod,
    normalizedTargetContract,
    sessionStatusDisplay,
    accountStatusDisplay,
    sessionVerifierDisplay,
    aaCoreDisplay,
    networkDisplay,
    walletDisplay,
    sponsorStatusDisplay,
    detailItems,
    generateSessionKey,
    checkSponsor,
    requestSponsor,
    inspectSessionKey,
    connectOwnerWallet,
    configureSessionKey,
    revokeSessionKey,
    recoverPendingWrite,
    loadAll,
  };
}

export type UseAASessionKeyLabReturn = ReturnType<typeof useAASessionKeyLab>;
