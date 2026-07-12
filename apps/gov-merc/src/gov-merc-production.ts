import type { MiniAppFramework } from "@shared/react";
import {
  getExternalIntegrationConfig,
  getMiniAppContractHash,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { localStorageAvailable } from "@shared/utils/safe-storage";
import { addressToScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export const GOV_MERC_APP_ID = "miniapp-gov-merc";
export const GOV_MERC_PENDING_KEY = "neo:miniapp-gov-merc:pending-operation:v1";

const HASH160_PATTERN = /^0x[0-9a-f]{40}$/;
const TXID_PATTERN = /^0x[0-9a-f]{64}$/;
const ZERO_HASH_PATTERN = /^0x0{40}$/;

export type GovMercOperationKind =
  | "deposit"
  | "withdraw"
  | "bid"
  | "settle"
  | "claim"
  | "reclaim"
  | "withdraw-credit";
export type GovMercPendingStage = "payment" | "action";
export type GovMercEventName =
  | "Credited"
  | "Staked"
  | "Unstaked"
  | "BidPlaced"
  | "EpochSettled"
  | "RewardsClaimed"
  | "BidReclaimed"
  | "CreditWithdrawn";

export interface GovMercChainContext {
  network: NeoNetwork;
  contractHash: string;
}

export interface PendingGovMercOperation {
  version: 1;
  kind: GovMercOperationKind;
  stage: GovMercPendingStage;
  eventName: GovMercEventName;
  network: NeoNetwork;
  contractHash: string;
  actorHash: string;
  txid: string;
  paymentTxid?: string;
  createdAt: number;
  epoch: number;
  amountRaw: string;
  fundingAmountRaw?: string;
  beforeStakeRaw: string;
  beforeBidRaw: string;
  beforeEpoch: number;
  beforeRewardsRaw: string;
  beforeCreditRaw: string;
}

export type PendingGovMercDraft = Omit<
  PendingGovMercOperation,
  "version" | "stage" | "eventName" | "txid" | "paymentTxid" | "createdAt"
>;

export interface GovMercReadback {
  stakeRaw?: string;
  bidRaw?: string;
  epoch?: number;
  rewardsRaw?: string;
  creditRaw?: string;
}

export interface GovMercNotification {
  contract: string;
  eventName: string;
  values: unknown[];
}

export interface GovMercTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: GovMercNotification[];
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function unsignedInteger(value: unknown): string {
  const text = clean(value);
  return /^\d+$/.test(text) ? BigInt(text).toString() : "";
}

function safeInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function explicitGovMercNetwork(value: unknown): NeoNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

function reverseHash(value: string): string {
  const bytes = value.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

export function normalizeGovMercAccount(value: unknown): string {
  const raw = clean(value);
  const direct = raw.toLowerCase();
  if (HASH160_PATTERN.test(direct) && !ZERO_HASH_PATTERN.test(direct)) return direct;
  const fromAddress = addressToScriptHash(raw).toLowerCase();
  if (HASH160_PATTERN.test(fromAddress) && !ZERO_HASH_PATTERN.test(fromAddress)) return fromAddress;
  const parsed = parseHash160(value).toLowerCase();
  return HASH160_PATTERN.test(parsed) && !ZERO_HASH_PATTERN.test(parsed) ? parsed : "";
}

export function govMercAccountsMatch(left: unknown, right: unknown): boolean {
  const variants = (value: unknown) => {
    const result = new Set<string>();
    const normalized = normalizeGovMercAccount(value);
    if (normalized) {
      result.add(normalized);
      result.add(reverseHash(normalized));
    }
    const raw = clean(value).toLowerCase();
    if (HASH160_PATTERN.test(raw) && !ZERO_HASH_PATTERN.test(raw)) {
      result.add(raw);
      result.add(reverseHash(raw));
    }
    result.delete("");
    return result;
  };
  const lhs = variants(left);
  const rhs = variants(right);
  return lhs.size > 0 && rhs.size > 0 && [...lhs].some((entry) => rhs.has(entry));
}

export function eventNameForGovMercOperation(
  kind: GovMercOperationKind,
  stage: GovMercPendingStage = "action",
): GovMercEventName {
  if (kind === "bid" && stage === "payment") return "Credited";
  switch (kind) {
    case "deposit": return "Staked";
    case "withdraw": return "Unstaked";
    case "bid": return "BidPlaced";
    case "settle": return "EpochSettled";
    case "claim": return "RewardsClaimed";
    case "reclaim": return "BidReclaimed";
    case "withdraw-credit": return "CreditWithdrawn";
  }
}

export function buildPendingGovMercOperation(
  draft: PendingGovMercDraft,
  txid: string,
  options: { stage?: GovMercPendingStage; paymentTxid?: string; createdAt?: number } = {},
): PendingGovMercOperation {
  const stage = options.stage ?? "action";
  const normalizedTxid = clean(txid).toLowerCase();
  const paymentTxid = clean(options.paymentTxid).toLowerCase();
  const createdAt = options.createdAt ?? Date.now();
  const contractHash = normalizeGovMercAccount(draft.contractHash);
  const actorHash = normalizeGovMercAccount(draft.actorHash);
  const epoch = safeInteger(draft.epoch);
  const beforeEpoch = safeInteger(draft.beforeEpoch);
  const amountRaw = unsignedInteger(draft.amountRaw);
  const fundingAmountRaw = draft.fundingAmountRaw === undefined
    ? undefined
    : unsignedInteger(draft.fundingAmountRaw);
  const beforeStakeRaw = unsignedInteger(draft.beforeStakeRaw);
  const beforeBidRaw = unsignedInteger(draft.beforeBidRaw);
  const beforeRewardsRaw = unsignedInteger(draft.beforeRewardsRaw);
  const beforeCreditRaw = unsignedInteger(draft.beforeCreditRaw);
  if (
    !explicitGovMercNetwork(draft.network) ||
    !contractHash ||
    !actorHash ||
    !TXID_PATTERN.test(normalizedTxid) ||
    (paymentTxid && !TXID_PATTERN.test(paymentTxid)) ||
    !Number.isSafeInteger(createdAt) || createdAt <= 0 ||
    epoch === null || beforeEpoch === null ||
    !amountRaw || BigInt(amountRaw) <= 0n ||
    !beforeStakeRaw || !beforeBidRaw || !beforeRewardsRaw || !beforeCreditRaw ||
    (draft.kind === "bid" && (!fundingAmountRaw || BigInt(fundingAmountRaw) < 0n)) ||
    (draft.kind === "bid" && stage === "payment" && BigInt(fundingAmountRaw ?? "0") <= 0n)
  ) {
    throw new Error("invalidGovMercPendingOperation");
  }
  return {
    version: 1,
    ...draft,
    network: explicitGovMercNetwork(draft.network) as NeoNetwork,
    contractHash,
    actorHash,
    stage,
    eventName: eventNameForGovMercOperation(draft.kind, stage),
    txid: normalizedTxid,
    ...(paymentTxid ? { paymentTxid } : {}),
    createdAt,
    epoch,
    amountRaw,
    ...(fundingAmountRaw !== undefined ? { fundingAmountRaw } : {}),
    beforeStakeRaw,
    beforeBidRaw,
    beforeEpoch,
    beforeRewardsRaw,
    beforeCreditRaw,
  };
}

export function isPendingGovMercOperation(value: unknown): value is PendingGovMercOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const candidate = value as PendingGovMercOperation;
    const rebuilt = buildPendingGovMercOperation(candidate, candidate.txid, {
      stage: candidate.stage,
      paymentTxid: candidate.paymentTxid,
      createdAt: candidate.createdAt,
    });
    return candidate.version === 1 && rebuilt.eventName === candidate.eventName;
  } catch {
    return false;
  }
}

export function assertGovMercRecoveryStorage(storage = localStorageAvailable()): Storage {
  if (!storage) throw new Error("recoveryStorageUnavailable");
  const key = `${GOV_MERC_PENDING_KEY}:probe`;
  const value = `${Date.now()}:${Math.random()}`;
  try {
    storage.setItem(key, value);
    if (storage.getItem(key) !== value) throw new Error("storageReadbackMismatch");
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw new Error("storageDeleteMismatch");
    return storage;
  } catch {
    try { storage.removeItem(key); } catch { /* no-op */ }
    throw new Error("recoveryStorageUnavailable");
  }
}

export function readPendingGovMercOperation(storage = localStorageAvailable()): PendingGovMercOperation | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GOV_MERC_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (isPendingGovMercOperation(parsed)) return parsed;
    storage.removeItem(GOV_MERC_PENDING_KEY);
    return null;
  } catch {
    return null;
  }
}

export function writePendingGovMercOperation(
  record: PendingGovMercOperation | null,
  storage = assertGovMercRecoveryStorage(),
): void {
  try {
    if (record) {
      storage.setItem(GOV_MERC_PENDING_KEY, JSON.stringify(record));
      const restored = JSON.parse(storage.getItem(GOV_MERC_PENDING_KEY) ?? "null") as unknown;
      if (!isPendingGovMercOperation(restored) || restored.txid !== record.txid) {
        throw new Error("storageReadbackMismatch");
      }
    } else {
      storage.removeItem(GOV_MERC_PENDING_KEY);
      if (storage.getItem(GOV_MERC_PENDING_KEY) !== null) throw new Error("storageDeleteMismatch");
    }
  } catch {
    throw new Error("recoveryStorageUnavailable");
  }
}

export async function requireExactGovMercContext(app: MiniAppFramework): Promise<GovMercChainContext> {
  const launch = explicitGovMercNetwork(app.platform.launch.network);
  const detected = explicitGovMercNetwork(await app.chain.detectNetwork());
  if (!detected) throw new Error("walletNetworkUnknown");
  if (launch && launch !== detected) throw new Error("walletNetworkMismatch");
  const network = detected || launch || resolveNeoNetwork();
  const expected = normalizeGovMercAccount(getMiniAppContractHash(GOV_MERC_APP_ID, network));
  const configured = normalizeGovMercAccount(app.chain.contractAddress.get());
  if (!expected || !configured || expected !== configured) throw new Error("contractBindingMismatch");
  return { network, contractHash: configured };
}

function notificationState(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const value = (state as { value?: unknown }).value;
    return Array.isArray(value) ? value : null;
  }
  return null;
}

function parseNotification(notification: unknown): GovMercNotification | null {
  if (!notification || typeof notification !== "object") return null;
  const record = notification as { contract?: unknown; eventname?: unknown; event_name?: unknown };
  const contract = normalizeGovMercAccount(record.contract);
  const eventName = clean(record.eventname ?? record.event_name);
  const state = notificationState(notification);
  if (!contract || !eventName || !state) return null;
  return { contract, eventName, values: state.map((entry) => parseStackItem(entry)) };
}

export async function readGovMercTransactionOutcome(
  record: PendingGovMercOperation,
): Promise<GovMercTransactionOutcome> {
  if (!isPendingGovMercOperation(record)) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(getExternalIntegrationConfig(record.network).rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [record.txid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", notifications: [] };
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error) return { state: "unknown", notifications: [] };
    const executions = payload.result?.executions ?? [];
    const states = executions.map((entry) => clean(entry.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return { state: "fault", notifications: [] };
    if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) {
      return { state: "unknown", notifications: [] };
    }
    return {
      state: "halt",
      notifications: executions
        .flatMap((entry) => entry.notifications ?? [])
        .map(parseNotification)
        .filter((entry): entry is GovMercNotification => entry !== null),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

function integerMatches(value: unknown, expected: string): boolean {
  const parsed = unsignedInteger(value);
  return Boolean(parsed) && parsed === expected;
}

export function govMercEventMatches(
  record: PendingGovMercOperation,
  outcome: GovMercTransactionOutcome,
): boolean {
  if (outcome.state !== "halt") return false;
  return outcome.notifications.some((notification) => {
    if (
      notification.eventName !== record.eventName ||
      !govMercAccountsMatch(notification.contract, record.contractHash)
    ) return false;
    const value = notification.values;
    if (record.kind === "bid" && record.stage === "payment") {
      return govMercAccountsMatch(value[0], record.actorHash) &&
        integerMatches(value[1], record.fundingAmountRaw ?? "");
    }
    switch (record.kind) {
      case "deposit":
        return govMercAccountsMatch(value[0], record.actorHash) && integerMatches(value[1], record.amountRaw) &&
          integerMatches(value[2], (BigInt(record.beforeStakeRaw) + BigInt(record.amountRaw)).toString());
      case "withdraw":
        return govMercAccountsMatch(value[0], record.actorHash) && integerMatches(value[1], record.amountRaw) &&
          integerMatches(value[2], (BigInt(record.beforeStakeRaw) - BigInt(record.amountRaw)).toString());
      case "bid":
        return integerMatches(value[0], String(record.epoch)) && govMercAccountsMatch(value[1], record.actorHash) &&
          integerMatches(value[2], (BigInt(record.beforeBidRaw) + BigInt(record.amountRaw)).toString());
      case "settle":
        return integerMatches(value[0], String(record.epoch)) &&
          Boolean(normalizeGovMercAccount(value[1])) &&
          integerMatches(value[2], record.amountRaw) &&
          Boolean(unsignedInteger(value[3]));
      case "claim":
        return govMercAccountsMatch(value[0], record.actorHash) && integerMatches(value[1], record.amountRaw);
      case "reclaim":
        return integerMatches(value[0], String(record.epoch)) && govMercAccountsMatch(value[1], record.actorHash) &&
          integerMatches(value[2], record.amountRaw);
      case "withdraw-credit":
        return govMercAccountsMatch(value[0], record.actorHash) && integerMatches(value[1], record.amountRaw);
    }
  });
}

export function govMercReadbackSatisfied(
  record: PendingGovMercOperation,
  readback: GovMercReadback,
): boolean {
  try {
    const currentStake = readback.stakeRaw === undefined ? null : BigInt(unsignedInteger(readback.stakeRaw));
    const currentBid = readback.bidRaw === undefined ? null : BigInt(unsignedInteger(readback.bidRaw));
    const currentRewards = readback.rewardsRaw === undefined ? null : BigInt(unsignedInteger(readback.rewardsRaw));
    const currentCredit = readback.creditRaw === undefined ? null : BigInt(unsignedInteger(readback.creditRaw));
    if (record.kind === "bid" && record.stage === "payment") {
      const actionSatisfied = currentBid !== null &&
        currentBid >= BigInt(record.beforeBidRaw) + BigInt(record.amountRaw);
      const paymentSatisfied = currentCredit !== null &&
        currentCredit >= BigInt(record.beforeCreditRaw) + BigInt(record.fundingAmountRaw ?? "0");
      return actionSatisfied || paymentSatisfied;
    }
    switch (record.kind) {
      case "deposit":
        return currentStake === BigInt(record.beforeStakeRaw) + BigInt(record.amountRaw);
      case "withdraw":
        return currentStake === BigInt(record.beforeStakeRaw) - BigInt(record.amountRaw);
      case "bid":
        return currentBid === BigInt(record.beforeBidRaw) + BigInt(record.amountRaw);
      case "settle":
        return readback.epoch !== undefined && readback.epoch > record.beforeEpoch;
      case "claim":
        return currentRewards !== null && currentRewards < BigInt(record.beforeRewardsRaw);
      case "reclaim":
        return currentBid === 0n;
      case "withdraw-credit":
        return currentCredit === 0n;
    }
  } catch {
    return false;
  }
}
