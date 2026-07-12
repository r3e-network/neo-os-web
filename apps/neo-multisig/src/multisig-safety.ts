import type { MiniAppFramework } from "@shared/react";
import { getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, ownerMatchesAddress, parseHash160, parseStackItem } from "@shared/utils/neo";

export const MULTISIG_APP_ID = "miniapp-neo-multisig";
export const MULTISIG_EVENT_WAIT_MS = 30_000;

export type MultisigNetwork = "mainnet" | "testnet";
export type MultisigPendingKind = "create-vault" | "deposit" | "create-request" | "approve" | "cancel";
export type MultisigEventName = "VaultCreated" | "Deposited" | "RequestCreated" | "Approved" | "RequestCancelled";

export interface MultisigChainContext {
  network: MultisigNetwork;
  contractHash: string;
}

export interface PendingMultisigOperation {
  version: 1;
  kind: MultisigPendingKind;
  eventName: MultisigEventName;
  network: MultisigNetwork;
  contractHash: string;
  actorHash: string;
  txid: string;
  createdAt: number;
  vaultId?: string;
  requestId?: string;
  signerHashes?: string[];
  threshold?: number;
  assetHash?: string;
  amountBase?: string;
  beforeBalance?: string;
  recipientHash?: string;
  memo?: string;
  beforeApprovalCount?: number;
}

export interface MultisigTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  event: unknown | null;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function explicitNetwork(value: unknown): MultisigNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function normalizeMultisigHash(value: unknown): string {
  const raw = clean(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^0x0{40}$/i.test(raw)) return raw.toLowerCase();
  const fromAddress = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(fromAddress) && !/^0x0{40}$/i.test(fromAddress)) return fromAddress.toLowerCase();
  const parsed = parseHash160(raw);
  return /^0x[0-9a-fA-F]{40}$/.test(parsed) && !/^0x0{40}$/i.test(parsed) ? parsed.toLowerCase() : "";
}

export function multisigAccountMatches(value: unknown, expected: unknown): boolean {
  const left = normalizeMultisigHash(value);
  const right = normalizeMultisigHash(expected);
  return Boolean(left && right && (left === right || ownerMatchesAddress(clean(value), right)));
}

function validTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{16,}$/.test(clean(value));
}

function positiveId(value: unknown): boolean {
  return /^[1-9]\d*$/.test(clean(value));
}

function nonNegativeBase(value: unknown): boolean {
  const normalized = clean(value);
  return /^\d+$/.test(normalized);
}

function positiveBase(value: unknown): boolean {
  return nonNegativeBase(value) && BigInt(clean(value)) > 0n;
}

function eventNameFor(kind: MultisigPendingKind): MultisigEventName {
  if (kind === "create-vault") return "VaultCreated";
  if (kind === "deposit") return "Deposited";
  if (kind === "create-request") return "RequestCreated";
  if (kind === "approve") return "Approved";
  return "RequestCancelled";
}

export function isPendingMultisigOperation(value: unknown): value is PendingMultisigOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingMultisigOperation>;
  const kinds: MultisigPendingKind[] = ["create-vault", "deposit", "create-request", "approve", "cancel"];
  if (
    pending.version !== 1 || !kinds.includes(pending.kind as MultisigPendingKind) ||
    pending.eventName !== eventNameFor(pending.kind as MultisigPendingKind) ||
    !explicitNetwork(pending.network) || !normalizeMultisigHash(pending.contractHash) ||
    !normalizeMultisigHash(pending.actorHash) || !validTxid(pending.txid) ||
    !Number.isFinite(pending.createdAt) || Number(pending.createdAt) <= 0
  ) return false;
  if (pending.kind === "create-vault") {
    const signers = pending.signerHashes ?? [];
    const normalized = signers.map((hash) => normalizeMultisigHash(hash));
    return signers.length >= 2 && signers.length <= 16 && normalized.every(Boolean) &&
      new Set(normalized).size === signers.length && JSON.stringify(normalized) === JSON.stringify([...normalized].sort()) &&
      Number.isInteger(pending.threshold) && Number(pending.threshold) >= 1 && Number(pending.threshold) <= signers.length;
  }
  if (!positiveId(pending.vaultId) && pending.kind !== "approve" && pending.kind !== "cancel") return false;
  if (pending.kind === "deposit") {
    return Boolean(normalizeMultisigHash(pending.assetHash)) && positiveBase(pending.amountBase) && nonNegativeBase(pending.beforeBalance);
  }
  if (pending.kind === "create-request") {
    return Boolean(normalizeMultisigHash(pending.assetHash)) && positiveBase(pending.amountBase) &&
      Boolean(normalizeMultisigHash(pending.recipientHash)) && clean(pending.memo).length <= 160;
  }
  return positiveId(pending.requestId) && (pending.kind !== "approve" ||
    (Number.isInteger(pending.beforeApprovalCount) && Number(pending.beforeApprovalCount) >= 0));
}

export async function requireCanonicalMultisigContext(
  app: MiniAppFramework,
  errorMessage = "multisigChainContextMismatch",
): Promise<MultisigChainContext> {
  const launchNetwork = explicitNetwork(app.platform.launch.network);
  let detectedNetwork: MultisigNetwork | "" = "";
  try {
    detectedNetwork = explicitNetwork(await app.chain.detectNetwork?.());
  } catch {
    // A known launch network remains a valid boundary during a transient
    // wallet detection failure. Unknown + unknown is rejected below.
  }
  if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) throw new Error(errorMessage);
  const network = detectedNetwork || launchNetwork;
  if (!network) throw new Error(errorMessage);
  const configured = normalizeMultisigHash(app.chain.contractAddress.get());
  const expected = normalizeMultisigHash(getMiniAppContractHash(MULTISIG_APP_ID, resolveNeoNetwork(network)));
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

/** Read an exact VM outcome/event from N3Index without treating relay as success. */
export async function readMultisigTransactionOutcome(
  network: MultisigNetwork,
  txid: string,
  eventName: MultisigEventName,
  contractHash: string,
): Promise<MultisigTransactionOutcome> {
  if (!validTxid(txid) || !normalizeMultisigHash(contractHash)) return { state: "unknown", event: null };
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
    const wanted = normalizeMultisigHash(contractHash);
    const notification = executions.flatMap((entry) => entry.notifications ?? []).find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as { contract?: unknown; eventname?: unknown };
      return clean(record.eventname) === eventName && normalizeMultisigHash(record.contract) === wanted;
    });
    return { state: "halt", event: parsedNotification(notification) };
  } catch {
    return { state: "unknown", event: null };
  }
}
