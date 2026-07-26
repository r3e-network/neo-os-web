import type { MiniAppFramework } from "@shared/react";
import { createDerived, createObservable } from "@shared/react/context";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StreamItem, StreamStatus } from "@shared/composables/neo-pay";
import {
  NEO_PAY_EVENT_WAIT_MS,
  isExactNeoPayTxid,
  isPendingNeoPayOperation,
  neoPayAccountMatches,
  normalizeNeoPayAccount,
  readNeoPayTransactionOutcome,
  requireCanonicalNeoPayContext,
  type NeoPayChainContext,
  type NeoPayNetwork,
  type NeoPayPendingKind,
  type PendingNeoPayOperation,
} from "./neo-pay-safety";

export type NeoPayAsset = "GAS" | "NEO";
export type NeoPayListSource = "none" | "loading" | "chain" | "partial" | "failed";
export type NeoPayActionStatus = "confirmed" | "pending" | "fault";
export type NeoPayActiveAction = "" | "create" | `claim:${string}` | `cancel:${string}` | "recover" | "storage";

export interface NeoPayActionOutcome {
  status: NeoPayActionStatus;
  stream?: StreamItem;
}

export interface ExactNeoPaySchedule {
  asset: NeoPayAsset;
  totalBase: bigint;
  rateBase: bigint;
  intervalDays: number;
  intervalSeconds: bigint;
  durationDays: number;
  kind: "linear" | "cliff";
  rateDisplay: string;
}

interface CreateStreamInput {
  recipient: string;
  amount: string;
  durationDays: string;
  asset: NeoPayAsset;
  notes: string;
}

interface RoleRead {
  items: StreamItem[];
  partial: boolean;
}

const GAS_FACTOR = 100_000_000n;
const SECONDS_PER_DAY = 86_400n;
const LIST_PAGE_SIZE = 100;
const LIST_MAX_IDS = 500;
const DETAIL_READ_BATCH = 20;
const PAYMENT_MEMO = "miniapp-neo-pay:fund";
const LEGACY_PENDING_KEY = "pending-create";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function exactUnsigned(value: unknown, label: string): bigint {
  if (typeof value === "bigint") {
    if (value >= 0n) return value;
    throw new Error(`Malformed ${label}.`);
  }
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value >= 0) return BigInt(value);
    throw new Error(`Malformed ${label}.`);
  }
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) throw new Error(`Malformed ${label}.`);
  return BigInt(raw);
}

function exactPositive(value: unknown, label: string): bigint {
  const parsed = exactUnsigned(value, label);
  if (parsed <= 0n) throw new Error(`Malformed ${label}.`);
  return parsed;
}

function exactBoolean(value: unknown, label: string): boolean {
  // app.chain.readRaw returns parseInvokeResult output, so a Neo VM Boolean
  // must already be a native boolean here. Reject String/Integer lookalikes
  // instead of accepting a value produced by the wrong contract ABI.
  if (typeof value === "boolean") return value;
  throw new Error(`Malformed ${label}.`);
}

function positiveId(value: unknown, label = "stream id"): string {
  const parsed = exactPositive(value, label);
  return parsed.toString();
}

function strictStatus(value: unknown): StreamStatus {
  const normalized = clean(value).toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  throw new Error("Malformed stream status.");
}

function canonicalAssetHash(asset: NeoPayAsset): string {
  return asset === "NEO" ? NEO_HASH : GAS_HASH;
}

function strictAsset(value: unknown): { asset: string; assetSymbol: NeoPayAsset } {
  if (neoPayAccountMatches(value, NEO_HASH)) return { asset: NEO_HASH, assetSymbol: "NEO" };
  if (neoPayAccountMatches(value, GAS_HASH)) return { asset: GAS_HASH, assetSymbol: "GAS" };
  throw new Error("Malformed stream asset.");
}

function strictText(value: unknown, max: number, label: string): string {
  const text = clean(value);
  if (text.length > max) throw new Error(`Malformed ${label}.`);
  return text;
}

export function parseAssetToBaseUnits(asset: NeoPayAsset, value: string): bigint | null {
  const raw = clean(value);
  if (asset === "NEO") return /^[1-9]\d*$/.test(raw) ? BigInt(raw) : null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(raw)) return null;
  const [whole = "0", fraction = ""] = raw.split(".");
  const result = BigInt(whole) * GAS_FACTOR + BigInt(fraction.padEnd(8, "0") || "0");
  return result > 0n ? result : null;
}

function parseNonNegativeAssetUnits(asset: NeoPayAsset, value: string): bigint | null {
  const raw = clean(value);
  if (asset === "NEO") return /^\d+$/.test(raw) ? BigInt(raw) : null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(raw)) return null;
  const [whole = "0", fraction = ""] = raw.split(".");
  return BigInt(whole) * GAS_FACTOR + BigInt(fraction.padEnd(8, "0") || "0");
}

export function formatAssetBaseUnits(asset: NeoPayAsset, value: bigint): string {
  if (asset === "NEO") return value.toString();
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / GAS_FACTOR;
  const fraction = (absolute % GAS_FACTOR).toString().padStart(8, "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Exact amount stepper used by the visual payment console (never Number-based). */
export function nudgeNeoPayAmount(value: string, asset: NeoPayAsset, direction: 1 | -1): string {
  const current = parseNonNegativeAssetUnits(asset, value) ?? 0n;
  const step = asset === "NEO" ? 1n : 5n * GAS_FACTOR;
  const next = direction > 0 ? current + step : current > step ? current - step : 0n;
  return formatAssetBaseUnits(asset, next);
}

export function deriveExactNeoPaySchedule(
  amount: string,
  duration: string,
  asset: NeoPayAsset,
): ExactNeoPaySchedule | null {
  const totalBase = parseAssetToBaseUnits(asset, amount);
  if (totalBase === null || !/^[1-9]\d*$/.test(clean(duration))) return null;
  const durationDays = Number(duration);
  if (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 365) return null;
  const days = BigInt(durationDays);
  if (asset === "NEO" && totalBase < days) {
    return {
      asset,
      totalBase,
      rateBase: totalBase,
      intervalDays: durationDays,
      intervalSeconds: days * SECONDS_PER_DAY,
      durationDays,
      kind: "cliff",
      rateDisplay: totalBase.toString(),
    };
  }
  const rateBase = (totalBase + days - 1n) / days;
  return {
    asset,
    totalBase,
    rateBase,
    intervalDays: 1,
    intervalSeconds: SECONDS_PER_DAY,
    durationDays,
    kind: "linear",
    rateDisplay: formatAssetBaseUnits(asset, rateBase),
  };
}

export function parseNeoPayStream(raw: unknown, requestedId: string): StreamItem {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Malformed stream response.");
  const record = raw as Record<string, unknown>;
  const id = positiveId(record.id ?? requestedId);
  if (id !== positiveId(requestedId)) throw new Error("Stream id readback mismatch.");
  const creator = clean(record.creator);
  const beneficiary = clean(record.beneficiary);
  if (!normalizeNeoPayAccount(creator)) throw new Error("Malformed stream creator.");
  if (!normalizeNeoPayAccount(beneficiary)) throw new Error("Malformed stream beneficiary.");
  const { asset, assetSymbol } = strictAsset(record.asset);
  const totalAmount = exactPositive(record.totalAmount, "stream total");
  const releasedAmount = exactUnsigned(record.releasedAmount ?? record.claimedAmount, "released amount");
  const remainingAmount = exactUnsigned(record.remainingAmount, "remaining amount");
  const rateAmount = exactPositive(record.rateAmount, "release rate");
  const intervalSeconds = exactPositive(record.intervalSeconds, "release interval");
  const claimable = exactUnsigned(record.claimable, "claimable amount");
  const status = strictStatus(record.status);
  const liveAccountingMismatch = status !== "cancelled" && releasedAmount + remainingAmount !== totalAmount;
  const cancelledAccountingMismatch = status === "cancelled" && (remainingAmount !== 0n || claimable !== 0n);
  if (
    releasedAmount > totalAmount || remainingAmount > totalAmount || claimable > remainingAmount ||
    rateAmount > totalAmount || liveAccountingMismatch || cancelledAccountingMismatch
  ) {
    throw new Error("Malformed stream accounting.");
  }
  const intervalDaysRaw = (intervalSeconds + SECONDS_PER_DAY - 1n) / SECONDS_PER_DAY;
  if (intervalDaysRaw > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Malformed release interval.");
  return {
    id,
    creator,
    beneficiary,
    asset,
    assetSymbol,
    totalAmount,
    releasedAmount,
    remainingAmount,
    rateAmount,
    intervalSeconds,
    intervalDays: Number(intervalDaysRaw),
    status,
    claimable,
    title: strictText(record.title, 60, "stream title"),
    notes: strictText(record.notes, 240, "stream notes"),
  };
}

function sortNewest(items: StreamItem[]): StreamItem[] {
  return [...items].sort((left, right) => left.id === right.id ? 0 : BigInt(left.id) > BigInt(right.id) ? -1 : 1);
}

function eventBigInt(app: MiniAppFramework, event: unknown, index: number, label: string): bigint {
  return exactUnsigned(app.events.value(event, index), label);
}

function eventPositiveId(app: MiniAppFramework, event: unknown, index = 0): string {
  return positiveId(app.events.value(event, index), "event stream id");
}

function sameContext(pending: PendingNeoPayOperation, context: NeoPayChainContext, actorHash: string): boolean {
  return pending.network === context.network &&
    neoPayAccountMatches(pending.contractHash, context.contractHash) &&
    neoPayAccountMatches(pending.actorHash, actorHash);
}

export function useNeoPayProduction({
  app,
  t,
}: {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const sharedVesting = app.platformVesting;
  const sharedVestingEnabled = sharedVesting.available;
  const isLoading = createObservable(false);
  const isRefreshing = createObservable(false);
  const isCreating = createObservable(false);
  const isRecovering = createObservable(false);
  const claimingId = createObservable<string | null>(null);
  const cancellingId = createObservable<string | null>(null);
  const createdStreams = createObservable<StreamItem[]>([]);
  const beneficiaryStreams = createObservable<StreamItem[]>([]);
  const serviceNotice = createObservable("");
  const listSource = createObservable<NeoPayListSource>("none");
  const activeAction = createObservable<NeoPayActiveAction>("");
  const recoveryStorageHealthy = createObservable(true);
  const pendingOperation = app.state.persisted<PendingNeoPayOperation | null>("neo-pay/pending-operation", null);
  const pendingStorageKey = "state/neo-pay/pending-operation";
  const pendingStorageProbeKey = "state/neo-pay/pending-operation-probe";
  let storageProbeSequence = 0;
  let operationInFlight: { key: NeoPayActiveAction; dedupeKey: string; promise: Promise<unknown> } | null = null;
  let refreshGeneration = 0;
  let refreshQueued = false;
  let loadQueued = false;
  let disposed = false;

  const allStreams = createDerived(() => {
    const seen = new Set<string>();
    return [...createdStreams.get(), ...beneficiaryStreams.get()].filter((stream) => {
      if (seen.has(stream.id)) return false;
      seen.add(stream.id);
      return true;
    });
  }, [createdStreams, beneficiaryStreams]);
  const activeCount = createDerived(
    () => allStreams.get().filter((stream) => stream.status === "active").length,
    [allStreams],
  );
  const createdStreamCount = createDerived(() => createdStreams.get().length, [createdStreams]);
  const beneficiaryStreamCount = createDerived(() => beneficiaryStreams.get().length, [beneficiaryStreams]);
  const totalStreamCount = createDerived(() => allStreams.get().length, [allStreams]);
  const pendingTxid = createDerived(() => pendingOperation.get()?.txid ?? "", [pendingOperation]);
  const operationBusy = createDerived(() => Boolean(activeAction.get()), [activeAction]);

  const pendingRecordsMatch = (left: unknown, right: PendingNeoPayOperation | null): boolean => {
    if (right === null) return left === null;
    return isPendingNeoPayOperation(left) && JSON.stringify(left) === JSON.stringify(right);
  };

  const storageWritable = (): boolean => {
    const marker = `${Date.now()}:${++storageProbeSequence}`;
    try {
      app.storage.local.set(pendingStorageProbeKey, marker);
      const written = app.storage.local.get<string>(pendingStorageProbeKey, "") === marker;
      app.storage.local.delete(pendingStorageProbeKey);
      const removedMarker = `missing:${marker}`;
      const removed = app.storage.local.get<string>(pendingStorageProbeKey, removedMarker) === removedMarker;
      recoveryStorageHealthy.set(written && removed);
      return written && removed;
    } catch {
      recoveryStorageHealthy.set(false);
      return false;
    }
  };

  const writePending = (record: PendingNeoPayOperation): boolean => {
    try {
      pendingOperation.set(record);
    } catch {
      // createObservable updates its in-memory value before a persistence
      // listener can fail. Keep that exact broadcast guard for this session.
    }
    let durable = false;
    try {
      app.storage.local.set(pendingStorageKey, record);
      durable = storageWritable() && pendingRecordsMatch(
        app.storage.local.get<unknown>(pendingStorageKey, null),
        record,
      );
    } catch {
      durable = false;
    }
    recoveryStorageHealthy.set(durable);
    return durable;
  };

  const clearPending = (): void => {
    const existing = pendingOperation.get();
    const missing = `missing:${Date.now()}:${++storageProbeSequence}`;
    try {
      pendingOperation.set(null);
      app.storage.local.delete(pendingStorageKey);
      app.storage.local.delete(LEGACY_PENDING_KEY);
      if (app.storage.local.get<unknown>(pendingStorageKey, missing) !== missing) {
        throw new Error("pending journal deletion was not durable");
      }
      if (app.storage.local.get<unknown>(LEGACY_PENDING_KEY, missing) !== missing) {
        throw new Error("legacy pending journal deletion was not durable");
      }
      recoveryStorageHealthy.set(true);
      serviceNotice.set("");
    } catch {
      if (existing && pendingOperation.get() !== existing) {
        try { pendingOperation.set(existing); } catch { /* keep the current in-memory guard */ }
      }
      recoveryStorageHealthy.set(false);
      serviceNotice.set(t("neoPayRecoveryStorageUnavailable"));
      throw new Error(t("neoPayRecoveryStorageUnavailable"));
    }
  };

  const assertRecoveryStorageAvailable = (): void => {
    if (!storageWritable()) throw new Error(t("neoPayRecoveryStorageUnavailable"));
  };

  const initialPending = pendingOperation.get();
  if (initialPending && !isPendingNeoPayOperation(initialPending)) {
    try {
      clearPending();
    } catch {
      serviceNotice.set(t("neoPayPendingInvalidStorageBlocked"));
    }
  } else {
    let initialStorageHealthy = storageWritable();
    if (initialStorageHealthy && initialPending) {
      try {
        initialStorageHealthy = pendingRecordsMatch(
          app.storage.local.get<unknown>(pendingStorageKey, null),
          initialPending,
        );
      } catch {
        initialStorageHealthy = false;
      }
    }
    if (!initialStorageHealthy) {
      recoveryStorageHealthy.set(false);
      if (initialPending) serviceNotice.set(t("neoPayRecoveryStorageUnavailable"));
    }
  }

  const readStream = async (id: string, context?: NeoPayChainContext): Promise<StreamItem> => {
    if (!context && sharedVestingEnabled) {
      return parseNeoPayStream(await sharedVesting.getStreamDetails(id), id);
    }
    if (!context) throw new Error(t("neoPayCriticalDataUnavailable"));
    const raw = await app.chain.readRaw("getStreamDetails", [app.chain.arg.integer(positiveId(id))], {
      scriptHash: context.contractHash,
    });
    return parseNeoPayStream(raw, id);
  };

  const readRole = async (
    operation: "getUserStreams" | "getBeneficiaryStreams",
    actorHash: string,
    context?: NeoPayChainContext,
  ): Promise<RoleRead> => {
    const ids: string[] = [];
    const seen = new Set<string>();
    let truncated = false;
    for (let offset = 0; offset < LIST_MAX_IDS; offset += LIST_PAGE_SIZE) {
      const raw = sharedVestingEnabled && !context
        ? operation === "getUserStreams"
          ? await sharedVesting.getUserStreams(actorHash, offset, LIST_PAGE_SIZE)
          : await sharedVesting.getBeneficiaryStreams(actorHash, offset, LIST_PAGE_SIZE)
        : await app.chain.readArray(operation, [
          app.chain.arg.hash160(actorHash),
          app.chain.arg.integer(offset),
          app.chain.arg.integer(LIST_PAGE_SIZE),
        ], { scriptHash: context?.contractHash });
      if (!Array.isArray(raw) || raw.length > LIST_PAGE_SIZE) {
        throw new Error("Malformed stream list response.");
      }
      const page = raw.map((value) => positiveId(value));
      for (const id of page) {
        if (seen.has(id)) throw new Error("Malformed duplicate stream ids.");
        seen.add(id);
        ids.push(id);
      }
      if (raw.length < LIST_PAGE_SIZE) break;
      if (ids.length >= LIST_MAX_IDS) {
        const next = sharedVestingEnabled && !context
          ? operation === "getUserStreams"
            ? await sharedVesting.getUserStreams(actorHash, ids.length, 1)
            : await sharedVesting.getBeneficiaryStreams(actorHash, ids.length, 1)
          : await app.chain.readArray(operation, [
            app.chain.arg.hash160(actorHash),
            app.chain.arg.integer(ids.length),
            app.chain.arg.integer(1),
          ], { scriptHash: context?.contractHash });
        if (!Array.isArray(next) || next.length > 1) throw new Error("Malformed stream list response.");
        truncated = next.length > 0;
      }
    }
    const items: StreamItem[] = [];
    for (let offset = 0; offset < ids.length; offset += DETAIL_READ_BATCH) {
      const settled = await Promise.allSettled(
        ids.slice(offset, offset + DETAIL_READ_BATCH).map((id) => readStream(id, context)),
      );
      items.push(...settled.flatMap((entry) => entry.status === "fulfilled" ? [entry.value] : []));
    }
    return { items: sortNewest(items), partial: truncated || items.length !== ids.length };
  };

  const refreshStreams = async (): Promise<void> => {
    if (disposed) return;
    if (isRefreshing.get()) {
      refreshQueued = true;
      return;
    }
    refreshQueued = false;
    const generation = ++refreshGeneration;
    const wallet = app.chain.address.get() ?? "";
    const actorHash = normalizeNeoPayAccount(wallet);
    if (!actorHash) {
      createdStreams.set([]);
      beneficiaryStreams.set([]);
      listSource.set("none");
      if (!pendingOperation.get()) serviceNotice.set("");
      return;
    }
    isRefreshing.set(true);
    listSource.set("loading");
    try {
      const context = sharedVestingEnabled
        ? undefined
        : await requireCanonicalNeoPayContext(app, t("neoPayChainContextMismatch"));
      const [created, incoming] = await Promise.all([
        readRole("getUserStreams", actorHash, context),
        readRole("getBeneficiaryStreams", actorHash, context),
      ]);
      const latest = sharedVestingEnabled
        ? undefined
        : await requireCanonicalNeoPayContext(app, t("neoPayChainContextMismatch"));
      if (
        disposed || generation !== refreshGeneration ||
        !neoPayAccountMatches(app.chain.address.get(), actorHash) ||
        (!sharedVestingEnabled && (
          !context || !latest || latest.network !== context.network ||
          !neoPayAccountMatches(latest.contractHash, context.contractHash)
        ))
      ) {
        refreshQueued = !disposed;
        return;
      }
      createdStreams.set(created.items);
      beneficiaryStreams.set(incoming.items.filter((stream) => !neoPayAccountMatches(stream.creator, actorHash)));
      const partial = created.partial || incoming.partial;
      listSource.set(partial ? "partial" : "chain");
      serviceNotice.set(
        pendingOperation.get()
          ? t("neoPayTransactionPending")
          : partial ? t("neoPayDataPartial") : "",
      );
    } catch {
      if (
        disposed || generation !== refreshGeneration ||
        !neoPayAccountMatches(app.chain.address.get(), actorHash)
      ) {
        refreshQueued = !disposed;
        return;
      }
      createdStreams.set([]);
      beneficiaryStreams.set([]);
      listSource.set("failed");
      serviceNotice.set(t("neoPayDataUnavailable"));
    } finally {
      isRefreshing.set(false);
      if (refreshQueued && !disposed) {
        refreshQueued = false;
        void refreshStreams();
      }
    }
  };

  const walletSnapshot = async (): Promise<{ wallet: string; actorHash: string; context: NeoPayChainContext }> => {
    const wallet = app.chain.address.get() || await app.chain.ensureWallet();
    const actorHash = normalizeNeoPayAccount(wallet);
    if (!wallet || !actorHash) throw new Error(t("walletNotConnected"));
    const context = await requireCanonicalNeoPayContext(
      app,
      t("neoPayChainContextMismatch"),
      {
        requireDetectedNetwork: true,
        networkUnavailableMessage: t("neoPayNetworkUnverified"),
      },
    );
    const connected = app.chain.address.get();
    if (connected && !neoPayAccountMatches(connected, actorHash)) {
      throw new Error(t("neoPayWriteContextChanged"));
    }
    return { wallet, actorHash, context };
  };

  const sharedWalletSnapshot = async (): Promise<{
    wallet: string;
    actorHash: string;
    network: NeoPayNetwork;
    contractHash: string;
  }> => {
    const wallet = app.chain.address.get() || await app.chain.ensureWallet();
    const actorHash = normalizeNeoPayAccount(wallet);
    const detected = clean(await app.chain.detectNetwork?.());
    const launchNetwork = clean(app.platform.launch.network);
    const classifyNetwork = (value: string): NeoPayNetwork | "" =>
      value.toLowerCase().includes("mainnet")
        ? "mainnet"
        : value.toLowerCase().includes("testnet")
          ? "testnet"
          : "";
    const detectedKind = classifyNetwork(detected);
    const launchKind = classifyNetwork(launchNetwork);
    if (detectedKind && launchKind && detectedKind !== launchKind) {
      throw new Error(t("neoPayChainContextMismatch"));
    }
    const network = detectedKind || launchKind;
    if (!network) throw new Error(t("neoPayNetworkUnverified"));
    const contractHash = sharedVesting.configuredHash;
    if (!wallet || !actorHash || !contractHash) throw new Error(t("neoPayChainContextMismatch"));
    const connected = app.chain.address.get();
    if (connected && !neoPayAccountMatches(connected, actorHash)) {
      throw new Error(t("neoPayWriteContextChanged"));
    }
    return { wallet, actorHash, network, contractHash };
  };

  const assertWriteSnapshot = async (actorHash: string, expected: NeoPayChainContext): Promise<void> => {
    if (!neoPayAccountMatches(app.chain.address.get(), actorHash)) {
      throw new Error(t("neoPayWriteContextChanged"));
    }
    const current = await requireCanonicalNeoPayContext(
      app,
      t("neoPayChainContextMismatch"),
      {
        requireDetectedNetwork: true,
        networkUnavailableMessage: t("neoPayNetworkUnverified"),
      },
    );
    if (
      current.network !== expected.network ||
      !neoPayAccountMatches(current.contractHash, expected.contractHash)
    ) throw new Error(t("neoPayWriteContextChanged"));
  };

  const assertContractWritable = async (context: NeoPayChainContext): Promise<void> => {
    try {
      const paused = exactBoolean(
        await app.chain.readRaw("isPaused", [], { scriptHash: context.contractHash }),
        "pause state",
      );
      if (paused) throw new Error(t("neoPayContractPaused"));
    } catch (error) {
      if (error instanceof Error && error.message === t("neoPayContractPaused")) throw error;
      throw new Error(t("neoPayCriticalDataUnavailable"));
    }
  };

  const assertNoPending = (): void => {
    if (!recoveryStorageHealthy.get()) throw new Error(t("neoPayRecoveryStorageUnavailable"));
    const pending = pendingOperation.get();
    if (pending) throw new Error(t("neoPayPendingBlocksWrites"));
  };

  const runExclusive = <T>(
    key: NeoPayActiveAction,
    task: () => Promise<T>,
    dedupeKey: string = key,
  ): Promise<T> => {
    if (operationInFlight) {
      if (operationInFlight.key === key && operationInFlight.dedupeKey === dedupeKey) {
        return operationInFlight.promise as Promise<T>;
      }
      return Promise.reject(new Error(t("neoPayOperationBusy")));
    }
    activeAction.set(key);
    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        if (operationInFlight?.promise === promise) operationInFlight = null;
        activeAction.set("");
      });
    operationInFlight = { key, dedupeKey, promise };
    return promise;
  };

  const persist = (draft: Omit<PendingNeoPayOperation, "txid">, txid: string): PendingNeoPayOperation | null => {
    const normalized = clean(txid);
    if (!isExactNeoPayTxid(normalized)) return null;
    const record: PendingNeoPayOperation = { ...draft, txid: normalized };
    const durable = writePending(record);
    serviceNotice.set(durable ? t("neoPayTransactionPending") : t("neoPayRecoveryStorageUnavailable"));
    return record;
  };

  const refreshRecoveryStorage = (): Promise<void> => runExclusive("storage", async () => {
    const current = pendingOperation.get();
    if (current && !isPendingNeoPayOperation(current)) {
      clearPending();
      throw new Error(t("neoPayPendingInvalid"));
    }
    assertRecoveryStorageAvailable();
    if (current && !writePending(current)) throw new Error(t("neoPayRecoveryStorageUnavailable"));
    recoveryStorageHealthy.set(true);
    serviceNotice.set(current ? t("neoPayTransactionPending") : "");
  });

  const finalize = async (pending: PendingNeoPayOperation, event: unknown): Promise<StreamItem> => {
    if (!isPendingNeoPayOperation(pending)) throw new Error(t("neoPayPendingInvalid"));
    const id = eventPositiveId(app, event);
    if (pending.kind === "create" || pending.kind === "legacy-create") {
      if (!neoPayAccountMatches(app.events.value(event, 1), pending.actorHash)) {
        throw new Error(t("neoPayEventMismatch"));
      }
      if (pending.kind === "create") {
        if (
          !neoPayAccountMatches(app.events.value(event, 2), pending.beneficiaryHash) ||
          !neoPayAccountMatches(app.events.value(event, 3), pending.assetHash) ||
          eventBigInt(app, event, 4, "created total") !== BigInt(pending.totalBase ?? "0")
        ) throw new Error(t("neoPayEventMismatch"));
      }
      const stream = await readStream(id, { network: pending.network, contractHash: pending.contractHash });
      if (!neoPayAccountMatches(stream.creator, pending.actorHash)) throw new Error(t("neoPayReadbackMismatch"));
      if (pending.kind === "create" && (
        !neoPayAccountMatches(stream.beneficiary, pending.beneficiaryHash) ||
        !neoPayAccountMatches(stream.asset, pending.assetHash) ||
        stream.totalAmount !== BigInt(pending.totalBase ?? "0") ||
        stream.rateAmount !== BigInt(pending.rateBase ?? "0") ||
        stream.intervalSeconds !== BigInt(pending.intervalSeconds ?? "0") ||
        stream.title !== clean(pending.title) || stream.notes !== clean(pending.notes)
      )) throw new Error(t("neoPayReadbackMismatch"));
      clearPending();
      return stream;
    }

    if (id !== pending.streamId) throw new Error(t("neoPayEventMismatch"));
    const stream = await readStream(id, { network: pending.network, contractHash: pending.contractHash });
    if (pending.kind === "claim") {
      const amount = eventBigInt(app, event, 2, "claim amount");
      const totalReleased = eventBigInt(app, event, 3, "released total");
      const before = BigInt(pending.beforeReleased ?? "0");
      if (
        !neoPayAccountMatches(app.events.value(event, 1), pending.actorHash) ||
        amount <= 0n || totalReleased < before + amount ||
        !neoPayAccountMatches(stream.beneficiary, pending.actorHash) ||
        stream.releasedAmount < totalReleased
      ) throw new Error(t("neoPayReadbackMismatch"));
    } else {
      eventBigInt(app, event, 2, "refund amount");
      eventBigInt(app, event, 3, "unlocked amount");
      if (
        !neoPayAccountMatches(app.events.value(event, 1), pending.actorHash) ||
        !neoPayAccountMatches(stream.creator, pending.actorHash) ||
        stream.status !== "cancelled" || stream.remainingAmount !== 0n
      ) throw new Error(t("neoPayReadbackMismatch"));
    }
    clearPending();
    return stream;
  };

  const readSharedPendingStream = async (pending: PendingNeoPayOperation): Promise<StreamItem | null> => {
    if (pending.kind === "create") {
      const role = await readRole("getUserStreams", pending.actorHash);
      return role.items.find((stream) =>
        neoPayAccountMatches(stream.creator, pending.actorHash) &&
        neoPayAccountMatches(stream.beneficiary, pending.beneficiaryHash) &&
        neoPayAccountMatches(stream.asset, pending.assetHash) &&
        stream.totalAmount === BigInt(pending.totalBase ?? "0") &&
        stream.rateAmount === BigInt(pending.rateBase ?? "0") &&
        stream.intervalSeconds === BigInt(pending.intervalSeconds ?? "0") &&
        stream.title === clean(pending.title) &&
        stream.notes === clean(pending.notes),
      ) ?? null;
    }
    if (!pending.streamId) return null;
    return readStream(positiveId(pending.streamId));
  };

  const settleSharedPending = async (pending: PendingNeoPayOperation): Promise<NeoPayActionOutcome> => {
    if (!sharedVestingEnabled || pending.engine !== "platform-vesting") {
      throw new Error(t("neoPayPendingContextMismatch"));
    }
    try {
      const stream = await readSharedPendingStream(pending);
      if (!stream) {
        serviceNotice.set(t("neoPayTransactionPending"));
        return { status: "pending" };
      }
      let confirmed = false;
      if (pending.kind === "create") {
        confirmed = neoPayAccountMatches(stream.creator, pending.actorHash);
      } else if (pending.kind === "claim") {
        const before = BigInt(pending.beforeReleased ?? "0");
        confirmed = neoPayAccountMatches(stream.beneficiary, pending.actorHash) &&
          (stream.releasedAmount > before || stream.status === "completed");
      } else if (pending.kind === "cancel") {
        confirmed = neoPayAccountMatches(stream.creator, pending.actorHash) &&
          stream.status === "cancelled" && stream.remainingAmount === 0n;
      }
      if (!confirmed) {
        serviceNotice.set(t("neoPayTransactionPending"));
        return { status: "pending" };
      }
      clearPending();
      await refreshStreams();
      return { status: "confirmed", stream };
    } catch {
      serviceNotice.set(
        recoveryStorageHealthy.get()
          ? t("neoPayConfirmationNeedsReview")
          : t("neoPayRecoveryStorageUnavailable"),
      );
      return { status: "pending" };
    }
  };

  const settle = async (pending: PendingNeoPayOperation, candidate?: unknown): Promise<NeoPayActionOutcome> => {
    if (candidate) {
      try {
        const stream = await finalize(pending, candidate);
        await refreshStreams();
        return { status: "confirmed", stream };
      } catch {
        serviceNotice.set(
          recoveryStorageHealthy.get()
            ? t("neoPayConfirmationNeedsReview")
            : t("neoPayRecoveryStorageUnavailable"),
        );
        return { status: "pending" };
      }
    }
    const outcome = await readNeoPayTransactionOutcome(
      pending.network,
      pending.txid,
      pending.eventName,
      pending.contractHash,
    );
    if (outcome.state === "fault") {
      clearPending();
      return { status: "fault" };
    }
    if (outcome.state === "halt" && outcome.event) return settle(pending, outcome.event);
    serviceNotice.set(t("neoPayTransactionPending"));
    return { status: "pending" };
  };

  const waitAndSettle = async (pending: PendingNeoPayOperation): Promise<NeoPayActionOutcome> => {
    const event = await app.events.waitFor(pending.txid, pending.eventName, NEO_PAY_EVENT_WAIT_MS);
    return settle(pending, event);
  };

  const createStream = (input: CreateStreamInput): Promise<NeoPayActionOutcome> => {
    const dedupeKey = JSON.stringify([
      clean(input.recipient),
      clean(input.amount),
      clean(input.durationDays),
      input.asset,
      clean(input.notes),
    ]);
    return runExclusive("create", async () => {
    assertNoPending();
    const beneficiaryHash = normalizeNeoPayAccount(input.recipient);
    const schedule = deriveExactNeoPaySchedule(input.amount, input.durationDays, input.asset);
    const notes = clean(input.notes);
    if (!beneficiaryHash) throw new Error(t("invalidAddress"));
    if (!schedule) throw new Error(t("invalidAmount"));
    if (notes.length > 240) throw new Error(t("neoPayNotesTooLong"));
    assertRecoveryStorageAvailable();
    isCreating.set(true);
    let tracked: PendingNeoPayOperation | null = null;
    try {
      if (sharedVestingEnabled) {
        const { wallet, actorHash, network, contractHash } = await sharedWalletSnapshot();
        const assetHash = canonicalAssetHash(input.asset);
        const title = `Stream to ${clean(input.recipient).slice(0, 8)}…`.slice(0, 60);
        const draft: Omit<PendingNeoPayOperation, "txid"> = {
          version: 1,
          engine: "platform-vesting",
          kind: "create",
          eventName: "StreamCreated",
          network,
          contractHash,
          actorHash,
          createdAt: Date.now(),
          beneficiaryHash,
          assetHash,
          totalBase: schedule.totalBase.toString(),
          rateBase: schedule.rateBase.toString(),
          intervalSeconds: schedule.intervalSeconds.toString(),
          title,
          notes,
        };
        const result = await sharedVesting.createStream({
          beneficiary: input.recipient,
          asset: input.asset,
          totalAmount: schedule.totalBase,
          rateAmount: schedule.rateBase,
          intervalSeconds: schedule.intervalSeconds,
          title,
          notes,
          creator: wallet,
          fundAmount: schedule.totalBase,
          options: { onTransactionSent: (txid) => { tracked = persist(draft, txid); } },
        });
        tracked ??= persist(draft, result.txid);
        if (!tracked || result.success === false) throw new Error(t("transactionFailed"));
        return await settleSharedPending(tracked);
      }
      const { wallet, actorHash, context } = await walletSnapshot();
      await assertContractWritable(context);
      await assertWriteSnapshot(actorHash, context);
      const assetHash = canonicalAssetHash(input.asset);
      const title = `Stream to ${clean(input.recipient).slice(0, 8)}…`.slice(0, 60);
      const draft: Omit<PendingNeoPayOperation, "txid"> = {
        version: 1,
        kind: "create",
        eventName: "StreamCreated",
        network: context.network,
        contractHash: context.contractHash,
        actorHash,
        createdAt: Date.now(),
        beneficiaryHash,
        assetHash,
        totalBase: schedule.totalBase.toString(),
        rateBase: schedule.rateBase.toString(),
        intervalSeconds: schedule.intervalSeconds.toString(),
        title,
        notes,
      };
      const result = await app.chain.invokeMultiple([
        {
          scriptHash: assetHash,
          operation: "transfer",
          args: [
            app.chain.arg.hash160(actorHash),
            app.chain.arg.hash160(context.contractHash),
            app.chain.arg.integer(schedule.totalBase),
            app.chain.arg.string(PAYMENT_MEMO),
          ],
        },
        {
          scriptHash: context.contractHash,
          operation: "createStream",
          args: [
            app.chain.arg.hash160(actorHash),
            app.chain.arg.hash160(beneficiaryHash),
            app.chain.arg.hash160(assetHash),
            app.chain.arg.integer(schedule.totalBase),
            app.chain.arg.integer(schedule.rateBase),
            app.chain.arg.integer(schedule.intervalSeconds),
            app.chain.arg.string(title),
            app.chain.arg.string(notes),
          ],
        },
      ], {
        signers: [{ account: wallet, scopes: 1 }],
        notify: "silent",
        onTransactionSent: (txid) => { tracked = persist(draft, txid); },
      });
      tracked ??= persist(draft, result.txid);
      if (!tracked || result.success === false) throw new Error(t("transactionFailed"));
      return await waitAndSettle(tracked);
    } catch (error) {
      const pending = tracked ?? pendingOperation.get();
      if (pending && isPendingNeoPayOperation(pending)) {
        return pending.engine === "platform-vesting"
          ? settleSharedPending(pending)
          : settle(pending);
      }
      throw error;
    } finally {
      isCreating.set(false);
    }
    }, dedupeKey);
  };

  const freshOwnedStream = async (
    id: string,
    role: "beneficiary" | "creator",
  ): Promise<{ stream: StreamItem; actorHash: string; context?: NeoPayChainContext }> => {
    if (sharedVestingEnabled) {
      const { actorHash } = await sharedWalletSnapshot();
      const stream = await readStream(positiveId(id));
      if (!neoPayAccountMatches(stream[role], actorHash)) throw new Error(t("neoPayNotAuthorized"));
      if (stream.status !== "active") throw new Error(t("neoPayStreamFinalized"));
      return { stream, actorHash };
    }
    const { actorHash, context } = await walletSnapshot();
    const stream = await readStream(positiveId(id), context);
    if (!neoPayAccountMatches(stream[role], actorHash)) throw new Error(t("neoPayNotAuthorized"));
    if (stream.status !== "active") throw new Error(t("neoPayStreamFinalized"));
    return { stream, actorHash, context };
  };

  const invokeSingle = async (
    kind: Extract<NeoPayPendingKind, "claim" | "cancel">,
    stream: StreamItem,
    actorHash: string,
    context: NeoPayChainContext | undefined,
  ): Promise<NeoPayActionOutcome> => {
    assertRecoveryStorageAvailable();
    const eventName = kind === "claim" ? "StreamClaimed" : "StreamCancelled";
    let tracked: PendingNeoPayOperation | null = null;
    if (sharedVestingEnabled) {
      const { network, contractHash } = await sharedWalletSnapshot();
      const draft: Omit<PendingNeoPayOperation, "txid"> = {
        version: 1,
        engine: "platform-vesting",
        kind,
        eventName,
        network,
        contractHash,
        actorHash,
        createdAt: Date.now(),
        streamId: stream.id,
        ...(kind === "claim" ? { beforeReleased: stream.releasedAmount.toString() } : {}),
      };
      try {
        const result = kind === "claim"
          ? await sharedVesting.claimStream(stream.id, actorHash, {
            waitForEvent: eventName,
            waitTimeoutMs: NEO_PAY_EVENT_WAIT_MS,
            onTransactionSent: (txid) => { tracked = persist(draft, txid); },
          })
          : await sharedVesting.cancelStream(stream.id, actorHash, {
            waitForEvent: eventName,
            waitTimeoutMs: NEO_PAY_EVENT_WAIT_MS,
            onTransactionSent: (txid) => { tracked = persist(draft, txid); },
          });
        tracked ??= persist(draft, result.txid);
        if (!tracked || result.success === false) throw new Error(t("transactionFailed"));
        return await settleSharedPending(tracked);
      } catch (error) {
        const pending = tracked ?? pendingOperation.get();
        if (pending && isPendingNeoPayOperation(pending)) return settleSharedPending(pending);
        throw error;
      }
    }
    if (!context) throw new Error(t("neoPayCriticalDataUnavailable"));
    await assertContractWritable(context);
    await assertWriteSnapshot(actorHash, context);
    const draft: Omit<PendingNeoPayOperation, "txid"> = {
      version: 1,
      kind,
      eventName,
      network: context.network,
      contractHash: context.contractHash,
      actorHash,
      createdAt: Date.now(),
      streamId: stream.id,
      ...(kind === "claim" ? { beforeReleased: stream.releasedAmount.toString() } : {}),
    };
    try {
      const result = await app.chain.invoke(
        kind === "claim" ? "claimStream" : "cancelStream",
        [app.chain.arg.hash160(actorHash), app.chain.arg.integer(stream.id)],
        {
          scriptHash: context.contractHash,
          waitForEvent: eventName,
          waitTimeoutMs: NEO_PAY_EVENT_WAIT_MS,
          onTransactionSent: (txid) => { tracked = persist(draft, txid); },
        },
      );
      tracked ??= persist(draft, result.txid);
      if (!tracked || result.success === false) throw new Error(t("transactionFailed"));
      if (result.verified === true && result.event) return settle(tracked, result.event);
      return settle(tracked);
    } catch (error) {
      const pending = tracked ?? pendingOperation.get();
      if (pending && isPendingNeoPayOperation(pending)) {
        return pending.engine === "platform-vesting"
          ? settleSharedPending(pending)
          : settle(pending);
      }
      throw error;
    }
  };

  const claimStream = (id: string): Promise<NeoPayActionOutcome> => {
    const streamId = positiveId(id);
    return runExclusive(`claim:${streamId}`, async () => {
      assertNoPending();
      claimingId.set(streamId);
      try {
        const { stream, actorHash, context } = await freshOwnedStream(streamId, "beneficiary");
        if (stream.claimable <= 0n) throw new Error(t("claimNothingYet"));
        return await invokeSingle("claim", stream, actorHash, context);
      } finally {
        claimingId.set(null);
      }
    });
  };

  const cancelStream = (id: string): Promise<NeoPayActionOutcome> => {
    const streamId = positiveId(id);
    return runExclusive(`cancel:${streamId}`, async () => {
      assertNoPending();
      cancellingId.set(streamId);
      try {
        const { stream, actorHash, context } = await freshOwnedStream(streamId, "creator");
        return await invokeSingle("cancel", stream, actorHash, context);
      } finally {
        cancellingId.set(null);
      }
    });
  };

  const recoverPending = (): Promise<NeoPayActionOutcome | null> => {
    const pending = pendingOperation.get();
    if (!pending) return Promise.resolve(null);
    return runExclusive("recover", async () => {
      if (!isPendingNeoPayOperation(pending)) {
        clearPending();
        throw new Error(t("neoPayPendingInvalid"));
      }
      assertRecoveryStorageAvailable();
      if (!writePending(pending)) throw new Error(t("neoPayRecoveryStorageUnavailable"));
      isRecovering.set(true);
      try {
        let result: NeoPayActionOutcome;
        if (pending.engine === "platform-vesting") {
          const { actorHash, network, contractHash } = await sharedWalletSnapshot();
          if (
            pending.network !== network ||
            !neoPayAccountMatches(pending.contractHash, contractHash) ||
            !neoPayAccountMatches(pending.actorHash, actorHash)
          ) throw new Error(t("neoPayPendingContextMismatch"));
          result = await settleSharedPending(pending);
        } else {
          const { actorHash, context } = await walletSnapshot();
          if (!sameContext(pending, context, actorHash)) throw new Error(t("neoPayPendingContextMismatch"));
          result = await settle(pending);
        }
        if (result.status === "confirmed") serviceNotice.set(t("neoPayTransactionRecovered"));
        if (result.status === "fault") serviceNotice.set(t("neoPayTransactionFault"));
        return result;
      } finally {
        isRecovering.set(false);
      }
    });
  };

  const migrateLegacyPending = async (): Promise<void> => {
    if (pendingOperation.get()) return;
    let legacy: Record<string, unknown> | null;
    try {
      legacy = app.storage.local.get<Record<string, unknown> | null>(LEGACY_PENDING_KEY, null);
    } catch {
      recoveryStorageHealthy.set(false);
      serviceNotice.set(t("neoPayRecoveryStorageUnavailable"));
      return;
    }
    if (!legacy || typeof legacy !== "object") return;
    const txid = clean(legacy.txid);
    const actorHash = normalizeNeoPayAccount(legacy.creatorHash);
    const submittedAt = Number(legacy.submittedAt);
    try {
      assertRecoveryStorageAvailable();
    } catch {
      serviceNotice.set(t("neoPayRecoveryStorageUnavailable"));
      return;
    }
    let context: NeoPayChainContext;
    try {
      context = await requireCanonicalNeoPayContext(app, t("neoPayChainContextMismatch"));
    } catch {
      serviceNotice.set(t("neoPayChainContextMismatch"));
      return;
    }
    const recoverableShape = isExactNeoPayTxid(txid) && actorHash &&
      Number.isSafeInteger(submittedAt) && submittedAt > 0;
    if (recoverableShape && !neoPayAccountMatches(legacy.contractHash, context.contractHash)) {
      serviceNotice.set(t("neoPayPendingContextMismatch"));
      return;
    }
    try {
      if (recoverableShape) {
        const migrated: PendingNeoPayOperation = {
          version: 1,
          kind: "legacy-create",
          eventName: "StreamCreated",
          network: context.network,
          contractHash: context.contractHash,
          actorHash,
          txid,
          createdAt: submittedAt,
        };
        if (!isPendingNeoPayOperation(migrated) || !writePending(migrated)) {
          throw new Error(t("neoPayRecoveryStorageUnavailable"));
        }
      }
      app.storage.local.delete(LEGACY_PENDING_KEY);
      const missing = `missing:${Date.now()}:${++storageProbeSequence}`;
      if (app.storage.local.get<unknown>(LEGACY_PENDING_KEY, missing) !== missing) {
        throw new Error(t("neoPayRecoveryStorageUnavailable"));
      }
    } catch {
      recoveryStorageHealthy.set(false);
      serviceNotice.set(t("neoPayRecoveryStorageUnavailable"));
    }
  };

  const loadAll = async (): Promise<void> => {
    if (disposed) return;
    if (isLoading.get()) {
      loadQueued = true;
      return;
    }
    loadQueued = false;
    isLoading.set(true);
    try {
      await migrateLegacyPending();
      await refreshStreams();
      if (pendingOperation.get() && app.chain.address.get() && !operationInFlight) {
        try {
          await recoverPending();
        } catch (error) {
          serviceNotice.set(app.errors.messageOf(error, t("neoPayConfirmationNeedsReview")));
        }
      }
    } finally {
      isLoading.set(false);
      if (loadQueued && !disposed) {
        loadQueued = false;
        void loadAll();
      }
    }
  };

  const stopAddressSync = app.wallet.onAccountChanged(() => {
    refreshGeneration += 1;
    refreshQueued = true;
    loadQueued = true;
    void loadAll();
  });

  const cleanup = () => {
    disposed = true;
    refreshGeneration += 1;
    stopAddressSync();
  };

  return {
    isLoading,
    isRefreshing,
    isCreating,
    isRecovering,
    claimingId,
    cancellingId,
    createdStreams,
    beneficiaryStreams,
    allStreams,
    activeCount,
    createdStreamCount,
    beneficiaryStreamCount,
    totalStreamCount,
    serviceNotice,
    listSource,
    activeAction,
    operationBusy,
    recoveryStorageHealthy,
    pendingOperation,
    pendingTxid,
    createStream,
    claimStream,
    cancelStream,
    recoverPending,
    refreshRecoveryStorage,
    refreshStreams,
    loadAll,
    cleanup,
  };
}
