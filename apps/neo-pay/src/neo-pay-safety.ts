import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS, getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export const NEO_PAY_APP_ID = "miniapp-neo-pay";
export const NEO_PAY_EVENT_WAIT_MS = 30_000;

export type NeoPayNetwork = "mainnet" | "testnet";
export type NeoPayPendingKind = "create" | "legacy-create" | "claim" | "cancel";
export type NeoPayPendingEngine = "legacy" | "platform-vesting";
export type NeoPayEventName = "StreamCreated" | "StreamClaimed" | "StreamCancelled";

export interface NeoPayChainContext {
  network: NeoPayNetwork;
  contractHash: string;
}

export interface NeoPayContextOptions {
  requireDetectedNetwork?: boolean;
  networkUnavailableMessage?: string;
}

export interface PendingNeoPayOperation {
  version: 1;
  engine?: NeoPayPendingEngine;
  kind: NeoPayPendingKind;
  eventName: NeoPayEventName;
  network: NeoPayNetwork;
  contractHash: string;
  actorHash: string;
  txid: string;
  createdAt: number;
  streamId?: string;
  beneficiaryHash?: string;
  assetHash?: string;
  totalBase?: string;
  rateBase?: string;
  intervalSeconds?: string;
  title?: string;
  notes?: string;
  beforeReleased?: string;
}

export interface NeoPayTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  event: unknown | null;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function explicitNetwork(value: unknown): NeoPayNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function normalizeNeoPayAccount(value: unknown): string {
  const raw = clean(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^0x0{40}$/i.test(raw)) return raw.toLowerCase();
  const fromAddress = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(fromAddress) && !/^0x0{40}$/i.test(fromAddress)) return fromAddress.toLowerCase();
  const parsed = parseHash160(raw);
  return /^0x[0-9a-fA-F]{40}$/.test(parsed) && !/^0x0{40}$/i.test(parsed) ? parsed.toLowerCase() : "";
}

export function neoPayAccountMatches(value: unknown, expected: unknown): boolean {
  const variants = (candidate: unknown): Set<string> => {
    const normalized = normalizeNeoPayAccount(candidate);
    const values = new Set<string>();
    if (normalized) values.add(normalized);
    const raw = clean(candidate);
    if (/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^0x0{40}$/i.test(raw)) {
      const bytes = raw.slice(2).match(/../g) ?? [];
      values.add(`0x${[...bytes].reverse().join("")}`.toLowerCase());
    }
    const parsed = parseHash160(candidate);
    if (/^0x[0-9a-fA-F]{40}$/.test(parsed) && !/^0x0{40}$/i.test(parsed)) values.add(parsed.toLowerCase());
    return values;
  };
  const left = variants(value);
  const right = variants(expected);
  return left.size > 0 && right.size > 0 && [...left].some((item) => right.has(item));
}

export function isExactNeoPayTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(clean(value));
}

function positiveId(value: unknown): boolean {
  return /^[1-9]\d*$/.test(clean(value));
}

function positiveBase(value: unknown): boolean {
  const raw = clean(value);
  return /^\d+$/.test(raw) && BigInt(raw) > 0n;
}

function nonNegativeBase(value: unknown): boolean {
  return /^\d+$/.test(clean(value));
}

function eventFor(kind: NeoPayPendingKind): NeoPayEventName {
  if (kind === "create" || kind === "legacy-create") return "StreamCreated";
  return kind === "claim" ? "StreamClaimed" : "StreamCancelled";
}

export function isPendingNeoPayOperation(value: unknown): value is PendingNeoPayOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingNeoPayOperation>;
  const kinds: NeoPayPendingKind[] = ["create", "legacy-create", "claim", "cancel"];
  const engine = pending.engine ?? "legacy";
  const network = explicitNetwork(pending.network);
  const contractHash = normalizeNeoPayAccount(pending.contractHash);
  const expectedContract = network
    ? normalizeNeoPayAccount(getMiniAppContractHash(NEO_PAY_APP_ID, resolveNeoNetwork(network)))
    : "";
  if (
    (engine !== "legacy" && engine !== "platform-vesting") ||
    pending.version !== 1 || !kinds.includes(pending.kind as NeoPayPendingKind) ||
    pending.eventName !== eventFor(pending.kind as NeoPayPendingKind) ||
    !network || !contractHash || (engine === "legacy" && contractHash !== expectedContract) ||
    !normalizeNeoPayAccount(pending.actorHash) || !isExactNeoPayTxid(pending.txid) ||
    !Number.isSafeInteger(pending.createdAt) || Number(pending.createdAt) <= 0
  ) return false;
  if (pending.kind === "legacy-create") return true;
  if (pending.kind === "create") {
    return Boolean(normalizeNeoPayAccount(pending.beneficiaryHash)) &&
      (neoPayAccountMatches(pending.assetHash, BLOCKCHAIN_CONSTANTS.GAS_HASH) ||
        neoPayAccountMatches(pending.assetHash, BLOCKCHAIN_CONSTANTS.NEO_HASH)) &&
      positiveBase(pending.totalBase) &&
      positiveBase(pending.rateBase) && BigInt(pending.rateBase!) <= BigInt(pending.totalBase!) &&
      positiveBase(pending.intervalSeconds) && clean(pending.title).length > 0 &&
      clean(pending.title).length <= 60 && clean(pending.notes).length <= 240;
  }
  return positiveId(pending.streamId) && (pending.kind !== "claim" || nonNegativeBase(pending.beforeReleased));
}

export async function requireCanonicalNeoPayContext(
  app: MiniAppFramework,
  errorMessage = "neoPayChainContextMismatch",
  options: NeoPayContextOptions = {},
): Promise<NeoPayChainContext> {
  const launchNetwork = explicitNetwork(app.platform.launch.network);
  let detectedNetwork: NeoPayNetwork | "" = "";
  try {
    detectedNetwork = explicitNetwork(await app.chain.detectNetwork?.());
  } catch {
    if (options.requireDetectedNetwork) {
      throw new Error(options.networkUnavailableMessage ?? errorMessage);
    }
    // Read-only surfaces may use a known launch network during transient
    // detection failures. Wallet writes never opt into this fallback.
  }
  if (options.requireDetectedNetwork && !detectedNetwork) {
    throw new Error(options.networkUnavailableMessage ?? errorMessage);
  }
  if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) throw new Error(errorMessage);
  const network = detectedNetwork || launchNetwork;
  if (!network) throw new Error(errorMessage);
  const configured = normalizeNeoPayAccount(app.chain.contractAddress.get());
  const expected = normalizeNeoPayAccount(getMiniAppContractHash(NEO_PAY_APP_ID, resolveNeoNetwork(network)));
  if (!configured || !expected || configured !== expected) throw new Error(errorMessage);
  return { network, contractHash: configured };
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

function parsedNotification(notification: unknown): unknown | null {
  const state = stateArray(notification);
  return state ? { state: state.map((item) => ({ value: parseStackItem(item) })) } : null;
}

export async function readNeoPayTransactionOutcome(
  network: NeoPayNetwork,
  txid: string,
  eventName: NeoPayEventName,
  contractHash: string,
): Promise<NeoPayTransactionOutcome> {
  if (!isExactNeoPayTxid(txid) || !normalizeNeoPayAccount(contractHash)) return { state: "unknown", event: null };
  try {
    const response = await fetchWithTimeout(`https://api.n3index.dev/${network}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getapplicationlog", params: [txid] }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", event: null };
    const payload = await response.json() as {
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
      error?: unknown;
    };
    if (payload.error) return { state: "unknown", event: null };
    const executions = payload.result?.executions ?? [];
    const states = executions.map((entry) => clean(entry.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return { state: "fault", event: null };
    if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) return { state: "unknown", event: null };
    const wanted = normalizeNeoPayAccount(contractHash);
    const notification = executions.flatMap((entry) => entry.notifications ?? []).find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as { contract?: unknown; eventname?: unknown };
      return clean(record.eventname) === eventName && neoPayAccountMatches(record.contract, wanted);
    });
    return { state: "halt", event: parsedNotification(notification) };
  } catch {
    return { state: "unknown", event: null };
  }
}
