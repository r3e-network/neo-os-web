import { createObservable, type Observable } from "@shared/react/context";
import type {
  FrameworkRemoteStorageSurface,
  MiniAppFramework,
} from "@shared/react";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
  parseInvokeResult,
} from "@shared/utils/neo";
import {
  deriveRegistrationAccountIdHash,
  AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS,
} from "@shared/utils/aa-account";
import {
  getExternalIntegrationConfig,
  getNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import {
  AA_ACCOUNT_CONFIRMATION_ATTEMPTS,
  AA_ACCOUNT_CONFIRMATION_DELAY_MS,
  AA_ACCOUNT_PENDING_KEY,
  isPendingAARegistration,
  normalizeAAHash,
  readAARegistrationOutcome,
  registrationEventMatches,
  type AARegistrationOutcome,
  type PendingAARegistration,
} from "../registration-recovery";

const ZERO_HASH = "0x0000000000000000000000000000000000000000";

export interface AAAccountSnapshot {
  accountId: string;
  verifier: string;
  hook: string;
  backupOwner: string;
  escapeTimelock: number;
  escapeActive: boolean;
}

export type AARegistrationResult =
  | { status: "confirmed"; txid: string; accountId: string }
  | { status: "pending"; txid: string; accountId: string }
  | { status: "fault"; txid: string; accountId: string };

export interface UseAAAccountLabOptions {
  app: MiniAppFramework;
  storageService: FrameworkRemoteStorageSurface;
  t: (key: string, params?: Record<string, string | number>) => string;
  outcomeReader?: (pending: PendingAARegistration) => Promise<AARegistrationOutcome>;
  sleep?: (milliseconds: number) => Promise<void>;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function explicitNetwork(value: unknown): NeoNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function useAAAccountLab({
  app,
  storageService,
  t,
  outcomeReader = readAARegistrationOutcome,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: UseAAAccountLabOptions) {
  const initialNetwork = getNetwork();
  const initialIntegration = getExternalIntegrationConfig(initialNetwork);

  const inspectForm = { accountIdInput: "" };
  const registerForm = {
    accountIdInput: "",
    verifierHash: initialIntegration.contracts.aaWeb3AuthVerifier,
    verifierParamsHex: "",
    hookHash: "",
    backupOwner: "",
    escapeTimelock: "2592000",
  };

  const currentVerifier = createObservable(t("notAvailable"));
  const currentHook = createObservable(t("notAvailable"));
  const currentBackupOwner = createObservable(t("notAvailable"));
  const currentEscapeTimelock = createObservable(t("notAvailable"));
  const currentEscapeActive = createObservable(t("notAvailable"));
  const inspectedAccountId = createObservable("");
  const hasInspected = createObservable(false);
  const isInspecting = createObservable(false);
  const isSubmitting = createObservable(false);
  const isRecovering = createObservable(false);
  const activeNetwork = createObservable<NeoNetwork>(initialNetwork);
  const aaCoreHash = createObservable(initialIntegration.contracts.aaCore);
  const defaultVerifierHash = createObservable(initialIntegration.contracts.aaWeb3AuthVerifier);
  const pendingRegistration = createObservable<PendingAARegistration | null>(null);
  const pendingStorageHealthy = createObservable(true);
  const lastStatus = createObservable(t("statusReady"));
  const lastError = createObservable("");
  const lastSuccess = createObservable("");

  let inspectEpoch = 0;
  let pendingLoaded = false;

  const aaCoreDisplay: Observable<string> = {
    get: () => aaCoreHash.get(),
    set: () => {},
    subscribe: (listener) => aaCoreHash.subscribe(listener),
  };
  const defaultVerifierDisplay: Observable<string> = {
    get: () => defaultVerifierHash.get(),
    set: () => {},
    subscribe: (listener) => defaultVerifierHash.subscribe(listener),
  };
  const networkDisplay: Observable<string> = {
    get: () => activeNetwork.get(),
    set: () => {},
    subscribe: (listener) => activeNetwork.subscribe(listener),
  };
  const connectedWalletDisplay: Observable<string> = {
    get: () => connectedWalletHash(),
    set: () => {},
    subscribe: (listener) => app.chain.address.subscribe(listener),
  };

  function connectedWalletHash(): string {
    const address = app.chain.address.get();
    if (!address) return "";
    return normalizeAAHash(address);
  }

  function normalizeAccountIdHash(input: string): string {
    const normalized = normalizeScriptHash(clean(input)).replace(/^0x/, "");
    if (!/^[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidAccountId"));
    return normalized.toLowerCase();
  }

  function normalizeHashOrZero(value: string): string {
    const trimmed = clean(value);
    if (!trimmed) return ZERO_HASH;
    const normalized = trimmed.startsWith("N")
      ? addressToScriptHash(trimmed)
      : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidHash"));
    return normalized.toLowerCase();
  }

  function normalizeBackupOwner(value: string): string {
    const normalized = normalizeAAHash(value);
    if (!normalized) throw new Error(t("invalidBackupOwner"));
    return normalized;
  }

  function parseEscapeTimelock(value: string): number {
    const trimmed = clean(value);
    if (!/^[0-9]+$/.test(trimmed)) throw new Error(t("invalidTimelock"));
    const seconds = Number.parseInt(trimmed, 10);
    if (
      !Number.isInteger(seconds) ||
      seconds < AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS ||
      seconds > AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS
    ) throw new Error(t("invalidTimelock"));
    return seconds;
  }

  function sanitizeVerifierParams(value: string): string {
    const normalized = clean(value).replace(/^0x/i, "");
    if (normalized && (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized))) {
      throw new Error(t("invalidVerifierParams"));
    }
    return normalized;
  }

  function strictHashRead(value: unknown, label: string): string {
    const chainHash = parseHash160(value);
    if (/^0x[0-9a-f]{40}$/i.test(chainHash)) return chainHash.toLowerCase();
    const parsed = clean(parseInvokeResult(value));
    if (/^0x[0-9a-f]{40}$/i.test(parsed)) return normalizeScriptHash(parsed).toLowerCase();
    throw new Error(t("accountReadUnavailable", { field: label }));
  }

  function strictIntegerRead(value: unknown, label: string): number {
    const parsed = parseInvokeResult(value);
    const numeric = typeof parsed === "number" ? parsed : Number(clean(parsed));
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
      throw new Error(t("accountReadUnavailable", { field: label }));
    }
    return numeric;
  }

  function strictBooleanRead(value: unknown, label: string): boolean {
    const parsed = parseInvokeResult(value);
    if (typeof parsed === "boolean") return parsed;
    if (parsed === 0 || parsed === "0") return false;
    if (parsed === 1 || parsed === "1") return true;
    throw new Error(t("accountReadUnavailable", { field: label }));
  }

  function displayHash(value: string): string {
    return value && value !== ZERO_HASH ? value : t("notAvailable");
  }

  function humanizeEscapeTimelock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return t("notAvailable");
    const days = seconds / 86_400;
    return t("timelockDays", { days: Number.isInteger(days) ? String(days) : days.toFixed(1) });
  }

  async function resolveContext(requireWallet: boolean) {
    if (requireWallet) await app.chain.ensureWallet();
    const launch = explicitNetwork(app.platform.launch.network);
    let detected: NeoNetwork | "" = "";
    try {
      detected = explicitNetwork(await app.chain.detectNetwork());
    } catch {
      // Launch-bound reads remain possible while wallet network detection is unavailable.
    }
    if (launch && detected && launch !== detected) throw new Error(t("networkMismatch"));
    const network = detected || launch || getNetwork();
    const integration = getExternalIntegrationConfig(network);
    const coreHash = normalizeAAHash(integration.contracts.aaCore);
    const verifier = normalizeAAHash(integration.contracts.aaWeb3AuthVerifier);
    const configured = normalizeAAHash(app.chain.contractAddress.get());
    if (!coreHash || !verifier || (configured && configured !== coreHash)) {
      throw new Error(t("networkMismatch"));
    }
    activeNetwork.set(network);
    aaCoreHash.set(coreHash);
    defaultVerifierHash.set(verifier);
    if (!clean(registerForm.verifierHash)) registerForm.verifierHash = verifier;
    return { network, coreHash, defaultVerifier: verifier };
  }

  async function readAccountSnapshot(
    accountId: string,
    context: { network: NeoNetwork; coreHash: string },
  ): Promise<AAAccountSnapshot> {
    const accountIdArg = app.chain.arg.hash160(accountId);
    const options = { scriptHash: context.coreHash };
    const [verifier, hook, backupOwner, timelock, escapeActive] = await Promise.all([
      app.chain.readRaw("getVerifier", [accountIdArg], options),
      app.chain.readRaw("getHook", [accountIdArg], options),
      app.chain.readRaw("getBackupOwner", [accountIdArg], options),
      app.chain.readRaw("getEscapeTimelock", [accountIdArg], options),
      app.chain.readRaw("isEscapeActive", [accountIdArg], options),
    ]);
    return {
      accountId: normalizeAAHash(accountId),
      verifier: strictHashRead(verifier, "verifier"),
      hook: strictHashRead(hook, "hook"),
      backupOwner: strictHashRead(backupOwner, "backup owner"),
      escapeTimelock: strictIntegerRead(timelock, "escape timelock"),
      escapeActive: strictBooleanRead(escapeActive, "escape status"),
    };
  }

  function applySnapshot(snapshot: AAAccountSnapshot) {
    currentVerifier.set(displayHash(snapshot.verifier));
    currentHook.set(displayHash(snapshot.hook));
    currentBackupOwner.set(displayHash(snapshot.backupOwner));
    currentEscapeTimelock.set(humanizeEscapeTimelock(snapshot.escapeTimelock));
    currentEscapeActive.set(snapshot.escapeActive ? t("escapeActive") : t("escapeInactive"));
    inspectedAccountId.set(snapshot.accountId);
    hasInspected.set(true);
  }

  const inspectAccount = async () => {
    const epoch = ++inspectEpoch;
    isInspecting.set(true);
    lastError.set("");
    try {
      const context = await resolveContext(false);
      const accountId = `0x${normalizeAccountIdHash(inspectForm.accountIdInput)}`;
      const snapshot = await readAccountSnapshot(accountId, context);
      if (epoch !== inspectEpoch) return;
      applySnapshot(snapshot);
      lastStatus.set(t("inspectSuccess"));
      await storageService.set(`account:${accountId.slice(2)}`, {
        ...snapshot,
        network: context.network,
        inspectedAt: Date.now(),
      }).catch(() => undefined);
    } catch (error) {
      if (epoch === inspectEpoch) {
        hasInspected.set(false);
        inspectedAccountId.set("");
        lastError.set(app.errors.messageOf(error, t("accountReadFailed")));
      }
      throw error;
    } finally {
      if (epoch === inspectEpoch) isInspecting.set(false);
    }
  };

  async function persistPending(value: PendingAARegistration): Promise<boolean> {
    pendingRegistration.set(value);
    try {
      await storageService.set(AA_ACCOUNT_PENDING_KEY, value);
      if (typeof storageService.get === "function") {
        const stored = await storageService.get(AA_ACCOUNT_PENDING_KEY);
        const healthy = isPendingAARegistration(stored) && stored.txid.toLowerCase() === value.txid.toLowerCase();
        pendingStorageHealthy.set(healthy);
        return healthy;
      }
      pendingStorageHealthy.set(true);
      return true;
    } catch {
      pendingStorageHealthy.set(false);
      return false;
    }
  }

  async function clearPending(): Promise<void> {
    pendingRegistration.set(null);
    try {
      if (typeof storageService.delete === "function") await storageService.delete(AA_ACCOUNT_PENDING_KEY);
      pendingStorageHealthy.set(true);
    } catch {
      pendingStorageHealthy.set(false);
    }
  }

  function snapshotMatches(pending: PendingAARegistration, snapshot: AAAccountSnapshot): boolean {
    return snapshot.accountId === normalizeAAHash(pending.accountId) &&
      snapshot.verifier === normalizeAAHash(pending.verifier) &&
      snapshot.hook === clean(pending.hook).toLowerCase() &&
      snapshot.backupOwner === normalizeAAHash(pending.backupOwner) &&
      snapshot.escapeTimelock === pending.escapeTimelock &&
      snapshot.escapeActive === false;
  }

  async function settlePending(
    pending: PendingAARegistration,
    suppliedOutcome?: AARegistrationOutcome,
  ): Promise<AARegistrationResult> {
    const context = await resolveContext(true);
    const actor = connectedWalletHash();
    if (
      context.network !== pending.network ||
      context.coreHash !== normalizeAAHash(pending.coreHash) ||
      actor !== normalizeAAHash(pending.backupOwner)
    ) {
      lastError.set(t("pendingContextMismatch"));
      lastStatus.set(t("registrationPending"));
      return { status: "pending", txid: pending.txid, accountId: pending.accountId };
    }

    for (let attempt = 0; attempt < AA_ACCOUNT_CONFIRMATION_ATTEMPTS; attempt += 1) {
      const outcome = suppliedOutcome ?? await outcomeReader(pending);
      if (outcome.state === "fault") {
        await clearPending();
        lastError.set(t("registrationFaulted"));
        lastStatus.set(t("registrationFaulted"));
        return { status: "fault", txid: pending.txid, accountId: pending.accountId };
      }
      if (outcome.state === "halt") {
        if (!registrationEventMatches(pending, outcome)) {
          lastError.set(t("registrationEvidenceMismatch"));
          lastStatus.set(t("registrationPending"));
          return { status: "pending", txid: pending.txid, accountId: pending.accountId };
        }
        try {
          const snapshot = await readAccountSnapshot(pending.accountId, context);
          if (snapshotMatches(pending, snapshot)) {
            applySnapshot(snapshot);
            inspectForm.accountIdInput = pending.accountId;
            await clearPending();
            lastError.set("");
            lastSuccess.set(t("registrationConfirmed"));
            lastStatus.set(t("registrationConfirmed"));
            return { status: "confirmed", txid: pending.txid, accountId: pending.accountId };
          }
        } catch {
          // The application log is final but the read node can lag. Retry readback.
        }
      }
      if (suppliedOutcome || attempt === AA_ACCOUNT_CONFIRMATION_ATTEMPTS - 1) break;
      await sleep(AA_ACCOUNT_CONFIRMATION_DELAY_MS);
    }
    lastError.set("");
    lastSuccess.set("");
    lastStatus.set(t("registrationPending"));
    return { status: "pending", txid: pending.txid, accountId: pending.accountId };
  }

  const submitRegister = async (): Promise<AARegistrationResult> => {
    if (pendingRegistration.get()) throw new Error(t("pendingBlocksRegistration"));
    isSubmitting.set(true);
    lastError.set("");
    lastSuccess.set("");
    try {
      const context = await resolveContext(true);
      const verifier = normalizeHashOrZero(registerForm.verifierHash);
      const hook = normalizeHashOrZero(registerForm.hookHash);
      const backupOwner = normalizeBackupOwner(registerForm.backupOwner || connectedWalletHash());
      const escapeTimelock = parseEscapeTimelock(registerForm.escapeTimelock);
      const verifierParams = sanitizeVerifierParams(registerForm.verifierParamsHex);
      if (
        verifier === context.defaultVerifier &&
        !/^04[0-9a-f]{128}$/i.test(verifierParams)
      ) throw new Error(t("invalidWeb3AuthPublicKey"));
      const walletHash = connectedWalletHash();
      if (!walletHash || backupOwner !== walletHash) throw new Error(t("backupOwnerMustSign"));
      if (verifier === ZERO_HASH) throw new Error(t("invalidHash"));

      const accountId = `0x${deriveRegistrationAccountIdHash({
        verifierContractHash: verifier,
        verifierParamsHex: verifierParams,
        hookContractHash: hook,
        backupOwnerAddress: backupOwner,
        escapeTimelock,
      })}`.toLowerCase();

      const preflight = await readAccountSnapshot(accountId, context);
      if (
        preflight.verifier !== ZERO_HASH ||
        preflight.hook !== ZERO_HASH ||
        preflight.backupOwner !== ZERO_HASH ||
        preflight.escapeTimelock !== 0
      ) throw new Error(t("accountAlreadyRegistered"));

      const draft = {
        version: 1 as const,
        network: context.network,
        coreHash: context.coreHash,
        accountId,
        verifier,
        hook,
        backupOwner,
        escapeTimelock,
        createdAt: Date.now(),
      };
      let tracked: PendingAARegistration | null = null;
      let persistPromise: Promise<boolean> | null = null;
      const track = (txid: string) => {
        const candidate = { ...draft, txid: clean(txid) };
        if (!isPendingAARegistration(candidate)) return;
        tracked = candidate;
        persistPromise = persistPending(candidate);
        lastStatus.set(t("registrationPending"));
      };

      try {
        const result = await app.chain.invoke(
          "registerAccount",
          [
            app.chain.arg.hash160(accountId),
            app.chain.arg.hash160(verifier),
            app.chain.arg.byteArray(verifierParams),
            app.chain.arg.hash160(hook),
            app.chain.arg.hash160(backupOwner),
            app.chain.arg.integer(escapeTimelock),
          ],
          { scriptHash: context.coreHash, onTransactionSent: track },
        );
        if (!tracked) track(clean((result as { txid?: unknown } | null)?.txid));
      } catch (error) {
        if (persistPromise) await persistPromise;
        const saved = pendingRegistration.get();
        if (saved) return { status: "pending", txid: saved.txid, accountId };
        throw error;
      }
      const saved = pendingRegistration.get();
      if (!saved) throw new Error(t("registrationNotTracked"));
      if (persistPromise) await persistPromise;
      return await settlePending(saved);
    } catch (error) {
      if (!pendingRegistration.get()) {
        lastError.set(app.errors.messageOf(error, t("registrationFailed")));
      }
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  };

  const recoverPendingRegistration = async (outcome?: AARegistrationOutcome) => {
    const pending = pendingRegistration.get();
    if (!pending || isRecovering.get()) return null;
    isRecovering.set(true);
    try {
      return await settlePending(pending, outcome);
    } finally {
      isRecovering.set(false);
    }
  };

  const loadAll = async () => {
    await resolveContext(false);
    if (pendingLoaded) return;
    pendingLoaded = true;
    try {
      const value = await storageService.get(AA_ACCOUNT_PENDING_KEY);
      if (isPendingAARegistration(value)) {
        pendingRegistration.set(value);
        lastStatus.set(t("registrationPending"));
      } else if (value && typeof storageService.delete === "function") {
        await storageService.delete(AA_ACCOUNT_PENDING_KEY);
      }
    } catch {
      pendingStorageHealthy.set(false);
    }
  };

  return {
    inspectForm,
    registerForm,
    currentVerifier,
    currentHook,
    currentBackupOwner,
    currentEscapeTimelock,
    currentEscapeActive,
    inspectedAccountId,
    hasInspected,
    isInspecting,
    isSubmitting,
    isRecovering,
    aaCoreDisplay,
    defaultVerifierDisplay,
    networkDisplay,
    connectedWalletDisplay,
    pendingRegistration,
    pendingStorageHealthy,
    lastStatus,
    lastError,
    lastSuccess,
    inspectAccount,
    submitRegister,
    recoverPendingRegistration,
    readAccountSnapshot,
    loadAll,
  };
}

export type UseAAAccountLabReturn = ReturnType<typeof useAAAccountLab>;
