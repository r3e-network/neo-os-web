import type { MiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { getRpcUrl, type NeoNetwork } from "@shared/constants/rpc";
import { addressToScriptHash } from "@shared/utils/neo";

export type AnchorAction = "stake" | "withdraw" | "claim" | "recover";
export type AnchorBindingStatus =
  | "loading"
  | "ready"
  | "unknown-network"
  | "missing-contract"
  | "unregistered"
  | "mode-mismatch"
  | "paused"
  | "read-unavailable";

export interface AnchorRuntimeConfig {
  appId: string;
  expectedMode: 1 | 2;
  contracts: Record<NeoNetwork, string>;
  launchNetwork?: unknown;
}

export interface AnchorStatsSnapshot {
  mode: string;
  totalStaked: string;
  totalStakers: string;
  rewardPerNeo: string;
  rewardReserve: string;
  agentCount: string;
  selectedAgentId: string;
  paused: boolean;
}

export interface AnchorUserSnapshot {
  walletHash: string;
  stake: string;
  pendingRewards: string;
  neoCredit: string;
}

export interface PendingAnchorTransaction {
  version: 2;
  network: NeoNetwork;
  contract: string;
  appId: string;
  expectedMode: 1 | 2;
  walletHash: string;
  action: AnchorAction;
  amount: string;
  beforeStake: string;
  beforeRewards: string;
  beforeCredit: string;
  expectedStake: string;
  txid: string;
  createdAt: number;
}

export interface AnchorHistoryItem {
  action: AnchorAction;
  amount: string;
  txid: string;
  status: "confirmed" | "fault" | "mismatch";
  at: number;
}

export interface AnchorNotification {
  contract: string;
  eventName: string;
  state: unknown[];
}

export interface AnchorTransactionOutcome {
  state: "unknown" | "fault" | "halt";
  notifications: AnchorNotification[];
}

type Translate = (key: string, params?: Record<string, string | number>) => string;
type TransactionReader = (
  network: NeoNetwork,
  txid: string,
) => Promise<AnchorTransactionOutcome>;

const PENDING_KEY_PREFIX = "pending-transaction-v2/";
const HISTORY_KEY_PREFIX = "transaction-history-v2/";
const STORAGE_PROBE_KEY = "recovery-storage-probe-v2";
const TXID_PATTERN = /^0x[0-9a-f]{64}$/i;
const HASH160_PATTERN = /^0x[0-9a-f]{40}$/i;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAnchorNetwork(value: unknown): NeoNetwork | null {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return null;
}

export function normalizeAnchorHash(value: unknown): string {
  const normalized = clean(value).toLowerCase();
  return HASH160_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeAnchorTxid(value: unknown): string {
  const normalized = clean(value).toLowerCase();
  return TXID_PATTERN.test(normalized) ? normalized : "";
}

function unwrapValue(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) {
    return unwrapValue((value as { value?: unknown }).value);
  }
  return value;
}

export function parseAnchorInteger(value: unknown, label: string): string {
  const raw = unwrapValue(value);
  try {
    if (typeof raw === "bigint") return raw.toString();
    if (typeof raw === "number" && Number.isSafeInteger(raw)) return BigInt(raw).toString();
    if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
      return BigInt(raw.trim()).toString();
    }
  } catch {
    // The typed error below owns the public classification.
  }
  throw new Error(`anchorReadInvalid:${label}`);
}

function parseAnchorBoolean(value: unknown, label: string): boolean {
  const raw = unwrapValue(value);
  if (typeof raw === "boolean") return raw;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  throw new Error(`anchorReadInvalid:${label}`);
}

function mapValue(value: unknown, key: string): unknown {
  if (value instanceof Map) return value.get(key);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  if (Array.isArray(record.value)) {
    for (const entry of record.value) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as { key?: unknown; value?: unknown };
      if (clean(unwrapValue(candidate.key)) === key) return unwrapValue(candidate.value);
    }
  }
  return undefined;
}

export function parseAnchorStats(value: unknown): AnchorStatsSnapshot {
  return {
    mode: parseAnchorInteger(mapValue(value, "mode"), "stats.mode"),
    totalStaked: parseAnchorInteger(mapValue(value, "totalStaked"), "stats.totalStaked"),
    totalStakers: parseAnchorInteger(mapValue(value, "totalStakers"), "stats.totalStakers"),
    rewardPerNeo: parseAnchorInteger(mapValue(value, "rewardPerNeo"), "stats.rewardPerNeo"),
    rewardReserve: parseAnchorInteger(mapValue(value, "rewardReserve"), "stats.rewardReserve"),
    agentCount: parseAnchorInteger(mapValue(value, "agentCount"), "stats.agentCount"),
    selectedAgentId: parseAnchorInteger(
      mapValue(value, "selectedAgentId"),
      "stats.selectedAgentId",
    ),
    paused: parseAnchorBoolean(mapValue(value, "paused"), "stats.paused"),
  };
}

function walletHash(address: unknown): string {
  const direct = normalizeAnchorHash(address);
  if (direct) return direct;
  const raw = clean(address);
  if (!raw) return "";
  try {
    return normalizeAnchorHash(addressToScriptHash(raw));
  } catch {
    return "";
  }
}

function reverseHex(hex: string): string {
  return hex.match(/.{2}/g)?.reverse().join("") ?? "";
}

function parseRpcStackItem(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const item = value as { type?: unknown; value?: unknown };
  const type = clean(item.type);
  if (type === "Integer") return parseAnchorInteger(item.value, "event.integer");
  if (type === "Boolean") return parseAnchorBoolean(item.value, "event.boolean");
  if (type === "Any") return null;
  if (type === "Array" || type === "Struct") {
    return Array.isArray(item.value) ? item.value.map(parseRpcStackItem) : [];
  }
  if (type === "ByteString" || type === "ByteArray" || type === "Buffer") {
    if (typeof item.value !== "string") return "";
    try {
      const bytes = Uint8Array.from(atob(item.value), (char) => char.charCodeAt(0));
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (bytes.length === 20) return `0x${reverseHex(hex)}`;
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (/^[\x20-\x7e]+$/.test(decoded)) return decoded;
      return `0x${hex}`;
    } catch {
      return "";
    }
  }
  return unwrapValue(item.value);
}

function parseNotification(value: unknown): AnchorNotification | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const contract = normalizeAnchorHash(record.contract ?? record.scripthash);
  const eventName = clean(record.eventname ?? record.eventName);
  const stateRecord = record.state as { value?: unknown } | unknown[] | undefined;
  const rawState = Array.isArray(stateRecord)
    ? stateRecord
    : stateRecord && typeof stateRecord === "object" && Array.isArray(stateRecord.value)
      ? stateRecord.value
      : null;
  if (!contract || !eventName || !rawState) return null;
  return { contract, eventName, state: rawState.map(parseRpcStackItem) };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 8_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function readAnchorTransactionOutcome(
  network: NeoNetwork,
  txid: string,
): Promise<AnchorTransactionOutcome> {
  const normalizedTxid = normalizeAnchorTxid(txid);
  if (!normalizedTxid) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [normalizedTxid],
      }),
    });
    if (!response.ok) return { state: "unknown", notifications: [] };
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error) return { state: "unknown", notifications: [] };
    const executions = payload.result?.executions ?? [];
    const states = executions.map((entry) => clean(entry.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) {
      return { state: "fault", notifications: [] };
    }
    if (states.length === 0 || !states.every((state) => state.includes("HALT"))) {
      return { state: "unknown", notifications: [] };
    }
    return {
      state: "halt",
      notifications: executions
        .flatMap((entry) => entry.notifications ?? [])
        .map(parseNotification)
        .filter((entry): entry is AnchorNotification => entry !== null),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

export function restorePendingAnchorTransaction(
  value: unknown,
  config: AnchorRuntimeConfig,
  network: NeoNetwork,
): PendingAnchorTransaction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PendingAnchorTransaction>;
  const action = record.action;
  const contract = normalizeAnchorHash(record.contract);
  const wallet = normalizeAnchorHash(record.walletHash);
  const txid = normalizeAnchorTxid(record.txid);
  if (
    record.version !== 2 ||
    record.network !== network ||
    contract !== normalizeAnchorHash(config.contracts[network]) ||
    record.appId !== config.appId ||
    record.expectedMode !== config.expectedMode ||
    !wallet ||
    !txid ||
    !["stake", "withdraw", "claim", "recover"].includes(String(action)) ||
    !Number.isFinite(record.createdAt) ||
    Number(record.createdAt) <= 0
  ) return null;
  try {
    return {
      version: 2,
      network,
      contract,
      appId: config.appId,
      expectedMode: config.expectedMode,
      walletHash: wallet,
      action: action as AnchorAction,
      amount: parseAnchorInteger(record.amount, "pending.amount"),
      beforeStake: parseAnchorInteger(record.beforeStake, "pending.beforeStake"),
      beforeRewards: parseAnchorInteger(record.beforeRewards, "pending.beforeRewards"),
      beforeCredit: parseAnchorInteger(record.beforeCredit, "pending.beforeCredit"),
      expectedStake: parseAnchorInteger(record.expectedStake, "pending.expectedStake"),
      txid,
      createdAt: Number(record.createdAt),
    };
  } catch {
    return null;
  }
}

function notificationMatches(record: PendingAnchorTransaction, notification: AnchorNotification) {
  const stateAppId = clean(notification.state[0]);
  const stateWallet = normalizeAnchorHash(notification.state[1]);
  if (record.action === "recover") {
    return notification.contract === normalizeAnchorHash(BLOCKCHAIN_CONSTANTS.NEO_HASH)
      && notification.eventName === "Transfer"
      && normalizeAnchorHash(notification.state[0]) === record.contract
      && normalizeAnchorHash(notification.state[1]) === record.walletHash
      && parseAnchorInteger(notification.state[2], "event.amount") === record.amount;
  }
  if (notification.contract !== record.contract || stateAppId !== record.appId || stateWallet !== record.walletHash) {
    return false;
  }
  if (record.action === "claim") {
    return notification.eventName === "AnchorRewardsClaimed"
      && parseAnchorInteger(notification.state[2], "event.amount") === record.beforeRewards;
  }
  return notification.eventName === "AnchorStakeChanged"
    && parseAnchorInteger(notification.state[2], "event.stake") === record.expectedStake;
}

function historyItem(value: unknown): AnchorHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<AnchorHistoryItem>;
  const txid = normalizeAnchorTxid(row.txid);
  if (
    !["stake", "withdraw", "claim", "recover"].includes(String(row.action)) ||
    !["confirmed", "fault", "mismatch"].includes(String(row.status)) ||
    !txid ||
    !Number.isFinite(row.at)
  ) return null;
  try {
    return {
      action: row.action as AnchorAction,
      amount: parseAnchorInteger(row.amount, "history.amount"),
      txid,
      status: row.status as AnchorHistoryItem["status"],
      at: Number(row.at),
    };
  } catch {
    return null;
  }
}

function errorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.startsWith("anchorReadInvalid:")) return "anchorReadUnavailable";
  if (/^[a-z][A-Za-z]+$/.test(message)) return message;
  return "anchorActionFailed";
}

export function createAnchorRuntime(
  app: MiniAppFramework,
  t: Translate,
  config: AnchorRuntimeConfig,
  transactionReader: TransactionReader = readAnchorTransactionOutcome,
) {
  const launchNetwork = normalizeAnchorNetwork(
    config.launchNetwork ?? (
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("network")
    ),
  );
  const network = launchNetwork;
  const contract = network ? normalizeAnchorHash(config.contracts[network]) : "";
  const pendingKey = network ? `${PENDING_KEY_PREFIX}${network}` : "";
  const historyKey = network ? `${HISTORY_KEY_PREFIX}${network}` : "";

  const readStatus = createObservable<AnchorBindingStatus>(
    network ? (contract ? "loading" : "missing-contract") : "unknown-network",
  );
  const stats = createObservable<AnchorStatsSnapshot | null>(null);
  const user = createObservable<AnchorUserSnapshot | null>(null);
  const readError = createObservable("");
  const diagnosticError = createObservable("");
  const actionError = createObservable("");
  const actionStatus = createObservable(t("transactionIdle"));
  const loading = createObservable(false);
  const submitting = createObservable(false);
  const confirmationChecking = createObservable(false);
  const pendingTransaction = createObservable<PendingAnchorTransaction | null>(null);
  const lastTxid = createObservable("");
  const storageHealthy = createObservable(true);
  const walletAddress = createObservable(app.chain.address.get() ?? "");
  const history = createObservable<AnchorHistoryItem[]>([]);
  let loadEpoch = 0;
  let disposed = false;

  const safeGet = <T,>(key: string, fallback: T): T => {
    try {
      return app.storage.local.get<T>(key, fallback) ?? fallback;
    } catch {
      storageHealthy.set(false);
      return fallback;
    }
  };
  const safeSet = (key: string, value: unknown) => {
    try {
      app.storage.local.set(key, value);
      return true;
    } catch {
      storageHealthy.set(false);
      return false;
    }
  };
  const safeDelete = (key: string) => {
    try {
      app.storage.local.delete(key);
      return true;
    } catch {
      storageHealthy.set(false);
      return false;
    }
  };
  const assertRecoveryStorage = () => {
    const probe = `${Date.now()}-${Math.random()}`;
    if (!safeSet(STORAGE_PROBE_KEY, probe)) throw new Error("recoveryStorageUnavailable");
    const restored = safeGet(STORAGE_PROBE_KEY, "");
    if (restored !== probe || !safeDelete(STORAGE_PROBE_KEY)) {
      storageHealthy.set(false);
      throw new Error("recoveryStorageUnavailable");
    }
    storageHealthy.set(true);
  };

  const loadHistory = () => {
    if (!historyKey) return;
    const rows = safeGet<unknown[]>(historyKey, []);
    history.set(Array.isArray(rows) ? rows.map(historyItem).filter((row): row is AnchorHistoryItem => row !== null).slice(0, 8) : []);
  };
  const recordHistory = (record: PendingAnchorTransaction, status: AnchorHistoryItem["status"]) => {
    const next = [{ action: record.action, amount: record.amount, txid: record.txid, status, at: Date.now() }, ...history.get()].slice(0, 8);
    history.set(next);
    if (historyKey) safeSet(historyKey, next);
  };
  const persistPending = (record: PendingAnchorTransaction) => {
    pendingTransaction.set(record);
    lastTxid.set(record.txid);
    if (!pendingKey || !safeSet(pendingKey, record)) return false;
    const restored = restorePendingAnchorTransaction(safeGet<unknown>(pendingKey, null), config, record.network);
    const durable = restored?.txid === record.txid;
    storageHealthy.set(durable);
    return durable;
  };
  const clearPending = () => {
    pendingTransaction.set(null);
    if (pendingKey) safeDelete(pendingKey);
  };

  const readBinding = async () => {
    if (!network) throw new Error("walletNetworkUnknown");
    if (!contract) throw new Error("missingContract");
    const [modeRaw, pausedRaw, statsRaw] = await Promise.all([
      app.platformAnchor.appMode(),
      app.platformAnchor.appPaused(),
      app.platformAnchor.stats(),
    ]);
    const mode = parseAnchorInteger(modeRaw, "mode");
    const paused = parseAnchorBoolean(pausedRaw, "paused");
    const nextStats = parseAnchorStats(statsRaw);
    if (mode === "0") throw new Error("anchorNotRegistered");
    if (mode !== String(config.expectedMode) || nextStats.mode !== String(config.expectedMode)) {
      throw new Error("anchorModeMismatch");
    }
    if (paused !== nextStats.paused) throw new Error("anchorReadUnavailable");
    return { stats: nextStats, paused };
  };

  const readUser = async (hash: string): Promise<AnchorUserSnapshot> => {
    if (!contract) throw new Error("missingContract");
    const [stakeRaw, rewardsRaw, creditRaw] = await Promise.all([
      app.platformAnchor.userStake(hash),
      app.platformAnchor.pendingRewards(hash),
      app.platformAnchor.credit("NEO", hash),
    ]);
    return {
      walletHash: hash,
      stake: parseAnchorInteger(stakeRaw, "user.stake"),
      pendingRewards: parseAnchorInteger(rewardsRaw, "user.pendingRewards"),
      neoCredit: parseAnchorInteger(creditRaw, "user.neoCredit"),
    };
  };

  const classifyBindingError = (error: unknown): AnchorBindingStatus => {
    const key = errorKey(error);
    if (key === "walletNetworkUnknown") return "unknown-network";
    if (key === "missingContract") return "missing-contract";
    if (key === "anchorNotRegistered") return "unregistered";
    if (key === "anchorModeMismatch") return "mode-mismatch";
    return "read-unavailable";
  };

  const loadAll = async () => {
    const epoch = ++loadEpoch;
    loading.set(true);
    readError.set("");
    stats.set(null);
    user.set(null);
    if (!network) {
      readStatus.set("unknown-network");
      loading.set(false);
      return;
    }
    if (!contract) {
      readStatus.set("missing-contract");
      loading.set(false);
      return;
    }
    readStatus.set("loading");
    try {
      const binding = await readBinding();
      if (disposed || epoch !== loadEpoch) return;
      stats.set(binding.stats);
      readStatus.set(binding.paused ? "paused" : "ready");
      const hash = walletHash(app.chain.address.get());
      if (hash) {
        const nextUser = await readUser(hash);
        if (disposed || epoch !== loadEpoch) return;
        user.set(nextUser);
      }
    } catch (error) {
      if (disposed || epoch !== loadEpoch) return;
      readStatus.set(classifyBindingError(error));
      readError.set(t(errorKey(error)));
      diagnosticError.set(app.errors.messageOf(error));
      stats.set(null);
      user.set(null);
    } finally {
      if (!disposed && epoch === loadEpoch) loading.set(false);
    }
  };

  const assertExactWalletNetwork = async () => {
    if (!network) throw new Error("walletNetworkUnknown");
    const detected = normalizeAnchorNetwork(await app.chain.detectNetwork());
    if (!detected) throw new Error("walletNetworkUnknown");
    if (detected !== network) throw new Error("walletNetworkMismatch");
    return detected;
  };

  const actionAmount = (action: AnchorAction, input: unknown, before: AnchorUserSnapshot) => {
    if (action === "claim") {
      if (BigInt(before.pendingRewards) <= 0n) throw new Error("noRewardsAvailable");
      return before.pendingRewards;
    }
    if (action === "recover") {
      if (BigInt(before.neoCredit) <= 0n) throw new Error("noCreditAvailable");
      return before.neoCredit;
    }
    let amount: string;
    try {
      amount = parseAnchorInteger(input, "amount");
    } catch {
      throw new Error("invalidAmount");
    }
    if (BigInt(amount) <= 0n) throw new Error("invalidAmount");
    if (action === "withdraw" && BigInt(amount) > BigInt(before.stake)) {
      throw new Error("insufficientStake");
    }
    return amount;
  };

  const confirmPending = async (candidate?: PendingAnchorTransaction | null) => {
    const record = candidate ?? pendingTransaction.get();
    if (!record || confirmationChecking.get()) return null;
    confirmationChecking.set(true);
    actionError.set("");
    actionStatus.set(t("transactionChecking"));
    try {
      let outcome: AnchorTransactionOutcome;
      try {
        outcome = await transactionReader(record.network, record.txid);
      } catch (error) {
        diagnosticError.set(app.errors.messageOf(error));
        actionStatus.set(t("transactionPending"));
        return { status: "pending" as const, record };
      }
      if (pendingTransaction.get()?.txid !== record.txid) return null;
      if (outcome.state === "unknown") {
        actionStatus.set(t("transactionPending"));
        return { status: "pending" as const, record };
      }
      if (outcome.state === "fault") {
        clearPending();
        recordHistory(record, "fault");
        actionError.set(t("transactionFaulted"));
        actionStatus.set(t("transactionFaulted"));
        return { status: "fault" as const, record };
      }
      let eventMatched = false;
      try {
        eventMatched = outcome.notifications.some((notification) => notificationMatches(record, notification));
      } catch (error) {
        diagnosticError.set(app.errors.messageOf(error));
      }
      if (!eventMatched) {
        clearPending();
        recordHistory(record, "mismatch");
        actionError.set(t("transactionEventMismatch"));
        actionStatus.set(t("transactionEventMismatch"));
        return { status: "mismatch" as const, record };
      }
      try {
        const binding = await readBinding();
        if (binding.paused && record.action === "stake") {
          actionStatus.set(t("transactionReadbackPending"));
          return { status: "pending" as const, record };
        }
        const latest = await readUser(record.walletHash);
        const readbackMatched = record.action === "stake" || record.action === "withdraw"
          ? latest.stake === record.expectedStake
          : record.action === "claim"
            ? latest.pendingRewards === "0"
            : latest.neoCredit === "0";
        if (!readbackMatched) {
          actionStatus.set(t("transactionReadbackPending"));
          return { status: "pending" as const, record };
        }
        stats.set(binding.stats);
        user.set(latest);
      } catch (error) {
        diagnosticError.set(app.errors.messageOf(error));
        actionStatus.set(t("transactionReadbackPending"));
        return { status: "pending" as const, record };
      }
      clearPending();
      recordHistory(record, "confirmed");
      lastTxid.set(record.txid);
      actionStatus.set(t("transactionConfirmed"));
      return { status: "confirmed" as const, record };
    } finally {
      confirmationChecking.set(false);
    }
  };

  const runAction = async (action: AnchorAction, input?: unknown) => {
    if (submitting.get()) return null;
    if (pendingTransaction.get()) return confirmPending();
    submitting.set(true);
    actionError.set("");
    diagnosticError.set("");
    actionStatus.set(t("transactionPreparing"));
    try {
      assertRecoveryStorage();
      const binding = await readBinding();
      if (binding.paused && action === "stake") throw new Error("anchorPaused");
      const address = await app.chain.ensureWallet();
      walletAddress.set(address);
      await assertExactWalletNetwork();
      const hash = walletHash(address);
      if (!hash) throw new Error("walletAddressInvalid");
      const before = await readUser(hash);
      const amount = actionAmount(action, input, before);
      const expectedStake = action === "stake"
        ? (BigInt(before.stake) + BigInt(amount)).toString()
        : action === "withdraw"
          ? (BigInt(before.stake) - BigInt(amount)).toString()
          : before.stake;
      let recovery: PendingAnchorTransaction | null = null;
      const rememberBroadcast = (txidInput: string) => {
        const txid = normalizeAnchorTxid(txidInput);
        if (!txid || !network) return;
        const record: PendingAnchorTransaction = {
          version: 2,
          network,
          contract,
          appId: config.appId,
          expectedMode: config.expectedMode,
          walletHash: hash,
          action,
          amount,
          beforeStake: before.stake,
          beforeRewards: before.pendingRewards,
          beforeCredit: before.neoCredit,
          expectedStake,
          txid,
          createdAt: Date.now(),
        };
        recovery = record;
        const durable = persistPending(record);
        actionStatus.set(t(durable ? "transactionPending" : "recoveryStorageUnavailable"));
      };
      const options = {
        waitForEvent: action === "claim"
          ? "AnchorRewardsClaimed"
          : action === "recover"
            ? undefined
            : "AnchorStakeChanged",
        waitTimeoutMs: 45_000,
        onTransactionSent: rememberBroadcast,
      };
      let result;
      try {
        if (action === "stake") {
          result = await app.platformAnchor.stakeNeo(amount, hash, options);
        } else if (action === "withdraw") {
          result = await app.platformAnchor.withdraw(amount, hash, options);
        } else if (action === "claim") {
          result = await app.platformAnchor.claimRewards(hash, options);
        } else {
          result = await app.platformAnchor.withdrawCredit("NEO", amount, hash, options);
        }
      } catch (error) {
        if (pendingTransaction.get()) {
          diagnosticError.set(app.errors.messageOf(error));
          actionStatus.set(t("transactionPending"));
          return { txid: pendingTransaction.get()?.txid ?? "", confirmed: false };
        }
        throw error;
      }
      const resultTxid = normalizeAnchorTxid(result.txid);
      if (!recovery) rememberBroadcast(resultTxid);
      const active = pendingTransaction.get();
      if (!active) throw new Error("transactionNotBroadcast");
      if (resultTxid && active.txid !== resultTxid) {
        actionError.set(t("transactionIdentityChanged"));
        actionStatus.set(t("transactionIdentityChanged"));
        return { txid: active.txid, confirmed: false };
      }
      let afterNetwork: NeoNetwork | null = null;
      try {
        afterNetwork = normalizeAnchorNetwork(await app.chain.detectNetwork());
      } catch {
        afterNetwork = null;
      }
      const afterWallet = walletHash(app.chain.address.get());
      if (afterNetwork !== network || afterWallet !== hash) {
        actionError.set(t("transactionBindingChanged"));
        actionStatus.set(t("transactionBindingChanged"));
        return { txid: active.txid, confirmed: false };
      }
      const settlement = await confirmPending(active);
      return { txid: active.txid, confirmed: settlement?.status === "confirmed" };
    } catch (error) {
      const key = errorKey(error);
      const friendly = t(key);
      actionError.set(friendly);
      actionStatus.set(friendly);
      diagnosticError.set(app.errors.messageOf(error));
      throw new Error(friendly);
    } finally {
      submitting.set(false);
    }
  };

  loadHistory();
  if (network && pendingKey) {
    const raw = safeGet<unknown>(pendingKey, null);
    const restored = restorePendingAnchorTransaction(raw, config, network);
    if (restored) {
      pendingTransaction.set(restored);
      lastTxid.set(restored.txid);
      actionStatus.set(t("transactionPending"));
    } else if (raw) {
      safeDelete(pendingKey);
    }
  }

  const stopAddress = app.wallet.onAccountChanged(({ current }) => {
    walletAddress.set(current ?? "");
    void loadAll();
  });

  if (pendingTransaction.get()) void confirmPending(pendingTransaction.get());

  return {
    state: {
      network: createObservable(network ?? ""),
      contract: createObservable(contract),
      expectedMode: createObservable(config.expectedMode),
      readStatus,
      stats,
      user,
      readError,
      diagnosticError,
      actionError,
      actionStatus,
      loading,
      submitting,
      confirmationChecking,
      pendingTransaction,
      lastTxid,
      storageHealthy,
      walletAddress,
      history,
    },
    // Connecting lives in main.tsx as `actions.registerConnectWallet` (seeding
    // `state.walletAddress` then reloading) rather than here: the `runAction`
    // gate asserts a readable binding and an exact wallet network, which is
    // precisely the state a disconnected visitor cannot satisfy yet.
    loadAll,
    stake: (amount: unknown) => runAction("stake", amount),
    withdraw: (amount: unknown) => runAction("withdraw", amount),
    claim: () => runAction("claim"),
    recover: () => runAction("recover"),
    confirmPending,
    cleanup: () => {
      disposed = true;
      loadEpoch += 1;
      stopAddress();
    },
  };
}
