/**
 * useNeoNS -- React hook for Neo Name Service domain logic.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { getMiniAppContractHash, resolveNeoNetwork, type NeoNetwork } from "@shared/constants";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  fetchOwnedDomains,
  formatGasBaseUnits,
  normalizeNnsExpiryMs,
  readNnsNameSnapshot,
  readNnsSearchSnapshot,
  readNnsTransactionOutcome,
  type NnsNameSnapshot,
  type NnsTransactionOutcome,
} from "./nnsRpc";

const APP_ID = "miniapp-neo-ns";
const NNS_CONTRACT_HASH = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const NNS_RECORD_TYPE_ADDRESS = 16;
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 500;
const TRANSACTION_POLL_ATTEMPTS = 20;
const TRANSACTION_POLL_DELAY_MS = 1_500;
const TRANSACTION_CONFIRMATION_WINDOW_MS = 45_000;
const PENDING_STORAGE_KEY = "pending-nns-operation-v1";
const RECOVERY_STORAGE_PROBE_KEY = "pending-nns-operation-probe-v1";
/** Neo N3 address: base58check, leading 'N', 34 chars total. */
const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

/** Strict Neo N3 address check (trims whitespace, rejects empty/malformed). */
function isValidNeoAddress(value: unknown): boolean {
  const address = String(value ?? "").trim();
  return NEO_ADDRESS_PATTERN.test(address) && Boolean(addressToScriptHash(address));
}

export interface Domain {
  name: string;
  owner: string;
  expiry: number;
  target?: string;
}

export interface SearchResult {
  /** The exact full ".neo" name that was searched (snapshotted so registration cannot drift from the live query). */
  name: string;
  available: boolean;
  restricted?: boolean;
  price?: string;
  priceBase?: string;
  owner?: string;
  expiry?: number;
}

export interface RenewQuote {
  name: string;
  price: string;
  priceBase: string;
  expiry: number;
}

export type NnsDomainsStatus = "idle" | "loading" | "chain" | "failed";
export type NnsRecoveryStorageStatus = "unverified" | "ready" | "unavailable";
export type NnsPendingKind = "register" | "renew" | "set-record" | "transfer";

export interface PendingNnsOperation {
  version: 1;
  kind: NnsPendingKind;
  network: NeoNetwork;
  contractHash: string;
  actor: string;
  txid: string;
  createdAt: number;
  name: string;
  beforeExpiry?: number;
  target?: string;
  receiver?: string;
  priceBase?: string;
}

interface NnsChainContext {
  network: NeoNetwork;
  contractHash: string;
}

export interface UseNeoNSOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  nnsContractHash?: string;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHash(value: unknown): string {
  const raw = clean(value).toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(raw) && !/^0x0{40}$/.test(raw) ? raw : "";
}

function explicitNetwork(value: unknown): NeoNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

/** Contract-exact first-label validation (lowercase alnum, interior hyphens, max 63). */
export function normalizeNnsName(value: unknown): string | null {
  let raw = clean(value).toLowerCase();
  if (raw.endsWith(".neo")) raw = raw.slice(0, -4);
  if (!raw || raw.length > 63 || raw.includes(".")) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(raw)) return null;
  return `${raw}.neo`;
}

function isValidTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(clean(value));
}

export function isPendingNnsOperation(value: unknown): value is PendingNnsOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingNnsOperation>;
  if (
    pending.version !== 1 ||
    !(["register", "renew", "set-record", "transfer"] as NnsPendingKind[]).includes(pending.kind as NnsPendingKind) ||
    (pending.network !== "mainnet" && pending.network !== "testnet") ||
    !normalizeHash(pending.contractHash) ||
    !isValidNeoAddress(pending.actor) ||
    !isValidTxid(pending.txid) ||
    !Number.isSafeInteger(pending.createdAt) || Number(pending.createdAt) <= 0 ||
    normalizeNnsName(pending.name) !== pending.name
  ) return false;
  if (pending.kind === "renew") {
    return Number.isSafeInteger(pending.beforeExpiry) && Number(pending.beforeExpiry) > 0 && /^\d+$/.test(clean(pending.priceBase));
  }
  if (pending.kind === "set-record") return isValidNeoAddress(pending.target);
  if (pending.kind === "transfer") return isValidNeoAddress(pending.receiver);
  return /^\d+$/.test(clean(pending.priceBase));
}

function sameAddress(a: unknown, b: unknown): boolean {
  return clean(a) === clean(b) && isValidNeoAddress(a);
}

export function pendingMatchesOutcome(
  pending: PendingNnsOperation,
  outcome: NnsTransactionOutcome,
  snapshot: NnsNameSnapshot,
): boolean {
  if (outcome.state !== "halt" || snapshot.name !== pending.name) return false;
  if (pending.kind === "register") {
    return Boolean(
      // Fresh registration emits from=null; re-registering an expired token
      // emits the previous owner. The exact register txid + name/to/amount +
      // owner readback bind both legitimate paths without inventing success.
      outcome.transfer && !outcome.renew && outcome.transfer.amount === "1" &&
      outcome.transfer.name === pending.name && sameAddress(outcome.transfer.to, pending.actor) &&
      sameAddress(snapshot.owner, pending.actor),
    );
  }
  if (pending.kind === "transfer") {
    return Boolean(
      outcome.transfer && !outcome.renew && outcome.transfer.amount === "1" && outcome.transfer.name === pending.name &&
      sameAddress(outcome.transfer.from, pending.actor) && sameAddress(outcome.transfer.to, pending.receiver) &&
      sameAddress(snapshot.owner, pending.receiver),
    );
  }
  if (pending.kind === "renew") {
    return Boolean(
      outcome.renew && !outcome.transfer && outcome.renew.name === pending.name &&
      outcome.renew.oldExpiration === pending.beforeExpiry &&
      outcome.renew.newExpiration > outcome.renew.oldExpiration &&
      outcome.renew.newExpiration === snapshot.expiration &&
      sameAddress(snapshot.owner, pending.actor),
    );
  }
  return !outcome.transfer && !outcome.renew && sameAddress(snapshot.owner, pending.actor) && snapshot.target === pending.target;
}

function domainToTokenId(name: string): string {
  const fullName = name.toLowerCase().endsWith(".neo") ? name.toLowerCase() : name.toLowerCase() + ".neo";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullName);
  return btoa(String.fromCharCode(...bytes));
}

export function useNeoNS({ app, t, nnsContractHash }: UseNeoNSOptions) {
  const overrideContract = normalizeHash(nnsContractHash);
  const myDomains = createObservable<Domain[]>([]);
  const domainsStatus = createObservable<NnsDomainsStatus>("idle");
  const isLoading = createObservable(false);
  const error = createObservable("");
  const searchQuery = createObservable("");
  const searchResult = createObservable<SearchResult | null>(null);
  const isSearching = createObservable(false);
  const registrationCost = createObservable("");
  const managingDomain = createObservable<Domain | null>(null);
  const renewQuote = createObservable<RenewQuote | null>(null);
  const pendingOperation = createObservable<PendingNnsOperation | null>(null);
  const isRecovering = createObservable(false);
  const transactionNotice = createObservable("");
  const activeNetwork = createObservable("");
  const activeContract = createObservable("");
  const recoveryStorageStatus = createObservable<NnsRecoveryStorageStatus>("unverified");

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let searchDebounceResolve: (() => void) | null = null;
  let searchGeneration = 0;
  let domainLoadGeneration = 0;
  let renewQuoteGeneration = 0;
  let busyCount = 0;
  let writeInFlight = false;
  let disposed = false;

  let restored: unknown = null;
  try {
    restored = app.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
  } catch {
    recoveryStorageStatus.set("unavailable");
  }
  if (isPendingNnsOperation(restored)) pendingOperation.set(restored);
  else if (restored != null) {
    try { app.storage.local.delete(PENDING_STORAGE_KEY); } catch { /* repaired on the next writable launch */ }
  }

  const domainCount: Observable<number> = {
    get: () => myDomains.get().length,
    set: () => {},
    subscribe: (fn) => myDomains.subscribe(fn),
  };

  const walletStatus: Observable<string> = {
    get: () => app.chain.address.get() ? t("connected") : t("disconnected"),
    set: () => {},
    subscribe: (fn) => app.chain.address.subscribe(fn),
  };

  const expiringSoon: Observable<number> = {
    get: () => myDomains.get().filter((domain) => {
      const remaining = domain.expiry - Date.now();
      return remaining > 0 && remaining < EXPIRY_WARNING_MS;
    }).length,
    set: () => {},
    subscribe: (fn) => myDomains.subscribe(fn),
  };

  /**
   * Thrown when no Neo network can be resolved yet simply because nothing has
   * bound one: the host supplied no launch network and there is no wallet
   * provider to detect one from. That is the ordinary state of a cold visit —
   * no read has failed because none was ever possible. Callers on read paths
   * must degrade to their idle state instead of reporting a failure; write
   * paths (which the visitor initiated) still raise a normal error.
   */
  class NnsNetworkUnbound extends Error {}

  const requireContext = async (requireDetectedNetwork = false): Promise<NnsChainContext> => {
    const launchNetwork = explicitNetwork(app.platform.launch.network);
    let detectedNetwork: NeoNetwork | "" = "";
    try {
      detectedNetwork = explicitNetwork(await app.chain.detectNetwork());
    } catch {
      if (requireDetectedNetwork) throw new Error(t("networkUnverified"));
      // Read-only lookups may use the verified launch network while a wallet
      // provider is absent or its network read is transiently unavailable.
    }
    if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) {
      throw new Error(t("networkMismatch"));
    }
    const network = requireDetectedNetwork ? detectedNetwork : detectedNetwork || launchNetwork;
    if (!network) {
      // Read path: nothing bound a network, so this is the pre-connect idle
      // state, not a verification failure. Write path: the visitor asked for
      // something, so a plain error is correct.
      throw requireDetectedNetwork
        ? new Error(t("networkUnverified"))
        : new NnsNetworkUnbound(t("networkUnverified"));
    }
    const registryContract = normalizeHash(getMiniAppContractHash(APP_ID, resolveNeoNetwork(network)));
    const expected = overrideContract || registryContract;
    if (!expected || (!overrideContract && expected !== NNS_CONTRACT_HASH)) {
      throw new Error(t("contractUnavailable"));
    }
    const configured = normalizeHash(app.chain.contractAddress.get());
    if (configured && configured !== expected) throw new Error(t("contractMismatch"));
    activeNetwork.set(network);
    activeContract.set(expected);
    return { network, contractHash: expected };
  };

  const requireActorContext = async (): Promise<NnsChainContext & { actor: string }> => {
    await app.chain.ensureWallet();
    const actor = clean(app.chain.address.get());
    if (!isValidNeoAddress(actor)) throw new Error(t("walletAddressInvalid"));
    // Every write and pending-receipt recovery requires a positive wallet
    // network detection. A launch-URL fallback is intentionally read-only.
    const context = await requireContext(true);
    return { ...context, actor };
  };

  const beginBusy = () => {
    busyCount += 1;
    isLoading.set(true);
  };

  const endBusy = () => {
    busyCount = Math.max(0, busyCount - 1);
    isLoading.set(busyCount > 0);
  };

  const beginWrite = () => {
    if (writeInFlight) throw new Error(t("operationInProgress"));
    writeInFlight = true;
    transactionNotice.set("");
    beginBusy();
  };

  const endWrite = () => {
    writeInFlight = false;
    endBusy();
  };

  const updateDomainFromSnapshot = (snapshot: NnsNameSnapshot) => {
    const previous = myDomains.get().find((item) => item.name === snapshot.name);
    const target = snapshot.target ?? previous?.target;
    const domain: Domain = {
      name: snapshot.name,
      owner: snapshot.owner,
      expiry: snapshot.expiration,
      ...(target ? { target } : {}),
    };
    const next = myDomains.get().filter((item) => item.name !== snapshot.name);
    myDomains.set([domain, ...next].sort((a, b) => b.expiry - a.expiry));
    if (managingDomain.get()?.name === snapshot.name) managingDomain.set(domain);
  };

  const clearPending = (): boolean => {
    pendingOperation.set(null);
    try {
      app.storage.local.delete(PENDING_STORAGE_KEY);
      const stored = app.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
      if (stored != null) throw new Error("pending receipt remained after delete");
      recoveryStorageStatus.set("ready");
      return true;
    } catch {
      recoveryStorageStatus.set("unavailable");
      return false;
    }
  };

  const ensureRecoveryStorage = () => {
    const marker = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    try {
      app.storage.local.set(RECOVERY_STORAGE_PROBE_KEY, marker);
      const stored = app.storage.local.get<string>(RECOVERY_STORAGE_PROBE_KEY, null);
      app.storage.local.delete(RECOVERY_STORAGE_PROBE_KEY);
      const removed = app.storage.local.get<unknown>(RECOVERY_STORAGE_PROBE_KEY, null);
      if (stored !== marker || removed != null) throw new Error("recovery storage probe failed");
      recoveryStorageStatus.set("ready");
    } catch {
      recoveryStorageStatus.set("unavailable");
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  type PendingDraft = Omit<PendingNnsOperation, "version" | "txid" | "createdAt">;
  const persistPending = (draft: PendingDraft, txid: string): PendingNnsOperation | null => {
    if (!isValidTxid(txid)) return null;
    const pending: PendingNnsOperation = { ...draft, version: 1, txid, createdAt: Date.now() };
    pendingOperation.set(pending);
    try {
      app.storage.local.set(PENDING_STORAGE_KEY, pending);
      const stored = app.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
      if (!isPendingNnsOperation(stored) || stored.txid !== pending.txid) {
        throw new Error("pending receipt readback failed");
      }
      recoveryStorageStatus.set("ready");
    } catch {
      recoveryStorageStatus.set("unavailable");
      transactionNotice.set(t("recoveryStorageFailed", { txid }));
    }
    return pending;
  };

  const waitForOutcome = async (pending: PendingNnsOperation): Promise<NnsNameSnapshot> => {
    let sawHalt = false;
    const deadline = Date.now() + TRANSACTION_CONFIRMATION_WINDOW_MS;
    for (let attempt = 0; attempt < TRANSACTION_POLL_ATTEMPTS; attempt += 1) {
      if (Date.now() >= deadline) break;
      const outcome = await readNnsTransactionOutcome(pending.network, pending.txid, pending.contractHash);
      if (outcome.state === "fault") {
        clearPending();
        transactionNotice.set(t("transactionFault", { txid: pending.txid }));
        throw new Error(t("transactionFault", { txid: pending.txid }));
      }
      if (outcome.state === "halt") {
        sawHalt = true;
        try {
          const snapshot = await readNnsNameSnapshot(
            pending.network,
            pending.contractHash,
            pending.name,
            { includeTarget: pending.kind === "set-record" },
          );
          if (pendingMatchesOutcome(pending, outcome, snapshot)) return snapshot;
        } catch {
          // A different public RPC may lag the receipt node. Retry; never turn
          // an absent readback into success or an invented empty value.
        }
      }
      if (attempt + 1 < TRANSACTION_POLL_ATTEMPTS && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, TRANSACTION_POLL_DELAY_MS));
      }
    }
    const key = sawHalt ? "transactionReadbackPending" : "transactionPending";
    transactionNotice.set(t(key, { txid: pending.txid }));
    throw new Error(t(key, { txid: pending.txid }));
  };

  const confirmPending = async (pending: PendingNnsOperation): Promise<NnsNameSnapshot> => {
    const snapshot = await waitForOutcome(pending);
    const originalWalletStillActive = sameAddress(app.chain.address.get(), pending.actor);
    if (originalWalletStillActive) {
      if (pending.kind === "transfer") {
        myDomains.set(myDomains.get().filter((domain) => domain.name !== pending.name));
        if (managingDomain.get()?.name === pending.name) managingDomain.set(null);
      } else {
        updateDomainFromSnapshot(snapshot);
      }
    }
    const receiptCleared = clearPending();
    const noticeKey = !receiptCleared
      ? "transactionConfirmedStorageStale"
      : originalWalletStillActive
        ? "transactionConfirmed"
        : "transactionConfirmedWalletChanged";
    transactionNotice.set(t(noticeKey, { txid: pending.txid }));
    return snapshot;
  };

  const invokeTracked = async (
    draft: PendingDraft,
    operation: string,
    args: Parameters<typeof app.chain.invoke>[1],
    waitForEvent?: "Transfer" | "Renew",
  ): Promise<NnsNameSnapshot> => {
    if (pendingOperation.get()) throw new Error(t("resolvePendingFirst"));
    ensureRecoveryStorage();
    let tracked: PendingNnsOperation | null = null;
    const result = await app.chain.invoke(operation, args, {
      scriptHash: draft.contractHash,
      ...(waitForEvent ? { waitForEvent } : {}),
      onTransactionSent: (txid) => { tracked = persistPending(draft, txid); },
    });
    tracked ??= persistPending(draft, result.txid);
    if (!result.success) {
      if (tracked) throw new Error(t("transactionResponseUncertain", { txid: tracked.txid }));
      clearPending();
      throw new Error(t("transactionNotBroadcast"));
    }
    if (!tracked) throw new Error(t("transactionReceiptMissing"));
    return confirmPending(tracked);
  };

  const loadMyDomains = async (knownContext?: NnsChainContext) => {
    const address = clean(app.chain.address.get());
    const generation = ++domainLoadGeneration;
    if (!address) {
      myDomains.set([]);
      domainsStatus.set("idle");
      return;
    }
    if (!isValidNeoAddress(address)) {
      domainsStatus.set("failed");
      error.set(t("walletAddressInvalid"));
      return;
    }
    domainsStatus.set("loading");
    try {
      const context = knownContext ?? await requireContext();
      const owned = await fetchOwnedDomains(address, context.network, context.contractHash);
      if (disposed || generation !== domainLoadGeneration || clean(app.chain.address.get()) !== address) return;
      const domains: Domain[] = owned.map((domain) => ({
        name: domain.name,
        owner: address,
        expiry: normalizeNnsExpiryMs(domain.expiration),
        ...(domain.target ? { target: domain.target } : {}),
      }));
      myDomains.set(domains.sort((a, b) => b.expiry - a.expiry));
      domainsStatus.set("chain");
    } catch {
      if (disposed || generation !== domainLoadGeneration || clean(app.chain.address.get()) !== address) return;
      domainsStatus.set("failed");
      error.set(t("domainsLoadFailed"));
      // Preserve the last verified list. An RPC failure is not proof of zero.
    }
  };

  const cancelScheduledSearch = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    searchDebounceResolve?.();
    searchDebounceResolve = null;
  };

  const runSearch = async (query: string) => {
    const generation = ++searchGeneration;
    isSearching.set(true);
    error.set("");
    searchResult.set(null);
    registrationCost.set("");
    try {
      const fullName = normalizeNnsName(query);
      if (!fullName) throw new Error(t("invalidDomainName"));
      const context = await requireContext();
      const snapshot = await readNnsSearchSnapshot(context.network, context.contractHash, fullName);
      if (disposed || generation !== searchGeneration || normalizeNnsName(searchQuery.get()) !== fullName) return;
      const price = formatGasBaseUnits(snapshot.priceBase);
      registrationCost.set(price);
      searchResult.set({
        name: fullName,
        available: snapshot.availability === "available",
        restricted: snapshot.availability === "restricted",
        price,
        priceBase: snapshot.priceBase,
        ...(snapshot.owner ? { owner: snapshot.owner } : {}),
        ...(snapshot.expiration ? { expiry: snapshot.expiration } : {}),
      });
    } catch (cause) {
      if (!disposed && generation === searchGeneration) {
        const message = cause instanceof Error ? cause.message : "";
        const productErrors = new Set([
          t("invalidDomainName"),
          t("networkMismatch"),
          t("networkUnverified"),
          t("contractUnavailable"),
          t("contractMismatch"),
        ]);
        error.set(productErrors.has(message) ? message : t("availabilityFailed"));
      }
    } finally {
      if (!disposed && generation === searchGeneration) isSearching.set(false);
    }
  };

  const searchDomain = async (immediate = true): Promise<void> => {
    const query = searchQuery.get();
    cancelScheduledSearch();
    if (!clean(query)) {
      searchGeneration += 1;
      isSearching.set(false);
      searchResult.set(null);
      registrationCost.set("");
      return;
    }
    if (immediate) return runSearch(query);
    await new Promise<void>((resolve) => {
      searchDebounceResolve = resolve;
      searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null;
        searchDebounceResolve = null;
        void runSearch(query).finally(resolve);
      }, SEARCH_DEBOUNCE_MS);
    });
  };

  const readPriceBase = async (domain: Domain, context: NnsChainContext): Promise<string> => {
    const baseName = domain.name.replace(/\.neo$/, "");
    const raw = await app.chain.readRaw(
      "getPrice",
      [app.chain.arg.integer(baseName.length)],
      { scriptHash: context.contractHash },
    );
    const value = clean(raw);
    if (!/^-?\d+$/.test(value)) throw new Error(t("priceReadFailed"));
    if (BigInt(value) < 0n) throw new Error(t("nameRestricted"));
    return BigInt(value).toString();
  };

  /** Backwards-compatible numeric reader; UI/payment paths retain the exact base-unit string. */
  const getRenewPrice = async (domain: Domain): Promise<number> => {
    const context = await requireContext();
    return Number(formatGasBaseUnits(await readPriceBase(domain, context)));
  };

  const prepareRenew = async (domain: Domain): Promise<RenewQuote> => {
    if (writeInFlight) throw new Error(t("operationInProgress"));
    const generation = ++renewQuoteGeneration;
    beginBusy();
    try {
      const context = await requireContext();
      const snapshot = await readNnsNameSnapshot(context.network, context.contractHash, domain.name);
      const priceBase = await readPriceBase(domain, context);
      const quote = { name: domain.name, price: formatGasBaseUnits(priceBase), priceBase, expiry: snapshot.expiration };
      if (
        disposed || generation !== renewQuoteGeneration ||
        managingDomain.get()?.name !== domain.name || !sameAddress(app.chain.address.get(), domain.owner)
      ) throw new Error(t("renewQuoteStale"));
      renewQuote.set(quote);
      return quote;
    } finally {
      endBusy();
    }
  };

  const cancelRenew = () => {
    renewQuoteGeneration += 1;
    renewQuote.set(null);
  };

  const registerDomain = async () => {
    const searched = searchResult.get();
    const currentName = normalizeNnsName(searchQuery.get());
    if (!searched?.available || !searched.priceBase || currentName !== searched.name) {
      throw new Error(t("searchAgainBeforeRegister"));
    }
    error.set("");
    beginWrite();
    try {
      const context = await requireActorContext();
      const fresh = await readNnsSearchSnapshot(context.network, context.contractHash, searched.name);
      if (fresh.availability !== "available" || fresh.priceBase !== searched.priceBase) {
        searchResult.set(null);
        registrationCost.set("");
        throw new Error(t("availabilityChanged"));
      }
      const draft: PendingDraft = {
        kind: "register",
        network: context.network,
        contractHash: context.contractHash,
        actor: context.actor,
        name: searched.name,
        priceBase: fresh.priceBase,
      };
      await invokeTracked(draft, "register", [
        app.chain.arg.string(searched.name),
        app.chain.arg.hash160(context.actor),
      ], "Transfer");
      searchQuery.set("");
      searchResult.set(null);
      registrationCost.set("");
      if (sameAddress(app.chain.address.get(), context.actor)) domainsStatus.set("chain");
    } finally {
      endWrite();
    }
  };

  const assertOwned = async (domain: Domain, context: NnsChainContext & { actor: string }) => {
    const snapshot = await readNnsNameSnapshot(context.network, context.contractHash, domain.name);
    if (!sameAddress(snapshot.owner, context.actor)) throw new Error(t("domainOwnerMismatch"));
    return snapshot;
  };

  const setRecord = async (domain: Domain, targetAddress: string) => {
    const target = clean(targetAddress);
    if (!isValidNeoAddress(target)) throw new Error(t("invalidAddress"));
    error.set("");
    beginWrite();
    try {
      const context = await requireActorContext();
      const snapshot = await readNnsNameSnapshot(
        context.network,
        context.contractHash,
        domain.name,
        { includeTarget: true },
      );
      if (!sameAddress(snapshot.owner, context.actor)) throw new Error(t("domainOwnerMismatch"));
      if (snapshot.target === target) throw new Error(t("targetAlreadySet"));
      const draft: PendingDraft = {
        kind: "set-record",
        network: context.network,
        contractHash: context.contractHash,
        actor: context.actor,
        name: domain.name,
        target,
      };
      await invokeTracked(draft, "setRecord", [
        app.chain.arg.string(domain.name),
        app.chain.arg.integer(NNS_RECORD_TYPE_ADDRESS),
        app.chain.arg.string(target),
      ]);
    } finally {
      endWrite();
    }
  };

  const transferDomain = async (domain: Domain, toAddress: string) => {
    const receiver = clean(toAddress);
    if (!isValidNeoAddress(receiver) || sameAddress(receiver, app.chain.address.get())) {
      throw new Error(t("invalidTransferAddress"));
    }
    error.set("");
    beginWrite();
    try {
      const context = await requireActorContext();
      if (sameAddress(receiver, context.actor)) throw new Error(t("invalidTransferAddress"));
      await assertOwned(domain, context);
      const draft: PendingDraft = {
        kind: "transfer",
        network: context.network,
        contractHash: context.contractHash,
        actor: context.actor,
        name: domain.name,
        receiver,
      };
      await invokeTracked(draft, "transfer", [
        app.chain.arg.hash160Raw(receiver),
        app.chain.arg.byteArray(domainToTokenId(domain.name)),
        app.chain.arg.string(""),
      ], "Transfer");
    } finally {
      endWrite();
    }
  };

  const renewDomain = async (domain: Domain) => {
    const quote = renewQuote.get();
    if (!quote || quote.name !== domain.name) throw new Error(t("renewQuoteRequired"));
    error.set("");
    beginWrite();
    try {
      const context = await requireActorContext();
      const snapshot = await assertOwned(domain, context);
      const priceBase = await readPriceBase(domain, context);
      if (snapshot.expiration !== quote.expiry || priceBase !== quote.priceBase) {
        renewQuote.set(null);
        throw new Error(t("renewQuoteChanged"));
      }
      const draft: PendingDraft = {
        kind: "renew",
        network: context.network,
        contractHash: context.contractHash,
        actor: context.actor,
        name: domain.name,
        beforeExpiry: snapshot.expiration,
        priceBase,
      };
      await invokeTracked(draft, "renew", [app.chain.arg.string(domain.name)], "Renew");
      renewQuote.set(null);
    } finally {
      endWrite();
    }
  };

  const recoverPending = async () => {
    const pending = pendingOperation.get();
    if (!pending || isRecovering.get()) return;
    if (writeInFlight) throw new Error(t("operationInProgress"));
    error.set("");
    transactionNotice.set("");
    isRecovering.set(true);
    try {
      const context = await requireActorContext();
      if (
        context.network !== pending.network || context.contractHash !== pending.contractHash ||
        !sameAddress(context.actor, pending.actor)
      ) throw new Error(t("pendingContextMismatch"));
      await confirmPending(pending);
    } finally {
      isRecovering.set(false);
    }
  };

  const showManage = (domain: Domain) => {
    renewQuoteGeneration += 1;
    managingDomain.set(domain);
    renewQuote.set(null);
  };
  const cancelManage = () => {
    renewQuoteGeneration += 1;
    managingDomain.set(null);
    renewQuote.set(null);
  };

  const handleAccountChanged = () => {
    domainLoadGeneration += 1;
    myDomains.set([]);
    domainsStatus.set(app.chain.address.get() ? "loading" : "idle");
    managingDomain.set(null);
    renewQuoteGeneration += 1;
    renewQuote.set(null);
    activeNetwork.set("");
    activeContract.set("");
    error.set("");
    transactionNotice.set("");
  };

  const loadAll = async () => {
    beginBusy();
    error.set("");
    try {
      const context = await requireContext();
      await loadMyDomains(context);
    } catch (cause) {
      if (cause instanceof NnsNetworkUnbound) {
        // Expected on a cold entry: no launch network, no wallet provider. The
        // surface stays idle and the connect prompt does its job. Printing
        // "Neo network and NNS contract status could not be verified." here
        // framed a first paint that had attempted nothing as a failure.
        domainsStatus.set("idle");
        return;
      }
      domainsStatus.set("failed");
      error.set(t("chainContextFailed"));
    } finally {
      endBusy();
    }
  };

  const unsubscribeSearch = searchQuery.subscribe(() => {
    searchGeneration += 1;
    isSearching.set(false);
    cancelScheduledSearch();
    const result = searchResult.get();
    if (result && normalizeNnsName(searchQuery.get()) !== result.name) {
      searchResult.set(null);
      registrationCost.set("");
    }
  });

  const cleanup = () => {
    disposed = true;
    searchGeneration += 1;
    renewQuoteGeneration += 1;
    cancelScheduledSearch();
    unsubscribeSearch();
  };

  return {
    myDomains, domainsStatus, isLoading, error, searchQuery, searchResult, isSearching,
    registrationCost, managingDomain, renewQuote, pendingOperation, isRecovering,
    transactionNotice, activeNetwork, activeContract, recoveryStorageStatus,
    domainCount, walletStatus, expiringSoon,
    loadMyDomains, loadAll, searchDomain, registerDomain, setRecord,
    transferDomain, renewDomain, prepareRenew, cancelRenew, recoverPending,
    getRenewPrice, showManage, cancelManage, handleAccountChanged, cleanup,
  };
}
