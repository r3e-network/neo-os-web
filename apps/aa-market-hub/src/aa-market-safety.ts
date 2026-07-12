import type { MiniAppFramework } from "@shared/react";
import {
  GAS_HASH,
  getExternalIntegrationConfig,
  getMiniAppContractHash,
  getNetwork,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export const AA_MARKET_APP_ID = "miniapp-aa-market-hub";
export const AA_MARKET_CONFIRMATION_ATTEMPTS = 12;
export const AA_MARKET_CONFIRMATION_DELAY_MS = 2_500;

export type AAMarketOperationKind = "create" | "update" | "cancel" | "buy" | "refund";
export type AAMarketEventName =
  | "MarketEscrowEntered"
  | "MarketEscrowCancelled"
  | "MarketEscrowSettled"
  | "Transfer";

export interface AAMarketContext {
  network: NeoNetwork;
  marketHash: string;
  aaCoreHash: string;
  gasHash: string;
}

export interface PendingAAMarketOperation {
  version: 1;
  kind: AAMarketOperationKind;
  network: NeoNetwork;
  marketHash: string;
  aaCoreHash: string;
  gasHash: string;
  actorHash: string;
  txid: string;
  createdAt: number;
  listingId?: string;
  accountIdHash?: string;
  sellerHash?: string;
  priceRaw?: string;
  title?: string;
  metadataUri?: string;
  newBackupOwnerHash?: string;
  beforeListingCount?: string;
  beforeUpdatedAt?: string;
  pendingPaymentRaw?: string;
}

export interface AAMarketNotification {
  contract: string;
  eventName: string;
  event: { state: Array<{ value: unknown }> };
}

export interface AAMarketTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: AAMarketNotification[];
}

export interface AAMarketRpcInvocation {
  id: string | number;
  scriptHash: string;
  operation: string;
  args?: unknown[];
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

function reverseHash(hash: string): string {
  const bytes = hash.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

export function normalizeAAMarketAccount(value: unknown): string {
  const raw = clean(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^0x0{40}$/i.test(raw)) return raw.toLowerCase();
  const fromAddress = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(fromAddress) && !/^0x0{40}$/i.test(fromAddress)) {
    return fromAddress.toLowerCase();
  }
  const parsed = parseHash160(value);
  return /^0x[0-9a-fA-F]{40}$/.test(parsed) && !/^0x0{40}$/i.test(parsed)
    ? parsed.toLowerCase()
    : "";
}

export function aaMarketAccountMatches(value: unknown, expected: unknown): boolean {
  const variants = (candidate: unknown) => {
    const values = new Set<string>();
    const normalized = normalizeAAMarketAccount(candidate);
    if (normalized) values.add(normalized);
    const raw = clean(candidate);
    if (/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^0x0{40}$/i.test(raw)) {
      values.add(raw.toLowerCase());
      values.add(reverseHash(raw));
    }
    const parsed = parseHash160(candidate);
    if (/^0x[0-9a-fA-F]{40}$/.test(parsed) && !/^0x0{40}$/i.test(parsed)) {
      values.add(parsed.toLowerCase());
    }
    values.delete("");
    return values;
  };
  const left = variants(value);
  const right = variants(expected);
  return left.size > 0 && right.size > 0 && [...left].some((item) => right.has(item));
}

export function parseChainHash160(value: unknown, allowZero = false): string {
  const parsed = parseHash160(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(parsed)) {
    if (!allowZero && /^0x0{40}$/i.test(parsed)) return "";
    return parsed.toLowerCase();
  }
  return "";
}

function unsignedString(value: unknown): string {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return "";
  return BigInt(raw).toString();
}

function positiveString(value: unknown): string {
  const parsed = unsignedString(value);
  return parsed && BigInt(parsed) > 0n ? parsed : "";
}

function validTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(clean(value));
}

export function isPendingAAMarketOperation(value: unknown): value is PendingAAMarketOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingAAMarketOperation>;
  const kinds: AAMarketOperationKind[] = ["create", "update", "cancel", "buy", "refund"];
  if (
    pending.version !== 1 || !kinds.includes(pending.kind as AAMarketOperationKind) ||
    !explicitNetwork(pending.network) || !normalizeAAMarketAccount(pending.marketHash) ||
    !normalizeAAMarketAccount(pending.aaCoreHash) || !normalizeAAMarketAccount(pending.gasHash) ||
    !normalizeAAMarketAccount(pending.actorHash) ||
    !validTxid(pending.txid) || typeof pending.createdAt !== "number" ||
    !Number.isSafeInteger(pending.createdAt) || pending.createdAt <= 0
  ) return false;

  if (pending.kind === "create") {
    return Boolean(normalizeAAMarketAccount(pending.accountIdHash)) &&
      Boolean(positiveString(pending.priceRaw)) && Boolean(unsignedString(pending.beforeListingCount)) &&
      clean(pending.title).length <= 80 && clean(pending.metadataUri).length <= 240;
  }
  if (!positiveString(pending.listingId) || !normalizeAAMarketAccount(pending.accountIdHash)) return false;
  if (pending.kind === "update") {
    return Boolean(positiveString(pending.priceRaw)) && Boolean(unsignedString(pending.beforeUpdatedAt));
  }
  if (pending.kind === "buy") {
    return Boolean(normalizeAAMarketAccount(pending.sellerHash)) && Boolean(positiveString(pending.priceRaw)) &&
      Boolean(normalizeAAMarketAccount(pending.newBackupOwnerHash));
  }
  if (pending.kind === "refund") return Boolean(positiveString(pending.pendingPaymentRaw));
  return true;
}

export async function requireCanonicalAAMarketContext(
  app: MiniAppFramework,
  errorMessage = "aaMarketChainContextMismatch",
  options: { requireDetectedNetwork?: boolean } = {},
): Promise<AAMarketContext> {
  const launch = explicitNetwork(app.platform.launch.network);
  let detected: NeoNetwork | "" = "";
  try {
    detected = explicitNetwork(await app.chain.detectNetwork());
  } catch {
    if (options.requireDetectedNetwork) throw new Error(errorMessage);
    // Launch/query context remains the boundary during a transient wallet
    // detection failure. Unknown + unknown falls back to the explicit URL
    // network used by the platform registry.
  }
  if (options.requireDetectedNetwork && !detected) throw new Error(errorMessage);
  if (launch && detected && launch !== detected) throw new Error(errorMessage);
  const network = detected || launch || resolveNeoNetwork(getNetwork());
  const marketHash = normalizeAAMarketAccount(getMiniAppContractHash(AA_MARKET_APP_ID, network));
  const aaCoreHash = normalizeAAMarketAccount(getExternalIntegrationConfig(network).contracts.aaCore);
  const configured = normalizeAAMarketAccount(app.chain.contractAddress.get());
  if (!marketHash || !aaCoreHash || (configured && configured !== marketHash)) throw new Error(errorMessage);
  return { network, marketHash, aaCoreHash, gasHash: GAS_HASH.toLowerCase() };
}

function rpcUrl(network: NeoNetwork): string {
  return `https://api.n3index.dev/${network}`;
}

function invokePayload(invocation: AAMarketRpcInvocation) {
  return {
    jsonrpc: "2.0",
    id: invocation.id,
    method: "invokefunction",
    params: [invocation.scriptHash, invocation.operation, invocation.args ?? []],
  };
}

function parseRpcResult(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") throw new Error("Malformed AA market RPC response.");
  const record = payload as {
    error?: unknown;
    result?: { state?: unknown; exception?: unknown; stack?: unknown[] };
  };
  if (record.error || clean(record.result?.state).toUpperCase() !== "HALT") {
    throw new Error("AA market contract read failed.");
  }
  const stack = record.result?.stack;
  if (!Array.isArray(stack) || stack.length < 1) throw new Error("Malformed AA market RPC stack.");
  return parseStackItem(stack[0]);
}

export async function readAAMarketRpc(
  context: AAMarketContext,
  scriptHash: string,
  operation: string,
  args: unknown[] = [],
): Promise<unknown> {
  const response = await fetchWithTimeout(rpcUrl(context.network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invokePayload({ id: 1, scriptHash, operation, args })),
    timeoutMs: 10_000,
  });
  if (!response.ok) throw new Error("AA market RPC unavailable.");
  return parseRpcResult(await response.json());
}

export async function readAAMarketRpcBatch(
  context: AAMarketContext,
  invocations: AAMarketRpcInvocation[],
): Promise<Map<string, { ok: true; value: unknown } | { ok: false }>> {
  const output = new Map<string, { ok: true; value: unknown } | { ok: false }>();
  if (invocations.length === 0) return output;
  const response = await fetchWithTimeout(rpcUrl(context.network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invocations.map(invokePayload)),
    timeoutMs: 15_000,
  });
  if (!response.ok) throw new Error("AA market RPC unavailable.");
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Malformed AA market batch response.");
  const byId = new Map(payload.map((item) => [clean((item as { id?: unknown }).id), item]));
  for (const invocation of invocations) {
    const key = clean(invocation.id);
    try {
      output.set(key, { ok: true, value: parseRpcResult(byId.get(key)) });
    } catch {
      output.set(key, { ok: false });
    }
  }
  return output;
}

function stateArray(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const value = (state as { value?: unknown }).value;
    return Array.isArray(value) ? value : null;
  }
  return null;
}

function parseNotification(notification: unknown): AAMarketNotification | null {
  if (!notification || typeof notification !== "object") return null;
  const record = notification as { contract?: unknown; eventname?: unknown };
  const contract = normalizeAAMarketAccount(record.contract);
  const eventName = clean(record.eventname);
  const state = stateArray(notification);
  if (!contract || !eventName || !state) return null;
  return {
    contract,
    eventName,
    event: { state: state.map((item) => ({ value: parseStackItem(item) })) },
  };
}

export function notificationValue(notification: AAMarketNotification, index: number): unknown {
  return notification.event.state[index]?.value;
}

export function findAAMarketNotification(
  outcome: AAMarketTransactionOutcome,
  contract: string,
  eventName: AAMarketEventName,
  predicate?: (notification: AAMarketNotification) => boolean,
): AAMarketNotification | null {
  return outcome.notifications.find((notification) =>
    notification.eventName === eventName && aaMarketAccountMatches(notification.contract, contract) &&
    (!predicate || predicate(notification))) ?? null;
}

export async function readAAMarketTransactionOutcome(
  pending: PendingAAMarketOperation,
): Promise<AAMarketTransactionOutcome> {
  if (!isPendingAAMarketOperation(pending)) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(rpcUrl(pending.network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getapplicationlog", params: [pending.txid] }),
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
    const notifications = executions.flatMap((entry) => entry.notifications ?? [])
      .map(parseNotification)
      .filter((entry): entry is AAMarketNotification => entry !== null);
    return { state: "halt", notifications };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

export async function waitForAAMarketTransactionOutcome(
  pending: PendingAAMarketOperation,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<AAMarketTransactionOutcome> {
  const attempts = options.attempts ?? AA_MARKET_CONFIRMATION_ATTEMPTS;
  const delayMs = options.delayMs ?? AA_MARKET_CONFIRMATION_DELAY_MS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await readAAMarketTransactionOutcome(pending);
    if (outcome.state !== "unknown") return outcome;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { state: "unknown", notifications: [] };
}
