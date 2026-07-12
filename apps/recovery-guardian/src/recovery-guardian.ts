import type { MiniAppFramework } from "@shared/react";
import {
  getExternalIntegrationConfig,
  getMiniAppContractHash,
  getNetwork,
  getRpcUrl,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export const RECOVERY_GUARDIAN_APP_ID = "miniapp-recovery-guardian";
export const ZERO_HASH = "0x0000000000000000000000000000000000000000";
export const MIN_RECOVERY_DELAY_MS = 3_600_000;
export const MAX_GUARDIANS = 16;
// The deployed verifier's setupRecovery currently validates the witness of its
// caller-supplied owner but does not bind that owner to AA Core.getBackupOwner.
// Keep first-time activation unavailable until the contract enforces that
// business invariant on chain and the deployment registry is updated.
export const FIRST_TIME_RECOVERY_SETUP_AVAILABLE = false;

export interface RecoveryContext {
  network: NeoNetwork;
  verifierHash: string;
  aaCoreHash: string;
  morpheusOracleHash: string;
}

export interface RecoveryProfileId {
  input: string;
  hex: string;
  base64: string;
  byteLength: number;
  isAAAccountId: boolean;
}

export interface PendingRecoveryState {
  active: boolean;
  newOwner: string;
  recoveryNonce: string;
  approvedCount: number;
  initiatedAt: number;
  executableAt: number;
}

export interface RecoveryProfile {
  sourceNetwork: NeoNetwork;
  configured: boolean;
  aaBindingVerified: boolean;
  aaVerifierHash: string;
  aaBackupOwner: string;
  profileId: RecoveryProfileId;
  owner: string;
  aaContract: string;
  accountAddress: string;
  morpheusOracle: string;
  networkLabel: string;
  accountIdText: string;
  threshold: number;
  timelockMs: number;
  recoveryNonce: string;
  morpheusVerifier: string;
  masterNullifiers: string[];
  pending: PendingRecoveryState;
  checkedAt: string;
}

export interface GuardianSetupPackage {
  profileId: RecoveryProfileId;
  accountIdText: string;
  accountAddress: string;
  guardianCommitments: string[];
  threshold: number;
  timelockMs: number;
  morpheusVerifier: string;
}

export type RecoveryWriteKind = "setup" | "cancel" | "finalize";

export interface PendingRecoveryWrite {
  version: 1;
  kind: RecoveryWriteKind;
  txid: string;
  createdAt: number;
  network: NeoNetwork;
  verifierHash: string;
  profileHex: string;
  actorHash: string;
  beforeOwner: string;
  beforeNonce: string;
  expectedNewOwner?: string;
  accountIdText?: string;
  accountAddress?: string;
  aaCoreHash?: string;
  morpheusOracleHash?: string;
  threshold?: number;
  timelockMs?: number;
  guardianCommitments?: string[];
  morpheusVerifier?: string;
}

export interface RecoveryNotification {
  contract: string;
  eventName: string;
  values: unknown[];
}

export interface RecoveryTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: RecoveryNotification[];
}

export interface RecoveryWorkspaceLinkInput {
  baseUrl: string;
  profile: RecoveryProfile;
  verifierHash: string;
  newOwner: string;
  expiryMinutes: number;
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  const hex = value.replace(/^0x/i, "");
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error("invalidRecoveryProfileId");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function parseRecoveryProfileId(value: unknown): RecoveryProfileId | null {
  const input = clean(value);
  if (!input) return null;
  let bytes: Uint8Array;
  try {
    const rawHex = input.replace(/^0x/i, "");
    const explicitHex = /^0x/i.test(input) || /^[0-9a-fA-F]{40}$/.test(input);
    bytes = explicitHex ? hexToBytes(rawHex) : utf8Bytes(input);
  } catch {
    return null;
  }
  if (bytes.length < 1 || bytes.length > 64) return null;
  const hex = `0x${bytesToHex(bytes)}`;
  return {
    input,
    hex,
    base64: bytesToBase64(bytes),
    byteLength: bytes.length,
    isAAAccountId: bytes.length === 20,
  };
}

export function buildRecoveryWorkspaceUrl(input: RecoveryWorkspaceLinkInput): string {
  if (!input.profile.configured || !input.profile.profileId.isAAAccountId || !input.profile.aaBindingVerified) {
    throw new Error("recoveryAAProfileRequired");
  }
  const verifierHash = normalizeAccount(input.verifierHash);
  const newOwner = normalizeAccount(input.newOwner);
  if (!verifierHash || !newOwner || !normalizeAccount(input.profile.accountAddress)) {
    throw new Error("recoveryWorkspaceInvalid");
  }
  if (!Number.isInteger(input.expiryMinutes) || input.expiryMinutes < 5 || input.expiryMinutes > 1_440) {
    throw new Error("recoveryExpiryInvalid");
  }
  const url = new URL(input.baseUrl);
  url.searchParams.set("accountId", input.profile.profileId.hex);
  url.searchParams.set("account", input.profile.accountAddress);
  url.searchParams.set("recoveryVerifier", verifierHash);
  url.searchParams.set("recoveryNewOwner", newOwner);
  url.searchParams.set("recoveryExpiryMinutes", String(input.expiryMinutes));
  url.searchParams.set("autoPreviewRecovery", "1");
  return url.toString();
}

export function normalizeAccount(value: unknown, allowZero = false): string {
  const raw = clean(value);
  if (!raw) return "";
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    const normalized = raw.toLowerCase();
    return allowZero || normalized !== ZERO_HASH ? normalized : "";
  }
  const fromAddress = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(fromAddress)) {
    const normalized = fromAddress.toLowerCase();
    return allowZero || normalized !== ZERO_HASH ? normalized : "";
  }
  const parsed = parseHash160(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(parsed)) {
    const normalized = parsed.toLowerCase();
    return allowZero || normalized !== ZERO_HASH ? normalized : "";
  }
  return "";
}

function reverseHash(hash: string): string {
  const bytes = hash.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

export function accountsMatch(left: unknown, right: unknown): boolean {
  const variants = (value: unknown) => {
    const set = new Set<string>();
    const normalized = normalizeAccount(value, true);
    if (normalized) {
      set.add(normalized);
      set.add(reverseHash(normalized));
    }
    return set;
  };
  const a = variants(left);
  const b = variants(right);
  return a.size > 0 && b.size > 0 && [...a].some((value) => b.has(value));
}

function positiveInteger(value: unknown): number | null {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function unsignedInteger(value: unknown): number | null {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function decimalInteger(value: unknown): string | null {
  const raw = clean(value);
  if (!/^-?\d+$/.test(raw)) return null;
  try {
    return BigInt(raw).toString();
  } catch {
    return null;
  }
}

function stackInteger(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("type" in value) || !("value" in value)) return null;
  const typed = value as { type?: unknown; value?: unknown };
  if (clean(typed.type) !== "Integer") return null;
  if (typeof typed.value === "number" && !Number.isSafeInteger(typed.value)) return null;
  if (typeof typed.value !== "string" && typeof typed.value !== "number" && typeof typed.value !== "bigint") {
    return null;
  }
  return decimalInteger(typed.value);
}

function stackBoolean(value: unknown): boolean | null {
  if (!value || typeof value !== "object" || !("type" in value) || !("value" in value)) return null;
  const typed = value as { type?: unknown; value?: unknown };
  if (clean(typed.type) !== "Boolean") return null;
  if (typeof typed.value === "boolean") return typed.value;
  if (typeof typed.value === "number") {
    if (typed.value === 0) return false;
    if (typed.value === 1) return true;
    return null;
  }
  const raw = clean(typed.value).toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return null;
}

function fixedHex(value: unknown, byteLength: number): string {
  const raw = clean(value).replace(/^0x/i, "").toLowerCase();
  if (new RegExp(`^[0-9a-f]{${byteLength * 2}}$`).test(raw)) return `0x${raw}`;
  const text = clean(value);
  if (text.length === byteLength && [...text].every((char) => char.charCodeAt(0) <= 0xff)) {
    return `0x${Array.from(text, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("")}`;
  }
  return "";
}

function chainBytesHex(value: unknown): string {
  const raw = clean(value);
  if (/^0x[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0) return raw.toLowerCase();
  if (!raw) return "0x";
  return `0x${bytesToHex(utf8Bytes(raw))}`;
}

function validPublicKey(value: unknown): string {
  const raw = clean(value).replace(/^0x/i, "").toLowerCase();
  return /^(02|03)[0-9a-f]{64}$/.test(raw) ? raw : "";
}

function normalizeSetupAccount(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) return raw.toLowerCase();
  return normalizeAccount(raw);
}

function containsSecretKey(value: unknown, depth = 0): boolean {
  if (depth > 6 || !value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsSecretKey(entry, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(([key, entry]) =>
    /(private.?key|secret|seed|id.?token|password|encrypted.?params)/i.test(key) ||
    containsSecretKey(entry, depth + 1),
  );
}

export function parseGuardianSetupPackage(value: unknown): GuardianSetupPackage {
  let source: unknown = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch {
      throw new Error("setupPackageInvalidJson");
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("setupPackageInvalid");
  }
  const record = source as Record<string, unknown>;
  if (containsSecretKey(record)) throw new Error("setupPackageContainsSecret");

  const profileId = parseRecoveryProfileId(record.profileId ?? record.accountId);
  if (!profileId?.isAAAccountId) throw new Error("setupProfileMustBeAccountId");
  const accountIdText = clean(record.accountIdText ?? profileId.hex);
  if (!accountIdText || utf8Bytes(accountIdText).length > 255) throw new Error("setupAccountIdTextInvalid");
  const accountAddress = normalizeSetupAccount(record.accountAddress);
  if (!accountAddress) throw new Error("setupAccountInvalid");

  const commitmentInput = record.guardianCommitments ?? record.masterNullifiers;
  if (!Array.isArray(commitmentInput)) throw new Error("setupGuardiansInvalid");
  const guardianCommitments = commitmentInput.map((entry) => fixedHex(entry, 32));
  if (
    guardianCommitments.length < 1 || guardianCommitments.length > MAX_GUARDIANS ||
    guardianCommitments.some((entry) => !entry) ||
    new Set(guardianCommitments).size !== guardianCommitments.length
  ) throw new Error("setupGuardiansInvalid");

  const threshold = positiveInteger(record.threshold);
  if (!threshold || threshold > guardianCommitments.length) throw new Error("setupThresholdInvalid");
  const explicitMs = unsignedInteger(record.timelockMs);
  const hours = unsignedInteger(record.timelockHours ?? record.delayHours);
  const timelockMs = explicitMs ?? (hours === null ? null : hours * 3_600_000);
  if (timelockMs === null || timelockMs < MIN_RECOVERY_DELAY_MS || !Number.isSafeInteger(timelockMs)) {
    throw new Error("setupDelayInvalid");
  }
  const morpheusVerifier = validPublicKey(record.morpheusVerifier);
  if (!morpheusVerifier) throw new Error("setupVerifierInvalid");
  return {
    profileId,
    accountIdText,
    accountAddress,
    guardianCommitments,
    threshold,
    timelockMs,
    morpheusVerifier,
  };
}

export async function requireRecoveryContext(app: MiniAppFramework): Promise<RecoveryContext> {
  const launch = explicitNetwork(app.platform.launch.network);
  let detected: NeoNetwork | "" = "";
  try {
    detected = explicitNetwork(await app.chain.detectNetwork());
  } catch {
    // A wallet-free profile read can continue from the explicit launch URL.
  }
  if (launch && detected && launch !== detected) throw new Error("recoveryChainContextMismatch");
  const network = detected || launch || resolveNeoNetwork(getNetwork());
  const integration = getExternalIntegrationConfig(network);
  const verifierHash = normalizeAccount(
    getMiniAppContractHash(RECOVERY_GUARDIAN_APP_ID, network) ||
      integration.contracts.aaSocialRecoveryVerifier,
  );
  const aaCoreHash = normalizeAccount(integration.contracts.aaCore);
  const morpheusOracleHash = normalizeAccount(integration.contracts.morpheusOracle);
  const configured = normalizeAccount(app.chain.contractAddress.get());
  if (
    !verifierHash || !aaCoreHash || !morpheusOracleHash ||
    (configured && configured !== verifierHash)
  ) throw new Error("recoveryChainContextMismatch");
  return { network, verifierHash, aaCoreHash, morpheusOracleHash };
}

interface RpcInvocation {
  id: string;
  operation: string;
  args?: unknown[];
  scriptHash?: string;
}

function invocationPayload(context: RecoveryContext, invocation: RpcInvocation) {
  return {
    jsonrpc: "2.0",
    id: invocation.id,
    method: "invokefunction",
    params: [invocation.scriptHash ?? context.verifierHash, invocation.operation, invocation.args ?? []],
  };
}

function parseRpcResult(value: unknown): unknown {
  if (!value || typeof value !== "object") throw new Error("recoveryReadMalformed");
  const record = value as {
    error?: unknown;
    result?: { state?: unknown; stack?: unknown[] };
  };
  if (record.error || clean(record.result?.state).toUpperCase() !== "HALT") {
    throw new Error("recoveryReadFailed");
  }
  if (!Array.isArray(record.result?.stack) || record.result!.stack!.length !== 1) {
    throw new Error("recoveryReadMalformed");
  }
  // Keep the typed item intact until the field-specific decoder runs. Hash160
  // ByteStrings need byte-order normalization, while strings/integers/arrays
  // use the generic stack decoder.
  return record.result!.stack![0];
}

async function readBatch(
  context: RecoveryContext,
  profileId: RecoveryProfileId,
  operations: string[],
): Promise<Map<string, unknown>> {
  const invocations: RpcInvocation[] = operations.map((operation) => ({
    id: operation,
    operation,
    args: [{ type: "ByteArray", value: profileId.base64 }],
  }));
  if (profileId.isAAAccountId) {
    invocations.push({
      id: "aaVerifier",
      operation: "getVerifier",
      scriptHash: context.aaCoreHash,
      args: [{ type: "Hash160", value: profileId.hex }],
    });
    invocations.push({
      id: "aaBackupOwner",
      operation: "getBackupOwner",
      scriptHash: context.aaCoreHash,
      args: [{ type: "Hash160", value: profileId.hex }],
    });
  }
  const response = await fetchWithTimeout(getRpcUrl(context.network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invocations.map((invocation) => invocationPayload(context, invocation))),
    timeoutMs: 15_000,
  });
  if (!response.ok) throw new Error("recoveryReadUnavailable");
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("recoveryReadMalformed");
  const byId = new Map(body.map((entry) => [clean((entry as { id?: unknown }).id), entry]));
  const result = new Map<string, unknown>();
  for (const invocation of invocations) {
    result.set(invocation.id, parseRpcResult(byId.get(invocation.id)));
  }
  return result;
}

function exactInteger(reads: Map<string, unknown>, key: string): string {
  const value = stackInteger(reads.get(key));
  if (value === null) throw new Error("recoveryReadMalformed");
  return value;
}

function exactUnsignedNumber(reads: Map<string, unknown>, key: string): number {
  const exact = stackInteger(reads.get(key));
  if (exact === null) throw new Error("recoveryReadMalformed");
  const value = BigInt(exact);
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("recoveryReadMalformed");
  return Number(value);
}

function exactHash(reads: Map<string, unknown>, key: string, allowZero = false): string {
  const raw = reads.get(key);
  const chainHash = parseHash160(raw).toLowerCase();
  const value = /^0x[0-9a-f]{40}$/.test(chainHash)
    ? allowZero || chainHash !== ZERO_HASH ? chainHash : ""
    : normalizeAccount(parseStackItem(raw), allowZero);
  if (!value) throw new Error("recoveryReadMalformed");
  return value;
}

function parsePending(value: unknown): PendingRecoveryState {
  const rawValues = value && typeof value === "object" && "value" in value &&
    Array.isArray((value as { value?: unknown }).value)
    ? (value as { value: unknown[] }).value
    : [];
  if (rawValues.length !== 6) throw new Error("recoveryReadMalformed");
  const active = stackBoolean(rawValues[5]);
  const recoveryNonce = stackInteger(rawValues[1]);
  const approvedExact = stackInteger(rawValues[2]);
  const initiatedExact = stackInteger(rawValues[3]);
  const executableExact = stackInteger(rawValues[4]);
  if (
    active === null || recoveryNonce === null || approvedExact === null ||
    initiatedExact === null || executableExact === null
  ) throw new Error("recoveryReadMalformed");
  const approvedBig = BigInt(approvedExact);
  const initiatedBig = BigInt(initiatedExact);
  const executableBig = BigInt(executableExact);
  if (
    approvedBig < 0n || approvedBig > BigInt(Number.MAX_SAFE_INTEGER) ||
    initiatedBig < 0n || initiatedBig > BigInt(Number.MAX_SAFE_INTEGER) ||
    executableBig < 0n || executableBig > BigInt(Number.MAX_SAFE_INTEGER)
  ) throw new Error("recoveryReadMalformed");
  const approvedCount = Number(approvedBig);
  const initiatedAt = Number(initiatedBig);
  const executableAt = Number(executableBig);
  const rawOwner = rawValues[0];
  const parsedChainOwner = rawOwner ? parseHash160(rawOwner).toLowerCase() : "";
  const newOwner = /^0x[0-9a-f]{40}$/.test(parsedChainOwner)
    ? parsedChainOwner
    : normalizeAccount(parseStackItem(rawOwner), true);
  if (!newOwner) throw new Error("recoveryReadMalformed");
  if (!active) {
    if (
      newOwner !== ZERO_HASH || recoveryNonce !== "-1" || approvedCount !== 0 ||
      initiatedAt !== 0 || executableAt !== 0
    ) throw new Error("recoveryReadInconsistent");
    return { active, newOwner: "", recoveryNonce, approvedCount, initiatedAt, executableAt };
  }
  if (newOwner === ZERO_HASH || BigInt(recoveryNonce) < 0n || approvedCount < 1 || initiatedAt < 1) {
    throw new Error("recoveryReadInconsistent");
  }
  return { active, newOwner, recoveryNonce, approvedCount, initiatedAt, executableAt };
}

export async function readRecoveryProfile(
  context: RecoveryContext,
  profileId: RecoveryProfileId,
): Promise<RecoveryProfile> {
  const operations = [
    "getOwner",
    "getAAContract",
    "getAccountAddress",
    "getMorpheusOracle",
    "getNetwork",
    "getAccountIdText",
    "getThreshold",
    "getTimelock",
    "getRecoveryNonce",
    "getMorpheusVerifier",
    "getMasterNullifiers",
    "getPendingRecovery",
  ];
  const reads = await readBatch(context, profileId, operations);
  const owner = exactHash(reads, "getOwner", true);
  const aaContract = exactHash(reads, "getAAContract", true);
  const accountAddress = exactHash(reads, "getAccountAddress", true);
  const morpheusOracle = exactHash(reads, "getMorpheusOracle", true);
  const networkLabel = clean(parseStackItem(reads.get("getNetwork")));
  const accountIdText = clean(parseStackItem(reads.get("getAccountIdText")));
  const threshold = exactUnsignedNumber(reads, "getThreshold");
  const timelockMs = exactUnsignedNumber(reads, "getTimelock");
  const recoveryNonce = exactInteger(reads, "getRecoveryNonce");
  const morpheusVerifier = validPublicKey(parseStackItem(reads.get("getMorpheusVerifier")));
  const commitmentsValue = parseStackItem(reads.get("getMasterNullifiers"));
  if (!Array.isArray(commitmentsValue)) throw new Error("recoveryReadMalformed");
  const masterNullifiers = commitmentsValue.map((value) => fixedHex(value, 32));
  if (masterNullifiers.some((value) => !value)) throw new Error("recoveryReadMalformed");
  const pending = parsePending(reads.get("getPendingRecovery"));
  const aaVerifierHash = profileId.isAAAccountId ? exactHash(reads, "aaVerifier", true) : "";
  const aaBackupOwner = profileId.isAAAccountId ? exactHash(reads, "aaBackupOwner", true) : "";
  const aaBindingVerified = profileId.isAAAccountId
    ? aaBackupOwner !== ZERO_HASH &&
      accountsMatch(aaVerifierHash, context.verifierHash) &&
      // Configured legacy profiles must also bind the verifier's controlling
      // owner to AA Core's canonical backup owner. Merely finding the expected
      // verifier address is not enough when old setupRecovery accepted a
      // caller-supplied owner.
      (owner === ZERO_HASH || accountsMatch(owner, aaBackupOwner))
    : false;

  const empty = owner === ZERO_HASH;
  if (empty) {
    const consistentlyEmpty =
      aaContract === ZERO_HASH && accountAddress === ZERO_HASH && morpheusOracle === ZERO_HASH &&
      !networkLabel && !accountIdText && threshold === 0 && timelockMs === 0 &&
      recoveryNonce === "0" && !morpheusVerifier && masterNullifiers.length === 0 && !pending.active;
    if (!consistentlyEmpty) throw new Error("recoveryReadInconsistent");
    return {
      sourceNetwork: context.network,
      configured: false,
      aaBindingVerified,
      aaVerifierHash: aaVerifierHash === ZERO_HASH ? "" : aaVerifierHash,
      aaBackupOwner: aaBackupOwner === ZERO_HASH ? "" : aaBackupOwner,
      profileId,
      owner: "",
      aaContract: "",
      accountAddress: "",
      morpheusOracle: "",
      networkLabel: "",
      accountIdText: "",
      threshold: 0,
      timelockMs: 0,
      recoveryNonce,
      morpheusVerifier: "",
      masterNullifiers: [],
      pending,
      checkedAt: new Date().toISOString(),
    };
  }

  if (
    aaContract === ZERO_HASH || accountAddress === ZERO_HASH || morpheusOracle === ZERO_HASH ||
    networkLabel !== "neo_n3" || !accountIdText || threshold < 1 || threshold > masterNullifiers.length ||
    masterNullifiers.length < 1 || masterNullifiers.length > MAX_GUARDIANS ||
    new Set(masterNullifiers).size !== masterNullifiers.length ||
    !accountsMatch(aaContract, context.aaCoreHash) ||
    !accountsMatch(morpheusOracle, context.morpheusOracleHash) ||
    !morpheusVerifier || BigInt(recoveryNonce) < 0n
  ) throw new Error("recoveryReadInconsistent");
  if (pending.active) {
    if (
      pending.recoveryNonce !== recoveryNonce || pending.approvedCount > threshold ||
      (pending.approvedCount < threshold && pending.executableAt !== 0) ||
      (pending.approvedCount === threshold && pending.executableAt < pending.initiatedAt)
    ) throw new Error("recoveryReadInconsistent");
  }
  return {
    sourceNetwork: context.network,
    configured: true,
    aaBindingVerified,
    aaVerifierHash: aaVerifierHash === ZERO_HASH ? "" : aaVerifierHash,
    aaBackupOwner: aaBackupOwner === ZERO_HASH ? "" : aaBackupOwner,
    profileId,
    owner,
    aaContract,
    accountAddress,
    morpheusOracle,
    networkLabel,
    accountIdText,
    threshold,
    timelockMs,
    recoveryNonce,
    morpheusVerifier,
    masterNullifiers,
    pending,
    checkedAt: new Date().toISOString(),
  };
}

function notificationState(value: unknown): unknown[] | null {
  if (!value || typeof value !== "object") return null;
  const state = (value as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const nested = (state as { value?: unknown }).value;
    return Array.isArray(nested) ? nested : null;
  }
  return null;
}

function parseNotification(value: unknown): RecoveryNotification | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { contract?: unknown; eventname?: unknown };
  const contract = normalizeAccount(record.contract);
  const eventName = clean(record.eventname);
  const state = notificationState(value);
  if (!contract || !eventName || !state) return null;
  return { contract, eventName, values: state.map(parseStackItem) };
}

function validTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(clean(value));
}

export function isPendingRecoveryWrite(value: unknown): value is PendingRecoveryWrite {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingRecoveryWrite>;
  if (
    pending.version !== 1 || !["setup", "cancel", "finalize"].includes(clean(pending.kind)) ||
    !validTxid(pending.txid) || !Number.isFinite(pending.createdAt) || Number(pending.createdAt) <= 0 ||
    !explicitNetwork(pending.network) || !normalizeAccount(pending.verifierHash) ||
    !parseRecoveryProfileId(pending.profileHex)?.isAAAccountId ||
    !normalizeAccount(pending.actorHash) || !normalizeAccount(pending.beforeOwner) ||
    decimalInteger(pending.beforeNonce) === null || BigInt(decimalInteger(pending.beforeNonce)!) < 0n
  ) return false;
  if (pending.kind === "setup") {
    const commitments = Array.isArray(pending.guardianCommitments)
      ? pending.guardianCommitments.map((entry) => fixedHex(entry, 32))
      : [];
    const threshold = positiveInteger(pending.threshold);
    const timelockMs = unsignedInteger(pending.timelockMs);
    return Boolean(
      clean(pending.accountIdText) && utf8Bytes(clean(pending.accountIdText)).length <= 255 &&
      normalizeAccount(pending.accountAddress) && accountsMatch(pending.actorHash, pending.beforeOwner) &&
      pending.beforeNonce === "0" &&
      normalizeAccount(pending.aaCoreHash) && normalizeAccount(pending.morpheusOracleHash) &&
      threshold && threshold <= commitments.length && timelockMs !== null && timelockMs >= MIN_RECOVERY_DELAY_MS &&
      commitments.length > 0 && commitments.length <= MAX_GUARDIANS &&
      commitments.every(Boolean) && new Set(commitments).size === commitments.length &&
      validPublicKey(pending.morpheusVerifier)
    );
  }
  if (pending.kind === "finalize") {
    return Boolean(
      normalizeAccount(pending.expectedNewOwner) &&
      accountsMatch(pending.actorHash, pending.expectedNewOwner),
    );
  }
  return accountsMatch(pending.actorHash, pending.beforeOwner);
}

export async function readRecoveryTransactionOutcome(
  pending: PendingRecoveryWrite,
): Promise<RecoveryTransactionOutcome> {
  if (!isPendingRecoveryWrite(pending)) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(getRpcUrl(pending.network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [pending.txid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", notifications: [] };
    const body = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (body.error) return { state: "unknown", notifications: [] };
    const executions = body.result?.executions ?? [];
    const states = executions.map((entry) => clean(entry.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return { state: "fault", notifications: [] };
    if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) {
      return { state: "unknown", notifications: [] };
    }
    return {
      state: "halt",
      notifications: executions.flatMap((entry) => entry.notifications ?? [])
        .map(parseNotification)
        .filter((entry): entry is RecoveryNotification => entry !== null),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

export async function waitForRecoveryTransactionOutcome(
  pending: PendingRecoveryWrite,
  attempts = 12,
  delayMs = 2_500,
): Promise<RecoveryTransactionOutcome> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await readRecoveryTransactionOutcome(pending);
    if (outcome.state !== "unknown") return outcome;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { state: "unknown", notifications: [] };
}

function findEvent(
  outcome: RecoveryTransactionOutcome,
  pending: PendingRecoveryWrite,
  eventName: string,
): RecoveryNotification | null {
  return outcome.notifications.find((notification) =>
    notification.eventName === eventName && accountsMatch(notification.contract, pending.verifierHash),
  ) ?? null;
}

function eventInteger(value: unknown): string {
  return decimalInteger(value) ?? "";
}

export async function verifyRecoveryWrite(
  pending: PendingRecoveryWrite,
  outcome: RecoveryTransactionOutcome,
): Promise<RecoveryProfile> {
  if (!isPendingRecoveryWrite(pending) || outcome.state !== "halt") {
    throw new Error("recoveryConfirmationMissing");
  }
  const context: RecoveryContext = {
    network: pending.network,
    verifierHash: pending.verifierHash,
    aaCoreHash: pending.aaCoreHash || getExternalIntegrationConfig(pending.network).contracts.aaCore,
    morpheusOracleHash: pending.morpheusOracleHash || getExternalIntegrationConfig(pending.network).contracts.morpheusOracle,
  };
  const profileId = parseRecoveryProfileId(pending.profileHex);
  if (!profileId) throw new Error("recoveryConfirmationMissing");
  const expectedHex = profileId.hex;
  const profile = await readRecoveryProfile(context, profileId);

  if (pending.kind === "setup") {
    const event = findEvent(outcome, pending, "RecoverySetup");
    if (
      !event || event.values.length !== 5 || chainBytesHex(event.values[0]) !== expectedHex ||
      !accountsMatch(event.values[1], pending.actorHash) ||
      eventInteger(event.values[2]) !== String(pending.threshold) ||
      eventInteger(event.values[3]) !== String(pending.timelockMs) ||
      eventInteger(event.values[4]) !== String(pending.guardianCommitments?.length ?? 0)
    ) throw new Error("recoveryEventMismatch");
    if (
      !profile.configured || !accountsMatch(profile.owner, pending.actorHash) ||
      !accountsMatch(profile.aaContract, pending.aaCoreHash) ||
      !accountsMatch(profile.accountAddress, pending.accountAddress) ||
      !accountsMatch(profile.morpheusOracle, pending.morpheusOracleHash) ||
      profile.networkLabel !== "neo_n3" || profile.accountIdText !== pending.accountIdText ||
      profile.threshold !== pending.threshold || profile.timelockMs !== pending.timelockMs ||
      profile.recoveryNonce !== "0" || profile.pending.active ||
      profile.morpheusVerifier !== validPublicKey(pending.morpheusVerifier) ||
      JSON.stringify(profile.masterNullifiers) !== JSON.stringify(pending.guardianCommitments)
    ) throw new Error("recoveryReadbackMismatch");
    return profile;
  }

  if (pending.kind === "cancel") {
    const event = findEvent(outcome, pending, "RecoveryCancelled");
    if (
      !event || event.values.length !== 2 || chainBytesHex(event.values[0]) !== expectedHex ||
      eventInteger(event.values[1]) !== pending.beforeNonce
    ) throw new Error("recoveryEventMismatch");
    if (
      !profile.configured || profile.pending.active || !accountsMatch(profile.owner, pending.beforeOwner) ||
      BigInt(profile.recoveryNonce) !== BigInt(pending.beforeNonce) + 1n
    ) throw new Error("recoveryReadbackMismatch");
    return profile;
  }

  const event = findEvent(outcome, pending, "RecoveryFinalized");
  if (
    !event || event.values.length !== 4 || chainBytesHex(event.values[0]) !== expectedHex ||
    !accountsMatch(event.values[1], pending.beforeOwner) ||
    !accountsMatch(event.values[2], pending.expectedNewOwner) ||
    eventInteger(event.values[3]) !== (BigInt(pending.beforeNonce) + 1n).toString()
  ) throw new Error("recoveryEventMismatch");
  if (
    !profile.configured || profile.pending.active || !accountsMatch(profile.owner, pending.expectedNewOwner) ||
    profile.recoveryNonce !== (BigInt(pending.beforeNonce) + 1n).toString()
  ) throw new Error("recoveryReadbackMismatch");
  return profile;
}
