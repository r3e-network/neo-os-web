import { getRpcUrl, type NeoNetwork } from "@shared/constants/rpc";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";

export const RELAY_REVIEW_VERSION = 1 as const;
export const RELAY_PAYLOAD_MAX_BYTES = 64 * 1024;
export const RELAY_RECEIPT_MAX_BYTES = 16 * 1024;
export const RELAY_ENDPOINT = "/api/aa/relay";

const TXID_RE = /^0x[0-9a-f]{64}$/;
const DIGEST_RE = /^0x[0-9a-f]{64}$/;
const METHOD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const INTEGER_RE = /^-?\d{1,78}$/;
const HEX_BYTES_RE = /^(?:0x)?(?:[0-9a-f]{2})*$/i;
const ACCEPTED_STATUSES = new Set(["accepted", "pending", "queued"]);
const SUPPORTED_OPERATIONS = new Set(["executeUserOp", "executeSponsoredUserOp"]);

export type ContractParam = {
  type: "Hash160" | "String" | "Integer" | "ByteArray" | "Array" | "Struct" | "Any" | "Boolean";
  value: unknown;
};

export interface RelayMetaInvocation {
  scriptHash: string;
  operation: "executeUserOp" | "executeSponsoredUserOp";
  args: ContractParam[];
}

export interface ParsedRelayDraft {
  network: NeoNetwork;
  aaCore: string;
  paymaster: string;
  accountId: string;
  dappId: string;
  metaInvocation: RelayMetaInvocation;
  userOp: ContractParam;
  targetContract: string;
  targetMethod: string;
  nonce: string;
  deadline: string;
  signaturePresent: boolean;
  sponsored: boolean;
}

export type RelayPreviewState = "ready" | "blocked" | "unreachable" | "not-run";

export interface RelayValidationPreview {
  state: RelayPreviewState;
  deadlineValid: boolean | null;
  nonceValid: boolean | null;
  verifierConfigured: boolean | null;
  verifier: string;
  hook: string;
  reason: string;
  checkedAt: number;
}

export type RelayReviewReadiness =
  | "review-ready"
  | "needs-authorization"
  | "needs-chain-preview"
  | "blocked";

export interface RelayReviewPackage {
  version: typeof RELAY_REVIEW_VERSION;
  kind: "aa-relay-review-package";
  jobId: string;
  packageDigest: string;
  createdAt: number;
  network: NeoNetwork;
  aaCore: string;
  accountId: string;
  target: {
    contract: string;
    method: string;
    nonce: string;
    deadline: string;
  };
  request: {
    aaAddress: string;
    metaInvocation: RelayMetaInvocation;
    paymaster?: { dapp_id: string; network: NeoNetwork };
  };
  validationPreview: RelayValidationPreview;
  authorization: {
    required: true;
    signaturePresent: boolean;
    note: string;
  };
  submission: {
    enabled: false;
    mode: "external-authorized-relay";
    endpoint: typeof RELAY_ENDPOINT;
    reason: string;
  };
  readiness: RelayReviewReadiness;
}

export interface RelayReceipt {
  version: 1;
  network: NeoNetwork;
  packageDigest: string;
  status: "accepted" | "pending" | "queued" | "broadcast";
  requestId: string;
  txid: string;
  receivedAt: number;
}

export type RelayChainStatus = "accepted" | "pending" | "confirmed" | "fault" | "mismatch" | "unreachable";

export interface RelayChainOutcome {
  status: RelayChainStatus;
  txid: string;
  vmState: string;
  confirmations: number;
  blockIndex: number;
  reason: string;
  checkedAt: number;
}

export interface PrepareRelayReviewInput {
  network: NeoNetwork;
  aaCore: string;
  paymaster?: string;
  aaAddress: string;
  dappId?: string;
  payloadJson: string;
  preview: RelayValidationPreview;
  now?: number;
}

type FetchLike = typeof fetch;

type RpcEnvelope<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

type RpcExecution = {
  vmstate?: unknown;
  exception?: unknown;
  notifications?: Array<{
    contract?: unknown;
    eventname?: unknown;
    event_name?: unknown;
    state?: unknown;
  }>;
};

type ApplicationLog = { executions?: RpcExecution[] };
type RawTransaction = { confirmations?: unknown; blockindex?: unknown; block_index?: unknown };

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHash160(value: unknown): string {
  const raw = clean(value);
  if (/^0x[0-9a-f]{40}$/i.test(raw) && !/^0x0{40}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  const converted = addressToScriptHash(raw);
  return /^0x[0-9a-f]{40}$/i.test(converted) && !/^0x0{40}$/i.test(converted)
    ? converted.toLowerCase()
    : "";
}

function normalizeTxid(value: unknown): string {
  const raw = clean(value).toLowerCase();
  const normalized = raw && !raw.startsWith("0x") ? `0x${raw}` : raw;
  return TXID_RE.test(normalized) ? normalized : "";
}

function normalizeDigest(value: unknown): string {
  const raw = clean(value).toLowerCase();
  const normalized = raw && !raw.startsWith("0x") ? `0x${raw}` : raw;
  return DIGEST_RE.test(normalized) ? normalized : "";
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asParams(value: unknown, label: string): ContractParam[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value as ContractParam[];
}

function integer(value: unknown, label: string): bigint {
  const raw = clean(value);
  if (!INTEGER_RE.test(raw)) throw new Error(`${label} must be a decimal integer.`);
  return BigInt(raw);
}

function byteArray(value: unknown, label: string): string {
  const raw = clean(value);
  if (!HEX_BYTES_RE.test(raw) || raw.replace(/^0x/i, "").length > 16_384) {
    throw new Error(`${label} must be an even-length hexadecimal byte array.`);
  }
  return raw.replace(/^0x/i, "").toLowerCase();
}

function validateParam(value: unknown, label: string, depth = 0): ContractParam {
  if (depth > 8) throw new Error(`${label} exceeds the maximum nesting depth.`);
  const param = asRecord(value, label);
  const type = clean(param.type) as ContractParam["type"];
  if (!["Hash160", "String", "Integer", "ByteArray", "Array", "Struct", "Any", "Boolean"].includes(type)) {
    throw new Error(`${label} uses unsupported contract parameter type ${type || "(empty)"}.`);
  }
  const rawValue = param.value;
  if (type === "Hash160") {
    const normalized = normalizeHash160(rawValue);
    if (!normalized) throw new Error(`${label} must contain a non-zero Hash160.`);
    return { type, value: normalized };
  }
  if (type === "String") {
    const normalized = String(rawValue ?? "");
    if (normalized.length > 256) throw new Error(`${label} string is too long.`);
    return { type, value: normalized };
  }
  if (type === "Integer") return { type, value: integer(rawValue, label).toString() };
  if (type === "ByteArray") return { type, value: byteArray(rawValue, label) };
  if (type === "Array" || type === "Struct") {
    const children = asParams(rawValue, label);
    if (children.length > 64) throw new Error(`${label} contains too many parameters.`);
    return {
      type,
      value: children.map((child, index) => validateParam(child, `${label}[${index}]`, depth + 1)),
    };
  }
  if (type === "Boolean") {
    if (typeof rawValue === "string") {
      const normalized = rawValue.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return { type, value: true };
      if (normalized === "false" || normalized === "0") return { type, value: false };
      throw new Error(`${label} must contain a Boolean value.`);
    }
    return { type, value: Boolean(rawValue) };
  }
  return { type, value: rawValue ?? null };
}

function validateUserOp(param: ContractParam, now: number) {
  if (param.type !== "Struct") throw new Error("UserOp must be encoded as a Struct parameter.");
  const fields = asParams(param.value, "UserOp");
  if (fields.length !== 6) {
    throw new Error("UserOp must contain target, method, args, nonce, deadline, and signature in that order.");
  }
  fields.forEach((field, index) => validateParam(field, `UserOp[${index}]`));
  const target = fields[0]?.type === "Hash160" ? normalizeHash160(fields[0].value) : "";
  const method = fields[1]?.type === "String" ? clean(fields[1].value) : "";
  const argsValid = fields[2]?.type === "Array";
  const nonce = fields[3]?.type === "Integer" ? integer(fields[3].value, "UserOp nonce") : -1n;
  const deadline = fields[4]?.type === "Integer" ? integer(fields[4].value, "UserOp deadline") : -1n;
  const signature = fields[5]?.type === "ByteArray" ? byteArray(fields[5].value, "UserOp signature") : "";
  if (!target) throw new Error("UserOp target must be a non-zero Hash160.");
  if (!METHOD_RE.test(method)) throw new Error("UserOp method must be a valid Neo contract method name.");
  if (!argsValid) throw new Error("UserOp args must be encoded as an Array parameter.");
  if (nonce < 0n) throw new Error("UserOp nonce cannot be negative.");
  if (deadline <= BigInt(now)) throw new Error("UserOp deadline is expired or not expressed as a future Neo millisecond timestamp.");
  return {
    target,
    method,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signaturePresent: signature.length > 0,
  };
}

export function parseRelayDraft(input: {
  network: NeoNetwork;
  aaCore: string;
  paymaster?: string;
  aaAddress: string;
  dappId?: string;
  payloadJson: string;
  now?: number;
}): ParsedRelayDraft {
  const now = input.now ?? Date.now();
  const payloadJson = clean(input.payloadJson);
  if (!payloadJson) throw new Error("Relay payload is required.");
  if (new TextEncoder().encode(payloadJson).length > RELAY_PAYLOAD_MAX_BYTES) {
    throw new Error("Relay payload exceeds the 64 KiB review limit.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new Error("Relay payload must be valid JSON.");
  }
  const payload = asRecord(parsed, "Relay payload");
  if (payload.rawTransaction || payload.raw_transaction) {
    throw new Error("Raw transactions are not accepted by this review console.");
  }
  const invocation = asRecord(payload.metaInvocation ?? payload.meta_invocation, "metaInvocation");
  if (invocation.signers) throw new Error("Caller-supplied signers are not part of the relay review package.");

  const expectedCore = normalizeHash160(input.aaCore);
  const scriptHash = normalizeHash160(invocation.scriptHash);
  if (!expectedCore || scriptHash !== expectedCore) {
    throw new Error("metaInvocation must target the canonical AA Core for the selected network.");
  }
  const operation = clean(invocation.operation);
  if (!SUPPORTED_OPERATIONS.has(operation)) {
    throw new Error("Only canonical V3 executeUserOp and executeSponsoredUserOp jobs are supported.");
  }
  const accountId = normalizeHash160(input.aaAddress);
  if (!accountId) throw new Error("AA account must be a valid Neo address or non-zero Hash160.");
  const rawArgs = asParams(invocation.args, "metaInvocation args");
  if (rawArgs[0]?.type === "Hash160" && clean(rawArgs[0].value) === "$AA_ACCOUNT") {
    rawArgs[0] = { ...rawArgs[0], value: accountId };
  }
  const args = rawArgs
    .map((param, index) => validateParam(param, `metaInvocation args[${index}]`));
  const sponsored = operation === "executeSponsoredUserOp";
  if (args.length !== (sponsored ? 5 : 2)) {
    throw new Error(`${operation} has an invalid argument count.`);
  }
  const payloadAccount = args[0]?.type === "Hash160" ? normalizeHash160(args[0].value) : "";
  if (!payloadAccount || payloadAccount !== accountId) {
    throw new Error("AA account and metaInvocation accountId do not match.");
  }
  const userOp = args[1];
  if (!userOp) throw new Error(`${operation} is missing its UserOp argument.`);
  const details = validateUserOp(userOp, now);
  const normalizedDappId = clean(input.dappId);
  if (normalizedDappId.length > 128) throw new Error("Paymaster dApp ID exceeds 128 characters.");

  const canonicalPaymaster = normalizeHash160(input.paymaster);
  if (sponsored) {
    if (!canonicalPaymaster) {
      throw new Error("No canonical on-chain AA paymaster is published for this network.");
    }
    const suppliedPaymaster = args[2]?.type === "Hash160" ? normalizeHash160(args[2].value) : "";
    const sponsor = args[3]?.type === "Hash160" ? normalizeHash160(args[3].value) : "";
    const reimbursement = args[4]?.type === "Integer"
      ? integer(args[4].value, "Reimbursement amount")
      : 0n;
    if (suppliedPaymaster !== canonicalPaymaster) {
      throw new Error("Sponsored operation must use the canonical paymaster for this network.");
    }
    if (!sponsor || reimbursement <= 0n) {
      throw new Error("Sponsored operation requires a non-zero sponsor and positive reimbursement amount.");
    }
  }

  return {
    network: input.network,
    aaCore: expectedCore,
    paymaster: canonicalPaymaster,
    accountId,
    dappId: normalizedDappId,
    metaInvocation: {
      scriptHash: expectedCore,
      operation: operation as RelayMetaInvocation["operation"],
      args,
    },
    userOp,
    targetContract: details.target,
    targetMethod: details.method,
    nonce: details.nonce,
    deadline: details.deadline,
    signaturePresent: details.signaturePresent,
    sponsored,
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]),
  );
}

async function sha256Text(value: string): Promise<string> {
  const bytes = sha256(new TextEncoder().encode(value));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function prepareRelayReviewPackage(input: PrepareRelayReviewInput): Promise<RelayReviewPackage> {
  const createdAt = input.now ?? Date.now();
  const draft = parseRelayDraft({ ...input, now: createdAt });
  const digestMaterial = {
    version: RELAY_REVIEW_VERSION,
    kind: "aa-relay-review-package" as const,
    network: draft.network,
    aaCore: draft.aaCore,
    accountId: draft.accountId,
    request: {
      aaAddress: draft.accountId,
      metaInvocation: draft.metaInvocation,
      ...(draft.dappId ? { paymaster: { dapp_id: draft.dappId, network: draft.network } } : {}),
    },
  };
  const packageDigest = await sha256Text(JSON.stringify(stable(digestMaterial)));
  const readiness: RelayReviewReadiness = input.preview.state === "blocked"
    ? "blocked"
    : input.preview.state !== "ready"
      ? "needs-chain-preview"
      : !draft.signaturePresent && input.preview.verifierConfigured === true
        ? "needs-authorization"
        : "review-ready";

  return {
    ...digestMaterial,
    jobId: `aa-${packageDigest.slice(2, 14)}`,
    packageDigest,
    createdAt,
    target: {
      contract: draft.targetContract,
      method: draft.targetMethod,
      nonce: draft.nonce,
      deadline: draft.deadline,
    },
    validationPreview: input.preview,
    authorization: {
      required: true,
      signaturePresent: draft.signaturePresent,
      note: draft.signaturePresent
        ? "Signature bytes are packaged but remain subject to the configured verifier."
        : "An authorized external relay must provide the account's required witness or verifier authorization.",
    },
    submission: {
      enabled: false,
      mode: "external-authorized-relay",
      endpoint: RELAY_ENDPOINT,
      reason: "This MiniApp runtime exposes no authenticated relay capability or status endpoint; submission remains external.",
    },
    readiness,
  };
}

export async function hasValidRelayReviewDigest(review: RelayReviewPackage): Promise<boolean> {
  const material = {
    version: review.version,
    kind: review.kind,
    network: review.network,
    aaCore: review.aaCore,
    accountId: review.accountId,
    request: review.request,
  };
  return await sha256Text(JSON.stringify(stable(material))) === review.packageDigest;
}

async function rpcCall<T>(
  network: NeoNetwork,
  method: string,
  params: unknown[],
  fetcher: FetchLike,
): Promise<RpcEnvelope<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(getRpcUrl(network), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC ${response.status}`);
    return await response.json() as RpcEnvelope<T>;
  } finally {
    clearTimeout(timer);
  }
}

function boolStack(value: unknown): boolean | null {
  const parsed = parseStackItem(value);
  return typeof parsed === "boolean" ? parsed : null;
}

export async function previewRelayDraft(
  draft: ParsedRelayDraft,
  fetcher: FetchLike = fetch,
  now = Date.now(),
): Promise<RelayValidationPreview> {
  try {
    const response = await rpcCall<{
      state?: unknown;
      exception?: unknown;
      stack?: Array<{ type?: unknown; value?: unknown }>;
    }>(draft.network, "invokefunction", [
      draft.aaCore,
      "previewUserOpValidation",
      [draft.metaInvocation.args[0], draft.userOp],
    ], fetcher);
    if (response.error || !response.result) {
      return {
        state: "unreachable",
        deadlineValid: null,
        nonceValid: null,
        verifierConfigured: null,
        verifier: "",
        hook: "",
        reason: clean(response.error?.message) || "preview-rpc-error",
        checkedAt: now,
      };
    }
    const vmState = clean(response.result.state).toUpperCase();
    if (vmState.includes("FAULT")) {
      return {
        state: "blocked",
        deadlineValid: null,
        nonceValid: null,
        verifierConfigured: null,
        verifier: "",
        hook: "",
        reason: clean(response.result.exception) || "preview-vm-fault",
        checkedAt: now,
      };
    }
    const root = response.result.stack?.[0];
    const values = root && Array.isArray(root.value) ? root.value : [];
    const deadlineValid = boolStack(values[0]);
    const nonceValid = boolStack(values[1]);
    const verifierConfigured = boolStack(values[2]);
    if (deadlineValid === null || nonceValid === null || verifierConfigured === null) {
      return {
        state: "unreachable",
        deadlineValid,
        nonceValid,
        verifierConfigured,
        verifier: parseHash160(values[3]),
        hook: parseHash160(values[4]),
        reason: "preview-shape-unrecognized",
        checkedAt: now,
      };
    }
    return {
      state: deadlineValid && nonceValid ? "ready" : "blocked",
      deadlineValid,
      nonceValid,
      verifierConfigured,
      verifier: parseHash160(values[3]),
      hook: parseHash160(values[4]),
      reason: !deadlineValid ? "deadline-invalid" : !nonceValid ? "nonce-invalid" : "core-preview-ready",
      checkedAt: now,
    };
  } catch {
    return {
      state: "unreachable",
      deadlineValid: null,
      nonceValid: null,
      verifierConfigured: null,
      verifier: "",
      hook: "",
      reason: "preview-rpc-unreachable",
      checkedAt: now,
    };
  }
}

export function parseRelayReceipt(
  raw: string,
  expected: { network: NeoNetwork; packageDigest: string; now?: number },
): RelayReceipt {
  const source = clean(raw);
  if (!source) throw new Error("Relay receipt JSON is required.");
  if (new TextEncoder().encode(source).length > RELAY_RECEIPT_MAX_BYTES) {
    throw new Error("Relay receipt exceeds the 16 KiB import limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Relay receipt must be valid JSON.");
  }
  const receipt = asRecord(parsed, "Relay receipt");
  const rawNetwork = clean(receipt.network);
  const normalizedNetwork = rawNetwork === "mainnet" || rawNetwork === "neo-n3-mainnet"
    ? "mainnet"
    : rawNetwork === "testnet" || rawNetwork === "neo-n3-testnet"
      ? "testnet"
      : null;
  if (!normalizedNetwork || normalizedNetwork !== expected.network) {
    throw new Error("Relay receipt network does not match the review package.");
  }
  const expectedDigest = normalizeDigest(expected.packageDigest);
  const packageDigest = normalizeDigest(receipt.packageDigest ?? receipt.requestDigest ?? receipt.request_digest);
  if (!expectedDigest || packageDigest !== expectedDigest) {
    throw new Error("Relay receipt is not bound to the current review package digest.");
  }
  const txid = normalizeTxid(receipt.txid ?? receipt.txHash ?? receipt.tx_hash);
  const requestId = clean(receipt.requestId ?? receipt.request_id ?? receipt.id);
  if (requestId.length > 128) throw new Error("Relay receipt request id exceeds 128 characters.");
  const status = clean(receipt.status).toLowerCase();
  if (!txid && (!ACCEPTED_STATUSES.has(status) || requestId.length < 6)) {
    throw new Error("A non-broadcast receipt needs an accepted status and a durable request id.");
  }
  return {
    version: 1,
    network: expected.network,
    packageDigest: expectedDigest,
    status: txid ? "broadcast" : status as RelayReceipt["status"],
    requestId,
    txid,
    receivedAt: expected.now ?? Date.now(),
  };
}

function stackSlots(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value?: unknown }).value;
    return Array.isArray(inner) ? inner : [];
  }
  return [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function matchesUserOpEvent(log: ApplicationLog, review: RelayReviewPackage): boolean {
  return (log.executions ?? []).some((execution) =>
    (execution.notifications ?? []).some((notification) => {
      const contract = normalizeScriptHash(clean(notification.contract));
      const name = clean(notification.eventname ?? notification.event_name);
      if (contract !== normalizeScriptHash(review.aaCore) || name !== "UserOpExecuted") return false;
      const slots = stackSlots(notification.state);
      const account = parseHash160(slots[0]);
      const target = parseHash160(slots[1]);
      const method = clean(parseStackItem(slots[2]));
      const nonce = clean(parseStackItem(slots[3]));
      return account === review.accountId
        && target === review.target.contract
        && method === review.target.method
        && nonce === review.target.nonce;
    }),
  );
}

export async function inspectRelayReceipt(
  review: RelayReviewPackage,
  receipt: RelayReceipt,
  fetcher: FetchLike = fetch,
  now = Date.now(),
): Promise<RelayChainOutcome> {
  if (receipt.network !== review.network || receipt.packageDigest !== review.packageDigest) {
    return { status: "mismatch", txid: receipt.txid, vmState: "", confirmations: 0, blockIndex: 0, reason: "receipt-package-mismatch", checkedAt: now };
  }
  if (!receipt.txid) {
    return { status: "accepted", txid: "", vmState: "", confirmations: 0, blockIndex: 0, reason: "accepted-without-broadcast-proof", checkedAt: now };
  }

  try {
    const [logResponse, txResponse] = await Promise.all([
      rpcCall<ApplicationLog>(review.network, "getapplicationlog", [receipt.txid], fetcher),
      rpcCall<RawTransaction>(review.network, "getrawtransaction", [receipt.txid, true], fetcher),
    ]);
    if (logResponse.error || txResponse.error || !logResponse.result || !txResponse.result) {
      return { status: "pending", txid: receipt.txid, vmState: "", confirmations: 0, blockIndex: 0, reason: "broadcast-not-yet-confirmed", checkedAt: now };
    }
    const executions = logResponse.result.executions ?? [];
    const states = executions.map((execution) => clean(execution.vmstate).toUpperCase()).filter(Boolean);
    const vmState = states.join(",");
    const fault = executions.find((execution) => clean(execution.vmstate).toUpperCase().includes("FAULT"));
    const confirmations = numberValue(txResponse.result.confirmations);
    const blockIndex = numberValue(txResponse.result.blockindex ?? txResponse.result.block_index);
    if (fault) {
      return { status: "fault", txid: receipt.txid, vmState, confirmations, blockIndex, reason: clean(fault.exception) || "vm-fault", checkedAt: now };
    }
    if (!states.length || states.some((state) => !state.includes("HALT"))) {
      return { status: "pending", txid: receipt.txid, vmState, confirmations, blockIndex, reason: "receipt-pending", checkedAt: now };
    }
    if (!matchesUserOpEvent(logResponse.result, review)) {
      return { status: "mismatch", txid: receipt.txid, vmState, confirmations, blockIndex, reason: "userop-event-mismatch", checkedAt: now };
    }
    return { status: "confirmed", txid: receipt.txid, vmState, confirmations, blockIndex, reason: "userop-confirmed", checkedAt: now };
  } catch {
    return { status: "unreachable", txid: receipt.txid, vmState: "", confirmations: 0, blockIndex: 0, reason: "rpc-unreachable", checkedAt: now };
  }
}

export function isRelayReviewPackage(value: unknown, network: NeoNetwork, aaCore: string): value is RelayReviewPackage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const review = value as Partial<RelayReviewPackage>;
  const target = review.target;
  const request = review.request;
  const invocation = request?.metaInvocation;
  return review.version === RELAY_REVIEW_VERSION
    && review.kind === "aa-relay-review-package"
    && review.network === network
    && normalizeHash160(review.aaCore) === normalizeHash160(aaCore)
    && Boolean(normalizeHash160(review.accountId))
    && normalizeHash160(request?.aaAddress) === normalizeHash160(review.accountId)
    && normalizeHash160(invocation?.scriptHash) === normalizeHash160(aaCore)
    && SUPPORTED_OPERATIONS.has(clean(invocation?.operation))
    && Array.isArray(invocation?.args)
    && Boolean(normalizeHash160(target?.contract))
    && METHOD_RE.test(clean(target?.method))
    && INTEGER_RE.test(clean(target?.nonce))
    && INTEGER_RE.test(clean(target?.deadline))
    && Boolean(normalizeDigest(review.packageDigest))
    && clean(review.jobId).startsWith("aa-")
    && ["review-ready", "needs-authorization", "needs-chain-preview", "blocked"].includes(clean(review.readiness))
    && review.submission?.enabled === false;
}

export function isRelayReceipt(value: unknown, review: RelayReviewPackage): value is RelayReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Partial<RelayReceipt>;
  const txid = normalizeTxid(receipt.txid);
  const status = clean(receipt.status);
  return receipt.version === 1
    && receipt.network === review.network
    && receipt.packageDigest === review.packageDigest
    && Number.isFinite(receipt.receivedAt)
    && Number(receipt.receivedAt) > 0
    && (
      (Boolean(txid) && status === "broadcast") ||
      (!txid && ACCEPTED_STATUSES.has(status) && clean(receipt.requestId).length >= 6)
    );
}

export function draftFingerprint(aaAddress: string, dappId: string, payloadJson: string): string {
  return JSON.stringify({ aaAddress: clean(aaAddress), dappId: clean(dappId), payloadJson: clean(payloadJson) });
}
