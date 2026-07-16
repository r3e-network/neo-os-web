/**
 * Production lifecycle for the two-party Breakup Pact contract.
 *
 * The deployed contract uses a pull-payment ledger: deposits, cancellation
 * refunds, honored-pact refunds, and break payouts all become `creditOf`
 * balance first. `withdraw` is the only operation that moves that GAS back to
 * a wallet. Every write below therefore requires either a validated event plus
 * matching state, or matching authoritative state after broadcast. A txid by
 * itself is never reported as success, and state alone never replaces exact
 * transaction evidence.
 */

import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { parseGas } from "@shared/utils/format";
import { addressToScriptHash, ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import type { ContractStatus, RelationshipContractView } from "../types";
import { scriptHashToAddress } from "../utils/address";
import {
  BREAKUP_PENDING_STORE_KEY,
  classifyBreakupConfirmation,
  eventNameForBreakupKind,
  findMatchingBreakupEvent,
  isPendingBreakupAction,
  normalizeBreakupHash,
  normalizeBreakupTxid,
  parseBreakupInteger,
  readBreakupTransactionOutcome,
  requireCanonicalBreakupContext,
  type BreakupChainContext,
  type BreakupNotification,
  type BreakupPendingKind,
  type PendingBreakupAction,
} from "./breakupSafety";

const MIN_STAKE_BASE = 100_000_000n;
const MIN_DURATION_DAYS = 30;
const MAX_DURATION_DAYS = 3650;
const TITLE_MAX = 100;
const TERMS_MAX = 2000;
const STAKE_MEMO = "miniapp-breakup:stake";
const META_STORE_KEY = "meta";
const PARTY_PAGE_LIMIT = 100;
const PARTY_HISTORY_CAP = 500;
const GAS_AMOUNT_PATTERN = /^(?:[1-9]\d*)(?:\.\d{1,8})?$/;

const STATUS_PENDING = 0;
const STATUS_ACTIVE = 1;
const STATUS_BROKEN = 2;
const STATUS_SETTLED = 3;
const STATUS_CANCELLED = 4;

/**
 * Phase of the wallet-scoped contract list read.
 * - `loading`         — a read is in flight; the counts are not known yet.
 * - `awaiting-wallet` — no wallet, so there is no party to scope a read to.
 *                       A settled fact, not a pending read.
 * - `ready`           — the list came back; the counts are real (zero included).
 */
export type BreakupReadStatus = "loading" | "awaiting-wallet" | "ready";

export interface UseBreakupOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  network?: string;
}

interface PactMeta {
  title: string;
  terms: string;
}

interface DecodedPact {
  id: string;
  party1: string;
  party2: string;
  stake: bigint;
  endTime: number;
  party1Staked: boolean;
  party2Staked: boolean;
  status: number;
  breaker: string;
}

export interface CreatePactOutcome {
  created: true;
  pactId: string;
  metadataSaved: boolean;
}

class PendingConfirmationError extends Error {}
type BreakupActionPhase =
  | "idle"
  | "preparing"
  | "depositing"
  | "creating"
  | "signing"
  | "cancelling"
  | "breaking"
  | "settling"
  | "withdrawing";

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

const toIdString = (value: unknown): string => {
  const parsed = parseBreakupInteger(value);
  return parsed !== null && parsed > 0n ? parsed.toString() : "";
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === 0n) return false;
  if (value === 1 || value === 1n) return true;
  const text = String(value ?? "").toLowerCase();
  if (text === "0" || text === "false") return false;
  if (text === "1" || text === "true") return true;
  return null;
};

const sameHash = (left: string, right: string): boolean => {
  if (!left || !right) return false;
  return ownerMatchesAddress(left, right) || left.toLowerCase() === right.toLowerCase();
};

const decodePact = (raw: unknown, fallbackId = ""): DecodedPact => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("pact not found");
  }
  const value = raw as Record<string, unknown>;
  const party1 = parseHash160(value.party1);
  const party2 = parseHash160(value.party2);
  const stake = parseBreakupInteger(value.stake);
  const endTimeRaw = parseBreakupInteger(value.endTime);
  const statusRaw = parseBreakupInteger(value.status);
  const party1Staked = toBoolean(value.party1Staked);
  const party2Staked = toBoolean(value.party2Staked);
  const id = toIdString(value.id);
  const endTime = endTimeRaw === null ? Number.NaN : Number(endTimeRaw);
  const status = statusRaw === null ? Number.NaN : Number(statusRaw);
  if (
    !id || (fallbackId && id !== fallbackId) || !party1 || !party2 || stake === null || stake <= 0n ||
    !Number.isSafeInteger(endTime) || endTime <= 0 ||
    !Number.isInteger(status) || status < STATUS_PENDING || status > STATUS_CANCELLED ||
    party1Staked === null || party2Staked === null
  ) {
    throw new Error("invalid pact state");
  }
  return {
    id,
    party1,
    party2,
    stake,
    endTime,
    party1Staked,
    party2Staked,
    status,
    breaker: parseHash160(value.breaker) || "",
  };
};

const notificationInteger = (event: BreakupNotification, index: number): bigint | null => {
  return parseBreakupInteger(event.values[index]);
};

export function useBreakup({ app, t }: UseBreakupOptions) {
  const partnerAddress = createObservable("");
  const stakeAmount = createObservable("");
  const duration = createObservable("");
  const contractTitle = createObservable("");
  const contractTerms = createObservable("");

  const contracts = createObservable<RelationshipContractView[]>([]);
  /**
   * Which phase the wallet-scoped contract list read is in.
   *
   * `contracts` rests at `[]`, so every count below derived to 0 and the chrome
   * published "Contracts 0 · Active 0 · Broken 0" before any read had run — and
   * again for a visitor with no wallet connected. A count is a claim; an empty
   * list that nobody has filled is not a reading that there are none.
   */
  const contractsStatus = createObservable<BreakupReadStatus>("loading");
  const isLoading = createObservable(false);
  const serviceNotice = createObservable("");
  const actionNotice = createObservable("");
  const validationNotice = createObservable("");
  const pendingNotice = createObservable("");
  const actionPhase = createObservable<BreakupActionPhase>("idle");
  const hasPendingAction = createObservable(false);
  const lastSubmittedTitle = createObservable("");
  const creditBalance = createObservable("—");
  const creditBalanceRaw = createObservable("");
  const creditKnown = createObservable(false);
  const address = createObservable("");

  const contractCount = createDerived(() => contracts.get().length, [contracts]);
  const activeCount = createDerived(() => contracts.get().filter((item) => item.status === "active").length, [contracts]);
  const pendingCount = createDerived(() => contracts.get().filter((item) => item.status === "pending").length, [contracts]);
  const brokenCount = createDerived(() => contracts.get().filter((item) => item.status === "broken").length, [contracts]);

  /**
   * Chrome read-outs of the same counts. The counts above stay plain numbers
   * for the PlayArea's arithmetic and badges; these can also say why they have
   * no number yet. Only the unread state is `undefined` — the manifest
   * binding's `pendingKey` speaks for it — while "Connect wallet" is a settled
   * fact and so is a real value.
   */
  const countDisplay = (source: Observable<number>) =>
    createDerived(() => {
      const status = contractsStatus.get();
      if (status === "loading") return undefined;
      if (status === "awaiting-wallet") return t("breakupAwaitingWallet");
      return source.get();
    }, [source, contractsStatus]);
  const contractCountDisplay = countDisplay(contractCount);
  const activeCountDisplay = countDisplay(activeCount);
  const pendingCountDisplay = countDisplay(pendingCount);
  const brokenCountDisplay = countDisplay(brokenCount);
  const hasCredit = createDerived(() => {
    if (!creditKnown.get()) return false;
    const value = parseBreakupInteger(creditBalanceRaw.get());
    return value !== null && value > 0n;
  }, [creditKnown, creditBalanceRaw]);

  let loadGeneration = 0;
  const volatileMeta: Record<string, PactMeta> = {};

  const storageScope = (context: BreakupChainContext) => `${context.network}:${context.contractHash}`;

  const loadMetaStore = (): Record<string, PactMeta> => {
    const raw = app.storage.local.get<Record<string, PactMeta>>(META_STORE_KEY, {});
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  };

  const metaFor = (store: Record<string, PactMeta>, scope: string, id: string): PactMeta | undefined => {
    const scoped = store[`${scope}:${id}`] ?? volatileMeta[`${scope}:${id}`];
    if (scoped) return scoped;
    // The pre-network-aware app stored plain ids. Its default was mainnet, so
    // only mainnet may inherit those entries; testnet must never alias them.
    return scope.startsWith("mainnet:") ? store[id] : undefined;
  };

  const saveLocalMeta = (scope: string, pactId: string, meta: PactMeta): boolean => {
    const scopedKey = `${scope}:${pactId}`;
    volatileMeta[scopedKey] = meta;
    try {
      const current = loadMetaStore();
      const next = { ...current, [scopedKey]: meta };
      if (scope.startsWith("mainnet:")) next[pactId] = meta;
      app.storage.local.set(META_STORE_KEY, next);
      const roundTrip = app.storage.local.get<Record<string, PactMeta>>(META_STORE_KEY, {});
      return roundTrip?.[scopedKey]?.title === meta.title && roundTrip?.[scopedKey]?.terms === meta.terms;
    } catch {
      return false;
    }
  };

  const pendingMap = (): Record<string, unknown> => {
    try {
      const raw = app.storage.local.get<Record<string, unknown>>(BREAKUP_PENDING_STORE_KEY, {});
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("invalid pending store");
      }
      return raw;
    } catch {
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const pendingKey = (context: BreakupChainContext, walletHash: string) =>
    `${storageScope(context)}:${walletHash.toLowerCase()}`;

  const writePending = (action: PendingBreakupAction) => {
    if (!isPendingBreakupAction(action)) throw new Error(t("invalidRecoveryRecord"));
    const context = { network: action.network, contractHash: action.contractHash } satisfies BreakupChainContext;
    const key = pendingKey(context, action.walletHash);
    try {
      app.storage.local.set(BREAKUP_PENDING_STORE_KEY, { ...pendingMap(), [key]: action });
      const stored = pendingMap()[key];
      if (!isPendingBreakupAction(stored) || JSON.stringify(stored) !== JSON.stringify(action)) {
        throw new Error("pending readback mismatch");
      }
      hasPendingAction.set(true);
    } catch {
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const clearPending = (context: BreakupChainContext, walletHash: string): boolean => {
    const key = pendingKey(context, walletHash);
    try {
      const map = { ...pendingMap() };
      delete map[key];
      app.storage.local.set(BREAKUP_PENDING_STORE_KEY, map);
      if (pendingMap()[key] !== undefined) throw new Error("pending delete mismatch");
      hasPendingAction.set(false);
      return true;
    } catch {
      hasPendingAction.set(true);
      pendingNotice.set(t("recoveryStorageUnavailable"));
      return false;
    }
  };

  const assertRecoveryStorageAvailable = () => {
    const key = `${BREAKUP_PENDING_STORE_KEY}:probe`;
    const marker = { version: 1, createdAt: Date.now(), marker: `${Date.now()}:${Math.random()}` };
    try {
      app.storage.local.set(key, marker);
      const stored = app.storage.local.get<typeof marker | null>(key, null);
      if (JSON.stringify(stored) !== JSON.stringify(marker)) throw new Error("probe readback mismatch");
      app.storage.local.delete(key);
      if (app.storage.local.get<unknown>(key, null) !== null) throw new Error("probe delete mismatch");
    } catch {
      try { app.storage.local.delete(key); } catch { /* best-effort probe cleanup */ }
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const assertNoPending = (context: BreakupChainContext, walletHash: string) => {
    const stored = pendingMap()[pendingKey(context, walletHash)];
    if (stored !== undefined) {
      hasPendingAction.set(true);
      throw new Error(t(isPendingBreakupAction(stored) ? "pendingBlocksWrites" : "invalidRecoveryRecord"));
    }
  };

  const mapPact = (pact: DecodedPact, meta?: PactMeta): RelationshipContractView => {
    let status: ContractStatus = "pending";
    if (pact.status === STATUS_ACTIVE) status = "active";
    else if (pact.status === STATUS_BROKEN) status = "broken";
    else if (pact.status === STATUS_SETTLED) status = "ended";
    else if (pact.status === STATUS_CANCELLED) status = "cancelled";

    const now = Date.now();
    const isCreator = ownerMatchesAddress(pact.party1, address.get());
    const isPartner = ownerMatchesAddress(pact.party2, address.get());
    const counterparty = isCreator ? pact.party2 : pact.party1;
    const terminal = pact.status >= STATUS_BROKEN;
    const expiredActive = pact.status === STATUS_ACTIVE && now >= pact.endTime;

    return {
      id: Number(pact.id),
      pactId: pact.id,
      party1: pact.party1,
      party2: pact.party2,
      partner: scriptHashToAddress(counterparty) || counterparty,
      isCreator,
      isPartner,
      title: meta?.title || t("untitledContract"),
      terms: meta?.terms ?? "",
      stake: parseGas(pact.stake),
      stakeRaw: pact.stake.toString(),
      progress: terminal || expiredActive ? 100 : 0,
      daysLeft: Math.max(0, Math.ceil((pact.endTime - now) / 86_400_000)),
      status,
      party1Signed: pact.party1Staked,
      party2Signed: pact.party2Staked,
      settleable: expiredActive,
    };
  };

  const readDecodedPact = async (id: string) =>
    decodePact(await app.chain.readRaw("getPact", [app.chain.arg.integer(id)]), id);

  const readCredit = async (walletHash: string): Promise<bigint> => {
    const raw = await app.chain.readRaw("creditOf", [app.chain.arg.hash160(walletHash)]);
    const value = parseBreakupInteger(raw);
    if (value === null || value < 0n) throw new Error("invalid credit state");
    return value;
  };

  const applyCredit = (value: bigint | null) => {
    if (value === null) {
      creditKnown.set(false);
      creditBalance.set("—");
      creditBalanceRaw.set("");
      return;
    }
    creditKnown.set(true);
    creditBalanceRaw.set(value.toString());
    creditBalance.set(value > 0n ? String(parseGas(value)) : "0");
  };

  type Reconciliation = {
    status: "none" | "pending" | "fault" | "confirmed";
    event?: BreakupNotification;
    metadataSaved?: boolean;
  };

  const pendingReadbackMatches = async (
    pending: PendingBreakupAction,
    event: BreakupNotification,
  ): Promise<boolean> => {
    if (pending.kind === "deposit-create" || pending.kind === "deposit-sign") {
      const credit = await readCredit(pending.walletHash);
      return credit >= BigInt(pending.requiredCreditRaw ?? "0");
    }
    if (pending.kind === "withdraw") return await readCredit(pending.walletHash) === 0n;

    const eventPactId = pending.kind === "create"
      ? notificationInteger(event, 0)?.toString() ?? ""
      : pending.pactId ?? "";
    if (!eventPactId) return false;
    const pact = await readDecodedPact(eventPactId);
    const baseMatches = pact.stake.toString() === pending.stakeRaw &&
      sameHash(pact.party1, pending.kind === "create" ? pending.walletHash : pending.party1Hash ?? "") &&
      sameHash(pact.party2, pending.kind === "create" ? pending.party2Hash ?? "" : pending.party2Hash ?? "");
    if (!baseMatches) return false;

    if (pending.kind === "create") {
      const eventEndTime = notificationInteger(event, 4);
      if (eventEndTime === null || BigInt(pact.endTime) !== eventEndTime || !pact.party1Staked) return false;
      const expectedEndTime = pending.createdAt + Number(pending.durationSeconds ?? 0) * 1000;
      return Math.abs(Number(eventEndTime) - expectedEndTime) <= 30 * 60 * 1000;
    }
    if (pending.kind === "sign") {
      return pact.party1Staked && pact.party2Staked &&
        [STATUS_ACTIVE, STATUS_BROKEN, STATUS_SETTLED].includes(pact.status);
    }
    if (pending.kind === "cancel") return pact.status === STATUS_CANCELLED;
    if (pending.kind === "break") {
      return pact.status === STATUS_BROKEN && sameHash(pact.breaker, pending.walletHash);
    }
    return pact.status === STATUS_SETTLED;
  };

  const reconcilePendingRecord = async (
    context: BreakupChainContext,
    pending: PendingBreakupAction,
  ): Promise<Reconciliation> => {
    hasPendingAction.set(true);
    const outcome = await readBreakupTransactionOutcome(pending);
    const event = findMatchingBreakupEvent(pending, outcome);
    let readbackMatches = false;
    if (event) {
      try {
        readbackMatches = await pendingReadbackMatches(pending, event);
      } catch {
        readbackMatches = false;
      }
    }
    const classification = classifyBreakupConfirmation(outcome.state, Boolean(event), readbackMatches);
    if (classification === "fault") {
      const cleared = clearPending(context, pending.walletHash);
      if (cleared) pendingNotice.set("");
      actionNotice.set(t("transactionFaulted"));
      return { status: "fault" };
    }
    if (classification !== "confirmed" || !event) {
      pendingNotice.set(t("actionPendingRecovery", { txid: pending.txid }));
      return { status: "pending" };
    }

    let metadataSaved: boolean | undefined;
    if (pending.kind === "create") {
      const pactId = notificationInteger(event, 0)?.toString() ?? "";
      const meta = { title: pending.title ?? "", terms: pending.terms ?? "" };
      metadataSaved = saveLocalMeta(storageScope(context), pactId, meta);
      contracts.set(contracts.get().map((item) => item.pactId === pactId ? { ...item, ...meta } : item));
      actionNotice.set(t("pendingCreateRecovered", { id: pactId }));
    }
    const cleared = clearPending(context, pending.walletHash);
    if (!cleared) {
      return { status: "confirmed", event, metadataSaved };
    }
    if (pending.kind === "deposit-create" || pending.kind === "deposit-sign") {
      pendingNotice.set(t("depositConfirmedRetry"));
    } else {
      pendingNotice.set("");
    }
    return { status: "confirmed", event, metadataSaved };
  };

  const reconcilePending = async (
    context: BreakupChainContext,
    walletHash: string,
  ): Promise<Reconciliation> => {
    let raw: unknown;
    try {
      raw = pendingMap()[pendingKey(context, walletHash)];
    } catch {
      hasPendingAction.set(true);
      pendingNotice.set(t("recoveryStorageUnavailable"));
      return { status: "pending" };
    }
    if (raw === undefined) {
      hasPendingAction.set(false);
      pendingNotice.set("");
      return { status: "none" };
    }
    if (
      !isPendingBreakupAction(raw) ||
      raw.network !== context.network ||
      raw.contractHash !== context.contractHash ||
      raw.walletHash !== walletHash.toLowerCase()
    ) {
      hasPendingAction.set(true);
      pendingNotice.set(t("invalidRecoveryRecord"));
      return { status: "pending" };
    }
    return reconcilePendingRecord(context, raw);
  };

  const loadContracts = async () => {
    const generation = ++loadGeneration;
    const wallet = address.get();
    const walletHash = wallet ? addressToScriptHash(wallet) : "";
    isLoading.set(true);
    if (!walletHash) {
      contracts.set([]);
      applyCredit(null);
      serviceNotice.set("");
      pendingNotice.set("");
      hasPendingAction.set(false);
      if (generation === loadGeneration) {
        isLoading.set(false);
        // Not "ready": an empty list here means "we have no wallet to look you
        // up by", not "you have no contracts".
        contractsStatus.set("awaiting-wallet");
      }
      return;
    }
    contractsStatus.set("loading");

    try {
      let context: BreakupChainContext;
      try {
        context = await requireCanonicalBreakupContext(app, t("chainContextMismatch"));
      } catch {
        applyCredit(null);
        serviceNotice.set(t("chainContextMismatch"));
        return;
      }

      const scope = storageScope(context);
      let nextViews: RelationshipContractView[] | null = null;
      let nextCredit: bigint | null = null;
      let partialReads = 0;
      let historyLimited = false;
      let listFailed = false;
      try {
        const countRaw = parseBreakupInteger(await app.chain.readRaw("partyPactCount", [app.chain.arg.hash160(walletHash)]));
        const count = countRaw === null ? Number.NaN : Number(countRaw);
        if (!Number.isSafeInteger(count) || count < 0) throw new Error("invalid pact count");
        const start = Math.max(0, count - PARTY_HISTORY_CAP);
        historyLimited = start > 0;
        const ids: string[] = [];
        for (let offset = start; offset < count; offset += PARTY_PAGE_LIMIT) {
          const page = await app.chain.readArray("getPartyPacts", [
            app.chain.arg.hash160(walletHash),
            app.chain.arg.integer(offset),
            app.chain.arg.integer(Math.min(PARTY_PAGE_LIMIT, count - offset)),
          ]);
          ids.push(...(Array.isArray(page) ? page : []).map(toIdString).filter(Boolean));
        }
        const uniqueIds = [...new Set(ids)];
        const scopeMeta = loadMetaStore();
        const rows = await Promise.all(uniqueIds.map(async (id) => {
          try {
            return mapPact(await readDecodedPact(id), metaFor(scopeMeta, scope, id));
          } catch {
            partialReads += 1;
            return null;
          }
        }));
        nextViews = rows
          .filter((row): row is RelationshipContractView => row !== null)
          .sort((left, right) => right.id - left.id);
      } catch {
        listFailed = true;
      }

      try {
        nextCredit = await readCredit(walletHash);
      } catch {
        nextCredit = null;
      }

      if (generation !== loadGeneration || address.get() !== wallet) return;
      if (nextViews) contracts.set(nextViews);
      applyCredit(nextCredit);
      if (listFailed) serviceNotice.set(t("loadFailedKeepState"));
      else if (partialReads > 0) serviceNotice.set(t("partialLoad", { count: partialReads }));
      else if (historyLimited) serviceNotice.set(t("historyLimited", { count: PARTY_HISTORY_CAP }));
      else if (nextCredit === null) serviceNotice.set(t("creditReadFailed"));
      else serviceNotice.set("");
      await reconcilePending(context, walletHash);
    } finally {
      if (generation === loadGeneration) {
        isLoading.set(false);
        // The read came back. Whatever the counts now say — zero included — is
        // a real reading of this wallet's contracts.
        contractsStatus.set("ready");
      }
    }
  };

  const loadCredit = async () => {
    const walletHash = addressToScriptHash(address.get());
    if (!walletHash) {
      applyCredit(null);
      return;
    }
    try {
      applyCredit(await readCredit(walletHash));
    } catch {
      applyCredit(null);
      serviceNotice.set(t("creditReadFailed"));
    }
  };

  const setWalletAddress = (next: string) => {
    const normalized = String(next ?? "").trim();
    if (normalized === address.get()) return;
    loadGeneration += 1;
    address.set(normalized);
    contracts.set([]);
    applyCredit(null);
    actionNotice.set("");
    serviceNotice.set("");
    pendingNotice.set("");
    hasPendingAction.set(false);
    actionPhase.set("idle");
    lastSubmittedTitle.set("");
  };

  const assertIdle = () => {
    if (isLoading.get() || actionPhase.get() !== "idle") throw new Error(t("actionBusy"));
  };

  const requireWallet = async () => {
    const wallet = String(app.chain.address.get() || await app.chain.ensureWallet()).trim();
    const walletHash = normalizeBreakupHash(addressToScriptHash(wallet || ""));
    if (!wallet || !walletHash) throw new Error(t("contractWalletUnavailable"));
    if (wallet !== address.get()) setWalletAddress(wallet);
    const context = await requireCanonicalBreakupContext(app, t("chainContextMismatch"), true);
    assertRecoveryStorageAvailable();
    assertNoPending(context, walletHash);
    return { walletHash, context };
  };

  const resolvePactId = (contract: { id?: number; pactId?: string }) => {
    const pactId = String(contract.pactId ?? contract.id ?? "");
    if (!/^[1-9]\d*$/.test(pactId)) throw new Error(t("pactIdRequired"));
    return pactId;
  };

  const pendingError = (kind: BreakupPendingKind) => {
    const message = t(kind === "deposit-create" || kind === "deposit-sign"
      ? "depositPendingConfirmation"
      : "actionPendingConfirmation");
    pendingNotice.set(message);
    return new PendingConfirmationError(message);
  };

  const invokeTracked = async (
    context: BreakupChainContext,
    base: Omit<PendingBreakupAction,
      "version" | "eventName" | "network" | "contractHash" | "txid" | "createdAt">,
    operation: string,
    args: Parameters<typeof app.chain.invoke>[1],
    scriptHash?: string,
  ): Promise<Reconciliation> => {
    let pending: PendingBreakupAction | null = null;
    let persistedTxid = "";
    let invocationError: unknown = null;
    const createdAt = Date.now();
    const persist = (nextTxid: string) => {
      const txid = normalizeBreakupTxid(nextTxid);
      if (!txid) throw new Error(t("invalidTransactionId"));
      if (persistedTxid) {
        if (persistedTxid !== txid) throw new Error(t("transactionIdMismatch"));
        return;
      }
      const record: PendingBreakupAction = {
        ...base,
        version: 2,
        eventName: eventNameForBreakupKind(base.kind),
        network: context.network,
        contractHash: context.contractHash,
        txid,
        createdAt,
      };
      writePending(record);
      pending = record;
      persistedTxid = txid;
    };
    try {
      const result = await app.chain.invoke(operation, args, {
        waitForEvent: eventNameForBreakupKind(base.kind),
        onTransactionSent: persist,
        ...(scriptHash ? { scriptHash } : {}),
      });
      if (result.txid) persist(result.txid);
      if (!result.txid && !pending) throw new Error(t("transactionNotBroadcast"));
    } catch (error) {
      invocationError = error;
    }
    if (!pending) throw invocationError ?? new Error(t("transactionNotBroadcast"));
    const reconciliation = await reconcilePendingRecord(context, pending);
    if (reconciliation.status === "confirmed") return reconciliation;
    if (reconciliation.status === "fault") throw new Error(t("transactionFaulted"));
    throw pendingError(base.kind);
  };

  const strictStake = (): bigint => {
    const text = stakeAmount.get().trim();
    if (!GAS_AMOUNT_PATTERN.test(text)) throw new Error(t("stakeOrDurationInvalid"));
    let stake: bigint;
    try {
      stake = app.amount.gasToFixed8(text);
    } catch {
      throw new Error(t("stakeOrDurationInvalid"));
    }
    if (stake < MIN_STAKE_BASE) throw new Error(t("stakeOrDurationInvalid"));
    return stake;
  };

  const ensureCredit = async (
    kind: "create" | "sign",
    required: bigint,
    walletHash: string,
    context: BreakupChainContext,
    pactId?: string,
  ) => {
    let credit: bigint;
    try {
      credit = await readCredit(walletHash);
    } catch {
      throw new Error(t("creditReadRequired"));
    }
    applyCredit(credit);
    if (credit >= required) return;

    const deficit = required - credit;
    actionPhase.set("depositing");
    await invokeTracked(
      context,
      {
        kind: kind === "create" ? "deposit-create" : "deposit-sign",
        walletHash,
        stakeRaw: required.toString(),
        amountRaw: deficit.toString(),
        beforeCreditRaw: credit.toString(),
        requiredCreditRaw: required.toString(),
        assetHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        memo: STAKE_MEMO,
        ...(pactId ? { pactId } : {}),
      },
      "transfer",
      [
        app.chain.arg.hash160(walletHash),
        app.chain.arg.hash160(context.contractHash),
        app.chain.arg.integer(deficit),
        app.chain.arg.string(STAKE_MEMO),
      ],
      BLOCKCHAIN_CONSTANTS.GAS_HASH,
    );
    applyCredit(await readCredit(walletHash));
    pendingNotice.set("");
  };

  const readLastPactId = async (): Promise<string | null> => {
    try {
      const value = parseBreakupInteger(await app.chain.readRaw("lastPactId", []));
      return value !== null && value >= 0n ? value.toString() : null;
    } catch {
      return null;
    }
  };

  const createContract = async (): Promise<CreatePactOutcome> => {
    assertIdle();
    const partner = partnerAddress.get().trim();
    const title = contractTitle.get().trim();
    const terms = contractTerms.get().trim();
    const durationText = duration.get().trim();
    if (!partner) throw new Error(t("partnerRequired"));
    if (!isValidNeoAddress(partner)) throw new Error(t("partnerInvalid"));
    if (!stakeAmount.get().trim()) throw new Error(t("stakeRequired"));
    if (!title) throw new Error(t("titleRequired"));
    if (title.length > TITLE_MAX) throw new Error(t("titleTooLong"));
    if (terms.length > TERMS_MAX) throw new Error(t("termsTooLong"));
    if (!/^[1-9]\d*$/.test(durationText)) throw new Error(t("stakeOrDurationInvalid"));
    const durationDays = Number(durationText);
    if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) {
      throw new Error(t("stakeOrDurationInvalid"));
    }
    const stake = strictStake();
    const durationSeconds = durationDays * 86_400;

    validationNotice.set("");
    actionNotice.set(t("contractPreparing", { title, amount: `${stakeAmount.get().trim()} GAS` }));
    isLoading.set(true);
    actionPhase.set("preparing");
    try {
      const { walletHash, context } = await requireWallet();
      const partnerHash = normalizeBreakupHash(addressToScriptHash(partner));
      if (!partnerHash) throw new Error(t("partnerInvalid"));
      if (sameHash(partnerHash, walletHash)) throw new Error(t("partnerSelf"));
      const beforePactId = await readLastPactId();
      if (beforePactId === null) throw new Error(t("lastPactIdUnavailable"));
      await ensureCredit("create", stake, walletHash, context);

      let tracked: Reconciliation;
      try {
        actionPhase.set("creating");
        tracked = await invokeTracked(
          context,
          {
            kind: "create",
            walletHash,
            beforePactId,
            party2Hash: partnerHash,
            stakeRaw: stake.toString(),
            durationSeconds,
            title,
            terms,
          },
          "createPact",
          [
            app.chain.arg.hash160(walletHash),
            app.chain.arg.hash160(partnerHash),
            app.chain.arg.integer(stake),
            app.chain.arg.integer(durationSeconds),
          ],
        );
      } catch (error) {
        if (error instanceof PendingConfirmationError) throw error;
        let credit: bigint | null = null;
        try { credit = await readCredit(walletHash); } catch { /* keep unknown */ }
        if (credit !== null && credit >= stake) throw new Error(t("depositPrepaidNoContract"));
        throw error;
      }

      const pactId = tracked.event ? notificationInteger(tracked.event, 0)?.toString() ?? "" : "";
      if (!pactId) throw pendingError("create");
      const metadataSaved = tracked.metadataSaved ?? saveLocalMeta(storageScope(context), pactId, { title, terms });
      partnerAddress.set("");
      stakeAmount.set("");
      duration.set("");
      contractTitle.set("");
      contractTerms.set("");
      lastSubmittedTitle.set(title);
      actionNotice.set(metadataSaved
        ? t("contractSubmitted", { title })
        : t("contractCreatedMetadataWarning", { id: pactId }));
      await loadContracts();
      return { created: true, pactId, metadataSaved };
    } catch (error) {
      actionNotice.set(app.errors.messageOf(error));
      throw error;
    } finally {
      isLoading.set(false);
      actionPhase.set("idle");
    }
  };

  const signContract = async (contract: { id?: number; pactId?: string }) => {
    assertIdle();
    const pactId = resolvePactId(contract);
    actionNotice.set(t("contractSigning", { id: pactId }));
    isLoading.set(true);
    actionPhase.set("preparing");
    try {
      const { walletHash, context } = await requireWallet();
      const pact = await readDecodedPact(pactId);
      if (!sameHash(pact.party2, walletHash)) throw new Error(t("signNotPartner"));
      if (pact.status !== STATUS_PENDING || !pact.party1Staked || pact.party2Staked) {
        throw new Error(t("pactNotPending"));
      }
      if (Date.now() >= pact.endTime) throw new Error(t("pactExpired"));
      await ensureCredit("sign", pact.stake, walletHash, context, pactId);
      actionPhase.set("signing");
      await invokeTracked(
        context,
        {
          kind: "sign",
          walletHash,
          pactId,
          party1Hash: pact.party1,
          party2Hash: pact.party2,
          stakeRaw: pact.stake.toString(),
        },
        "signPact",
        [app.chain.arg.integer(pactId), app.chain.arg.hash160(walletHash)],
      );
      actionNotice.set(t("contractSigned"));
      await loadContracts();
    } catch (error) {
      actionNotice.set(app.errors.messageOf(error));
      throw error;
    } finally {
      isLoading.set(false);
      actionPhase.set("idle");
    }
  };

  const breakContract = async (
    contract: { id?: number; pactId?: string },
    expected: "break" | "cancel" = "break",
  ) => {
    assertIdle();
    const pactId = resolvePactId(contract);
    isLoading.set(true);
    actionPhase.set("preparing");
    try {
      const { walletHash, context } = await requireWallet();
      const pact = await readDecodedPact(pactId);
      const isParty = sameHash(pact.party1, walletHash) || sameHash(pact.party2, walletHash);
      let kind: "break" | "cancel";
      if (pact.status === STATUS_PENDING) {
        if (expected !== "cancel") throw new Error(t("pactPendingUseCancel"));
        if (!sameHash(pact.party1, walletHash)) throw new Error(t("cancelNotCreator"));
        kind = "cancel";
        actionPhase.set("cancelling");
        actionNotice.set(t("contractCancelling", { id: pactId }));
      } else {
        if (expected !== "break") throw new Error(t("pactNotPending"));
        if (pact.status !== STATUS_ACTIVE) throw new Error(t("pactNotActive"));
        if (!isParty) throw new Error(t("breakNotParty"));
        if (Date.now() >= pact.endTime) throw new Error(t("pactExpiredSettle"));
        kind = "break";
        actionPhase.set("breaking");
        actionNotice.set(t("contractBreaking", { id: pactId }));
      }

      const beneficiaryHash = sameHash(pact.party1, walletHash) ? pact.party2 : pact.party1;
      await invokeTracked(
        context,
        {
          kind,
          walletHash,
          pactId,
          party1Hash: pact.party1,
          party2Hash: pact.party2,
          stakeRaw: pact.stake.toString(),
          ...(kind === "break" ? { beneficiaryHash } : {}),
        },
        "breakPact",
        [app.chain.arg.integer(pactId), app.chain.arg.hash160(walletHash)],
      );
      actionNotice.set(t(kind === "cancel" ? "contractCancelled" : "contractBroken"));
      await loadContracts();
    } catch (error) {
      actionNotice.set(app.errors.messageOf(error));
      throw error;
    } finally {
      isLoading.set(false);
      actionPhase.set("idle");
    }
  };

  const settleContract = async (contract: { id?: number; pactId?: string }) => {
    assertIdle();
    const pactId = resolvePactId(contract);
    actionNotice.set(t("contractSettling", { id: pactId }));
    isLoading.set(true);
    actionPhase.set("preparing");
    try {
      const { walletHash, context } = await requireWallet();
      const pact = await readDecodedPact(pactId);
      if (pact.status !== STATUS_ACTIVE) throw new Error(t("pactNotActive"));
      if (Date.now() < pact.endTime) throw new Error(t("pactNotExpired"));
      actionPhase.set("settling");
      await invokeTracked(
        context,
        {
          kind: "settle",
          walletHash,
          pactId,
          party1Hash: pact.party1,
          party2Hash: pact.party2,
          stakeRaw: pact.stake.toString(),
        },
        "settlePact",
        [app.chain.arg.integer(pactId)],
      );
      actionNotice.set(t("contractSettled"));
      await loadContracts();
    } catch (error) {
      actionNotice.set(app.errors.messageOf(error));
      throw error;
    } finally {
      isLoading.set(false);
      actionPhase.set("idle");
    }
  };

  const withdrawCredit = async () => {
    assertIdle();
    actionNotice.set(t("creditRecovering"));
    isLoading.set(true);
    actionPhase.set("preparing");
    try {
      const { walletHash, context } = await requireWallet();
      let before: bigint;
      try { before = await readCredit(walletHash); }
      catch { throw new Error(t("creditReadRequired")); }
      if (before <= 0n) throw new Error(t("noCreditToRecover"));
      actionPhase.set("withdrawing");
      await invokeTracked(
        context,
        { kind: "withdraw", walletHash, beforeCreditRaw: before.toString() },
        "withdraw",
        [app.chain.arg.hash160(walletHash)],
      );
      applyCredit(0n);
      actionNotice.set(t("creditRecovered", { amount: String(parseGas(before)) }));
      await loadContracts();
    } catch (error) {
      actionNotice.set(app.errors.messageOf(error));
      throw error;
    } finally {
      isLoading.set(false);
      actionPhase.set("idle");
    }
  };

  return {
    address,
    setWalletAddress,
    partnerAddress,
    stakeAmount,
    duration,
    contractTitle,
    contractTerms,
    contracts,
    isLoading,
    actionPhase,
    hasPendingAction,
    serviceNotice,
    actionNotice,
    validationNotice,
    pendingNotice,
    lastSubmittedTitle,
    creditBalance,
    creditBalanceRaw,
    creditKnown,
    contractCount,
    activeCount,
    pendingCount,
    brokenCount,
    contractsStatus,
    contractCountDisplay,
    activeCountDisplay,
    pendingCountDisplay,
    brokenCountDisplay,
    hasCredit,
    loadContracts,
    loadCredit,
    withdrawCredit,
    createContract,
    signContract,
    breakContract,
    settleContract,
  };
}

export type UseBreakupReturn = ReturnType<typeof useBreakup>;
