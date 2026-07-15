/**
 * Production transaction safety for Unbreakable Vault.
 *
 * The deployed contract uses a two-transaction prepaid flow on testnet: a GAS
 * transfer is broadcast first, then the vault operation.  A refresh or indexer
 * outage between those transactions must never make the UI pay twice.  This
 * module persists only the minimum recovery envelope (network, contract,
 * wallet, amounts, ids and the CREATE digest); plaintext secrets are never
 * written to storage.
 */

import type { MiniAppFramework } from "@shared/react";
import { GAS_HASH, getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  addressToScriptHash,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { readVaultDetails, type ChainVaultDetails } from "./vaultChain";

export const VAULT_APP_ID = "miniapp-unbreakablevault";
export const VAULT_EVENT_WAIT_MS = 30_000;

export type VaultNetwork = "mainnet" | "testnet";
export type VaultOperationKind = "create" | "attempt" | "increase" | "reclaim";
export type VaultPendingStage = "payment" | "action";
export type VaultEventName = "VaultCreated" | "AttemptMade" | "BountyIncreased" | "VaultExpired";

export interface VaultChainContext {
  network: VaultNetwork;
  contractHash: string;
}

export interface PendingVaultOperation {
  version: 1;
  kind: VaultOperationKind;
  stage: VaultPendingStage;
  eventName: VaultEventName;
  network: VaultNetwork;
  contractHash: string;
  playerHash: string;
  createdAt: number;
  /** Deterministic schema/corruption checksum; this is not an authenticity proof. */
  binding: string;
  paymentMemo?: "miniapp-unbreakablevault:create" | "miniapp-unbreakablevault:attempt";
  txid?: string;
  paymentTxid?: string;
  vaultId?: string;
  amountFixed8?: string;
  difficulty?: number;
  title?: string;
  description?: string;
  /** SHA-256 digest encoded for the ByteArray argument; never plaintext. */
  secretHashBase64?: string;
  beforeTotalVaults?: string;
  beforeAttempts?: string;
  beforeBounty?: string;
}

export interface VaultTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  event: unknown | null;
}

export interface VaultFinalization {
  pending: PendingVaultOperation;
  vault: ChainVaultDetails;
  vaultId: string;
  broken?: boolean;
  txid: string;
}

export type VaultRecoveryResult =
  | { status: "none" }
  | { status: "pending"; pending: PendingVaultOperation; needsSecret?: boolean }
  | { status: "fault"; pending: PendingVaultOperation }
  | { status: "confirmed"; finalization: VaultFinalization };

/** A confirmed event/readback contradicted the reviewed operation. */
export class VaultVerificationError extends Error {
  readonly code: "PENDING_INVALID" | "EVENT_MISMATCH" | "READBACK_MISMATCH";

  constructor(
    message: string,
    code: "PENDING_INVALID" | "EVENT_MISMATCH" | "READBACK_MISMATCH",
  ) {
    super(message);
    this.name = "VaultVerificationError";
    this.code = code;
  }
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function txid(value: unknown): string {
  const normalized = clean(value).toLowerCase().replace(/^0x/, "");
  return /^[0-9a-f]{64}$/.test(normalized) ? `0x${normalized}` : "";
}

function positiveInteger(value: unknown): string {
  const normalized = clean(value);
  return /^[1-9]\d*$/.test(normalized) ? normalized : "";
}

function fixed8(value: unknown): string {
  const normalized = clean(value);
  return /^\d+$/.test(normalized) && BigInt(normalized) > 0n ? normalized : "";
}

function eventNameFor(kind: VaultOperationKind): VaultEventName {
  if (kind === "create") return "VaultCreated";
  if (kind === "attempt") return "AttemptMade";
  if (kind === "increase") return "BountyIncreased";
  return "VaultExpired";
}

function paymentMemoFor(kind: VaultOperationKind): PendingVaultOperation["paymentMemo"] {
  if (kind === "attempt") return "miniapp-unbreakablevault:attempt";
  if (kind === "create" || kind === "increase") return "miniapp-unbreakablevault:create";
  return undefined;
}

/**
 * Rebuild the persisted recovery checksum.
 *
 * This value only detects accidental edits and stale schema shapes. It is
 * deliberately not treated as a confirmation boundary: a browser user can
 * recompute this string. Transaction correctness therefore comes from
 * canonical chain context, the exact confirmed transfer,
 * the wallet signer, contract-side credit accounting, and event/readback
 * verification.
 */
export function recoveryChecksumFor(
  value: Omit<PendingVaultOperation, "binding" | "stage" | "txid" | "paymentTxid">,
): string {
  return [
    value.version,
    value.kind,
    value.eventName,
    value.network,
    value.contractHash,
    value.playerHash,
    value.createdAt,
    value.paymentMemo ?? "",
    value.vaultId ?? "",
    value.amountFixed8 ?? "",
    value.difficulty ?? "",
    value.title ?? "",
    value.description ?? "",
    value.secretHashBase64 ?? "",
    value.beforeTotalVaults ?? "",
    value.beforeAttempts ?? "",
    value.beforeBounty ?? "",
  ].join("|");
}

function explicitNetwork(value: unknown): VaultNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

function normalizedContract(value: unknown): string {
  const normalized = clean(value).toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(normalized) && !/^0x0{40}$/.test(normalized)
    ? normalized
    : "";
}

function normalizedPlayerHash(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const fromAddress = addressToScriptHash(raw);
  if (/^0x[0-9a-f]{40}$/.test(fromAddress)) return fromAddress.toLowerCase();
  const parsed = parseHash160(raw);
  return /^0x[0-9a-f]{40}$/.test(parsed) ? parsed.toLowerCase() : "";
}

function accountHashCandidates(value: unknown): Set<string> {
  const raw = clean(value);
  const hashes = new Set<string>();
  if (!raw) return hashes;
  if (/^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw)) {
    const fromAddress = addressToScriptHash(raw).toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(fromAddress)) hashes.add(fromAddress);
    return hashes;
  }
  const normalized = raw.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(normalized)) return hashes;
  hashes.add(`0x${normalized}`);
  const reversed = parseHash160(`0x${normalized}`).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(reversed)) hashes.add(reversed);
  return hashes;
}

function accountMatches(value: unknown, playerHash: string): boolean {
  const left = accountHashCandidates(value);
  const right = accountHashCandidates(playerHash);
  return [...left].some((candidate) => right.has(candidate));
}

function booleanSlot(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
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
  if (!state) return null;
  return { state: state.map((item) => ({ value: parseStackItem(item) })) };
}

function endpointFor(network: VaultNetwork): string {
  return `https://api.n3index.dev/${network}`;
}

/** Read a VM outcome and an event bound to the exact target contract. */
export async function readVaultTransactionOutcome(
  network: VaultNetwork,
  targetTxid: string,
  eventName: VaultEventName,
  contractHash: string,
): Promise<VaultTransactionOutcome> {
  if (!txid(targetTxid) || !normalizedContract(contractHash)) {
    return { state: "unknown", event: null };
  }
  try {
    const response = await fetchWithTimeout(endpointFor(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [targetTxid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", event: null };
    const payload = await response.json() as {
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
      error?: unknown;
    };
    if (payload.error) return { state: "unknown", event: null };
    const executions = payload.result?.executions ?? [];
    const vmStates = executions.map((execution) => clean(execution.vmstate).toUpperCase()).filter(Boolean);
    if (vmStates.some((state) => state.includes("FAULT"))) return { state: "fault", event: null };
    if (!(vmStates.length > 0 && vmStates.every((state) => state.includes("HALT")))) {
      return { state: "unknown", event: null };
    }
    const wantedContract = normalizedContract(contractHash);
    const notification = executions
      .flatMap((execution) => execution.notifications ?? [])
      .find((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as { contract?: unknown; eventname?: unknown };
        return clean(record.eventname) === eventName
          && normalizedContract(record.contract) === wantedContract;
      });
    return { state: "halt", event: parsedNotification(notification) };
  } catch {
    return { state: "unknown", event: null };
  }
}

/** Validate the prepaid GAS transfer before resuming without another payment. */
export async function readVaultPaymentOutcome(
  pending: PendingVaultOperation,
): Promise<VaultTransactionOutcome> {
  if (!txid(pending.paymentTxid)) return { state: "unknown", event: null };
  try {
    const response = await fetchWithTimeout(endpointFor(pending.network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [pending.paymentTxid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", event: null };
    const payload = await response.json() as {
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
      error?: unknown;
    };
    if (payload.error) return { state: "unknown", event: null };
    const executions = payload.result?.executions ?? [];
    const vmStates = executions.map((execution) => clean(execution.vmstate).toUpperCase()).filter(Boolean);
    if (vmStates.some((state) => state.includes("FAULT"))) return { state: "fault", event: null };
    if (!(vmStates.length > 0 && vmStates.every((state) => state.includes("HALT")))) {
      return { state: "unknown", event: null };
    }
    const transfer = executions
      .flatMap((execution) => execution.notifications ?? [])
      .find((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as { contract?: unknown; eventname?: unknown };
        if (clean(record.eventname) !== "Transfer") return false;
        const contract = normalizedContract(record.contract);
        // GAS_HASH is already the display-order script hash used by RPC event
        // notifications; compare without reinterpretation.
        if (contract !== normalizedContract(GAS_HASH)) return false;
        const parsed = parsedNotification(item);
        const slots = stateArray(parsed);
        if (!slots) return false;
        const value = (index: number) => {
          const slot = slots[index];
          return slot && typeof slot === "object" && "value" in slot
            ? (slot as { value?: unknown }).value
            : slot;
        };
        return accountMatches(value(0), pending.playerHash)
          && accountMatches(value(1), pending.contractHash)
          && parseBigInt(value(2)) === BigInt(pending.amountFixed8 ?? "0");
      });
    return { state: "halt", event: transfer ? parsedNotification(transfer) : null };
  } catch {
    return { state: "unknown", event: null };
  }
}

export function isPendingVaultOperation(value: unknown): value is PendingVaultOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingVaultOperation> & Record<string, unknown>;
  if ("secret" in pending || "attemptSecret" in pending || "plaintext" in pending) return false;
  const kinds: VaultOperationKind[] = ["create", "attempt", "increase", "reclaim"];
  const stages: VaultPendingStage[] = ["payment", "action"];
  if (
    pending.version !== 1
    || !kinds.includes(pending.kind as VaultOperationKind)
    || !stages.includes(pending.stage as VaultPendingStage)
    || pending.eventName !== eventNameFor(pending.kind as VaultOperationKind)
    || !explicitNetwork(pending.network)
    || !normalizedContract(pending.contractHash)
    || !/^0x[0-9a-f]{40}$/.test(clean(pending.playerHash).toLowerCase())
    || !Number.isSafeInteger(pending.createdAt)
    || Number(pending.createdAt) <= 0
  ) return false;
  const recoveryRecord = { ...pending } as PendingVaultOperation;
  const expectedBinding = recoveryChecksumFor(recoveryRecord);
  if (clean(pending.binding) !== expectedBinding) return false;
  if (pending.paymentMemo !== paymentMemoFor(pending.kind as VaultOperationKind)) return false;
  if (pending.stage === "payment" && !txid(pending.paymentTxid)) return false;
  if (pending.stage === "payment" && pending.kind === "reclaim") return false;
  if (pending.stage === "action" && !txid(pending.txid)) return false;
  if (pending.kind === "create") {
    return Boolean(
      fixed8(pending.amountFixed8)
      && typeof pending.difficulty === "number"
      && [1, 2, 3].includes(pending.difficulty)
      && /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(clean(pending.secretHashBase64))
      && typeof pending.title === "string"
      && pending.title.length <= 100
      && typeof pending.description === "string"
      && pending.description.length <= 300
      && /^(0|[1-9]\d*)$/.test(clean(pending.beforeTotalVaults)),
    );
  }
  if (!positiveInteger(pending.vaultId)) return false;
  if (pending.kind === "attempt") {
    return Boolean(
      fixed8(pending.amountFixed8)
      && /^\d+$/.test(clean(pending.beforeAttempts))
      && /^\d+$/.test(clean(pending.beforeBounty)),
    );
  }
  if (pending.kind === "increase") {
    return Boolean(fixed8(pending.amountFixed8) && /^\d+$/.test(clean(pending.beforeBounty)));
  }
  return /^\d+$/.test(clean(pending.beforeBounty));
}

/** Display-only classification of the read boundary. See {@link probeVaultChainContext}. */
export type VaultChainProbe =
  | { status: "ready"; network: VaultNetwork; contractHash: string }
  | { status: "mismatch" }
  | { status: "awaiting-context" };

/**
 * Classify the chain context for DISPLAY only. This is deliberately not a
 * security gate: requireCanonicalVaultContext below remains the sole read/write
 * boundary and still rejects every case this reports as "awaiting-context".
 *
 * The split exists because a boolean cannot tell two very different situations
 * apart, and the vault used to render both as "Vault locked":
 *   - "mismatch": the host launched us on one network while the wallet reports
 *     another, or the configured contract genuinely disagrees with the
 *     canonical one. That is a real fault and the visitor should be warned.
 *   - "awaiting-context": no network or no contract has been handed to us yet.
 *     Nothing has disagreed with anything — there is simply nothing to compare.
 *     This is the normal pre-wallet first paint and must read as an invitation.
 */
export async function probeVaultChainContext(
  app: MiniAppFramework,
): Promise<VaultChainProbe> {
  const launchNetwork = explicitNetwork(app.platform.launch.network);
  let detectedNetwork: VaultNetwork | "" = "";
  try {
    detectedNetwork = explicitNetwork(await app.chain.detectNetwork?.());
  } catch {
    // Detection unavailable is not a conflict; fall back to the launch network.
  }
  if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) {
    return { status: "mismatch" };
  }
  const network = detectedNetwork || launchNetwork;
  if (!network) return { status: "awaiting-context" };
  const configured = normalizedContract(app.chain.contractAddress?.get?.());
  const expected = normalizedContract(
    getMiniAppContractHash(VAULT_APP_ID, resolveNeoNetwork(network)),
  );
  if (!configured || !expected) return { status: "awaiting-context" };
  if (configured !== expected) return { status: "mismatch" };
  return { status: "ready", network, contractHash: configured };
}

export async function requireCanonicalVaultContext(
  app: MiniAppFramework,
  errorMessage = "chainContextMismatch",
  options: { requireDetectedNetwork?: boolean } = {},
): Promise<VaultChainContext> {
  const launchNetwork = explicitNetwork(app.platform.launch.network);
  let detectedNetwork: VaultNetwork | "" = "";
  try {
    detectedNetwork = explicitNetwork(await app.chain.detectNetwork?.());
  } catch {
    // A signed launch network remains a valid read boundary when detection is
    // temporarily unavailable; unknown+unknown is rejected below.
  }
  if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) {
    throw new Error(errorMessage);
  }
  if (options.requireDetectedNetwork && !detectedNetwork) {
    throw new Error(errorMessage);
  }
  const network = detectedNetwork || launchNetwork;
  if (!network) throw new Error(errorMessage);
  const configured = normalizedContract(app.chain.contractAddress?.get?.());
  const expected = normalizedContract(
    getMiniAppContractHash(VAULT_APP_ID, resolveNeoNetwork(network)),
  );
  if (!configured || !expected || configured !== expected) throw new Error(errorMessage);
  return { network, contractHash: configured };
}

/**
 * Write boundary: the wallet network must be detected (launch metadata alone is
 * insufficient), the contract must be live, and mainnet must have a configured
 * PaymentHub because its ABI consumes settled receipt IDs.
 */
export async function requireWritableVaultContext(
  app: MiniAppFramework,
  t: (key: string) => string,
): Promise<VaultChainContext> {
  const context = await requireCanonicalVaultContext(
    app,
    t("chainContextMismatch"),
    { requireDetectedNetwork: true },
  );
  const paused = await app.chain.readRaw("isPaused", [], {
    scriptHash: context.contractHash,
  });
  const pausedState = booleanSlot(paused);
  if (pausedState === null) throw new Error(t("chainContextMismatch"));
  if (pausedState) throw new Error(t("contractPaused"));
  if (context.network === "mainnet") {
    const paymentHub = await app.chain.readRaw("paymentHub", [], {
      scriptHash: context.contractHash,
    });
    if (!normalizedPlayerHash(paymentHub)) {
      throw new Error(t("paymentHubUnavailable"));
    }
  }
  return context;
}

export function createVaultSafety(
  app: MiniAppFramework,
  t: (key: string) => string,
) {
  const pendingStorageKey = "state/pendingOperation";
  const recoveryStorageHealthy = app.state.atom("isVaultRecoveryStorageHealthy", true);
  let storedPending: unknown = null;
  try {
    storedPending = app.storage.local.get<unknown>(pendingStorageKey, null);
  } catch {
    recoveryStorageHealthy.set(false);
  }
  const pendingOperation = app.state.atom<PendingVaultOperation | null>(
    "pendingOperation",
    isPendingVaultOperation(storedPending) ? storedPending : null,
  );

  const recordsMatch = (
    left: PendingVaultOperation | null,
    right: PendingVaultOperation | null,
  ) => JSON.stringify(left) === JSON.stringify(right);

  const persistPending = (value: PendingVaultOperation | null) => {
    try {
      pendingOperation.set(value);
      app.storage.local.set(pendingStorageKey, value);
      const stored = app.storage.local.get<PendingVaultOperation | null>(
        pendingStorageKey,
        null,
      );
      if (!recordsMatch(stored, value)) throw new Error("storage readback mismatch");
      recoveryStorageHealthy.set(true);
    } catch {
      // Keep the exact in-memory broadcast guard even if durable storage drops
      // the write. The UI can restore this journal before any network recovery.
      if (!recordsMatch(pendingOperation.get(), value)) {
        try { pendingOperation.set(value); } catch { /* preserve current value */ }
      }
      recoveryStorageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const clearPending = () => {
    const existing = pendingOperation.get();
    const missing = `missing-${Date.now()}`;
    try {
      pendingOperation.set(null);
      app.storage.local.delete(pendingStorageKey);
      if (app.storage.local.get<unknown>(pendingStorageKey, missing) !== missing) {
        throw new Error("storage delete readback mismatch");
      }
      recoveryStorageHealthy.set(true);
    } catch {
      if (existing && !recordsMatch(pendingOperation.get(), existing)) {
        try { pendingOperation.set(existing); } catch { /* preserve guard */ }
      }
      recoveryStorageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  if (storedPending !== null && !isPendingVaultOperation(storedPending)) {
    try {
      app.storage.local.delete(pendingStorageKey);
      if (app.storage.local.get<unknown>(pendingStorageKey, null) !== null) {
        throw new Error("invalid journal could not be removed");
      }
      recoveryStorageHealthy.set(true);
    } catch {
      recoveryStorageHealthy.set(false);
    }
  }
  const isRecovering = app.state.atom("isRecoveringVault", false);
  let operationActive = false;

  const beginOperation = () => {
    if (operationActive) throw new Error(t("operationInProgress"));
    operationActive = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      operationActive = false;
    };
  };

  const assertRecoveryStorageAvailable = () => {
    const key = "state/pendingOperationProbe";
    const marker = { version: 1, createdAt: Date.now() };
    try {
      app.storage.local.set(key, marker);
      const stored = app.storage.local.get<typeof marker | null>(key, null);
      app.storage.local.delete(key);
      const removed = app.storage.local.get<unknown>(key, null);
      if (JSON.stringify(stored) !== JSON.stringify(marker) || removed !== null) {
        throw new Error("storage probe mismatch");
      }
      recoveryStorageHealthy.set(true);
    } catch {
      recoveryStorageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const refreshRecoveryStorage = () => {
    const releaseOperation = beginOperation();
    try {
      assertRecoveryStorageAvailable();
      const inMemory = pendingOperation.get();
      if (inMemory) {
        if (!isPendingVaultOperation(inMemory)) {
          clearPending();
          throw new Error(t("pendingInvalid"));
        }
        persistPending(inMemory);
        return inMemory;
      }
      const stored = app.storage.local.get<unknown>(pendingStorageKey, null);
      if (stored === null) {
        recoveryStorageHealthy.set(true);
        return null;
      }
      if (!isPendingVaultOperation(stored)) {
        app.storage.local.delete(pendingStorageKey);
        const removed = app.storage.local.get<unknown>(pendingStorageKey, null);
        if (removed !== null) {
          recoveryStorageHealthy.set(false);
          throw new Error(t("recoveryStorageUnavailable"));
        }
        recoveryStorageHealthy.set(true);
        throw new Error(t("pendingInvalid"));
      }
      pendingOperation.set(stored);
      recoveryStorageHealthy.set(true);
      return stored;
    } finally {
      releaseOperation();
    }
  };

  const assertNoPending = () => {
    if (!recoveryStorageHealthy.get()) throw new Error(t("recoveryStorageUnavailable"));
    if (pendingOperation.get()) throw new Error(t("pendingBlocksWrites"));
  };

  const prepare = async (
    kind: VaultOperationKind,
    player: string,
    details: Omit<Partial<PendingVaultOperation>,
      "version" | "kind" | "stage" | "eventName" | "network" | "contractHash" | "playerHash" | "createdAt" | "binding" | "paymentMemo" | "txid" | "paymentTxid">,
  ): Promise<Omit<PendingVaultOperation, "stage" | "txid" | "paymentTxid">> => {
    const context = await requireWritableVaultContext(app, t);
    assertRecoveryStorageAvailable();
    const playerHash = normalizedPlayerHash(player);
    if (!playerHash) throw new Error(t("walletRequired"));
    const connectedWallet = app.chain.address.get();
    if (!connectedWallet || !accountMatches(connectedWallet, playerHash)) {
      throw new Error(t("operationContextChanged"));
    }
    const base = {
      version: 1,
      kind,
      eventName: eventNameFor(kind),
      network: context.network,
      contractHash: context.contractHash,
      playerHash,
      createdAt: Date.now(),
      ...(paymentMemoFor(kind) ? { paymentMemo: paymentMemoFor(kind) } : {}),
      ...details,
    } as Omit<PendingVaultOperation, "binding" | "stage" | "txid" | "paymentTxid">;
    return { ...base, binding: recoveryChecksumFor(base) };
  };

  const persistPayment = (
    draft: Omit<PendingVaultOperation, "stage" | "txid" | "paymentTxid">,
    paymentTxid: string,
  ) => {
    const id = txid(paymentTxid);
    if (!id) throw new Error(t("invalidTransactionId"));
    persistPending({ ...draft, stage: "payment", paymentTxid: id });
  };

  const persistAction = (
    draft: Omit<PendingVaultOperation, "stage" | "txid" | "paymentTxid">,
    actionTxid: string,
  ) => {
    const id = txid(actionTxid);
    if (!id) throw new Error(t("invalidTransactionId"));
    const existing = pendingOperation.get();
    persistPending({
      ...draft,
      stage: "action",
      txid: id,
      ...(existing?.paymentTxid ? { paymentTxid: existing.paymentTxid } : {}),
    });
  };

  const contextMatches = async (pending: PendingVaultOperation, wallet: string) => {
    const context = await requireCanonicalVaultContext(
      app,
      t("chainContextMismatch"),
      { requireDetectedNetwork: true },
    );
    return context.network === pending.network
      && context.contractHash === pending.contractHash
      && accountMatches(pending.playerHash, normalizedPlayerHash(wallet));
  };

  const eventValue = (event: unknown, index: number) => app.events.value(event, index);
  const verificationError = (
    key: "pendingInvalid" | "eventMismatch" | "readbackMismatch",
  ) => new VaultVerificationError(
    t(key),
    key === "pendingInvalid"
      ? "PENDING_INVALID"
      : key === "eventMismatch"
        ? "EVENT_MISMATCH"
        : "READBACK_MISMATCH",
  );

  const finalize = async (
    pending: PendingVaultOperation,
    event: unknown,
  ): Promise<VaultFinalization> => {
    if (!isPendingVaultOperation(pending)) throw verificationError("pendingInvalid");
    const eventVaultId = positiveInteger(eventValue(event, 0));
    if (!eventVaultId) throw verificationError("eventMismatch");

    if (pending.kind === "create") {
      if (
        !accountMatches(eventValue(event, 1), pending.playerHash)
        || parseBigInt(eventValue(event, 2)) !== BigInt(pending.amountFixed8 ?? "0")
        || Number(eventValue(event, 3)) !== pending.difficulty
        || BigInt(eventVaultId) <= BigInt(pending.beforeTotalVaults ?? "0")
      ) throw verificationError("eventMismatch");
    } else {
      if (eventVaultId !== pending.vaultId) throw verificationError("eventMismatch");
      if (pending.kind === "attempt") {
        const eventAttemptNumber = parseBigInt(eventValue(event, 3));
        if (
          !accountMatches(eventValue(event, 1), pending.playerHash)
          || booleanSlot(eventValue(event, 2)) === null
          || eventAttemptNumber <= BigInt(pending.beforeAttempts ?? "0")
        ) throw verificationError("eventMismatch");
      }
      if (pending.kind === "increase") {
        const expectedTotal = BigInt(pending.beforeBounty ?? "0") + BigInt(pending.amountFixed8 ?? "0");
        if (
          parseBigInt(eventValue(event, 1)) !== BigInt(pending.amountFixed8 ?? "0")
          || parseBigInt(eventValue(event, 2)) < expectedTotal
        ) throw verificationError("eventMismatch");
      }
      if (pending.kind === "reclaim") {
        const expectedRefund = BigInt(pending.beforeBounty ?? "0") * 9_800n / 10_000n;
        if (
          !accountMatches(eventValue(event, 1), pending.playerHash)
          || parseBigInt(eventValue(event, 2)) < expectedRefund
        ) throw verificationError("eventMismatch");
      }
    }

    const vault = await readVaultDetails(app, eventVaultId, pending.contractHash);
    if (!vault || vault.id !== eventVaultId) throw verificationError("readbackMismatch");
    // For attempt/increase the creator may be another player; create/reclaim
    // must bind the authoritative owner readback to the signing wallet.
    if (
      (pending.kind === "create" || pending.kind === "reclaim")
      && !accountMatches(vault.creator, pending.playerHash)
    ) {
      throw verificationError("readbackMismatch");
    }

    let broken: boolean | undefined;
    if (pending.kind === "create") {
      if (
        parseBigInt(vault.bounty) !== BigInt(pending.amountFixed8 ?? "0")
        || vault.difficulty !== pending.difficulty
        || vault.title !== clean(pending.title).slice(0, 100)
        || vault.description !== clean(pending.description).slice(0, 300)
        || vault.status !== "active"
      ) throw verificationError("readbackMismatch");
    }
    if (pending.kind === "attempt") {
      broken = booleanSlot(eventValue(event, 2)) ?? undefined;
      const eventAttemptNumber = parseBigInt(eventValue(event, 3));
      if (parseBigInt(vault.attemptCount) < eventAttemptNumber) {
        throw verificationError("readbackMismatch");
      }
      if (broken) {
        if (!vault.broken || vault.status !== "broken" || !accountMatches(vault.winner, pending.playerHash)) {
          throw verificationError("readbackMismatch");
        }
      } else {
        const expectedBounty = BigInt(pending.beforeBounty ?? "0") + BigInt(pending.amountFixed8 ?? "0");
        if (parseBigInt(vault.bounty) < expectedBounty) throw verificationError("readbackMismatch");
      }
    }
    if (pending.kind === "increase") {
      const eventTotal = parseBigInt(eventValue(event, 2));
      if (parseBigInt(vault.bounty) < eventTotal) throw verificationError("readbackMismatch");
    }
    if (pending.kind === "reclaim") {
      if (!["expired", "reclaimed"].includes(vault.status)) throw verificationError("readbackMismatch");
    }

    clearPending();
    return {
      pending,
      vault,
      vaultId: eventVaultId,
      ...(broken === undefined ? {} : { broken }),
      txid: clean(pending.txid),
    };
  };

  const actionArgs = (pending: PendingVaultOperation, secret?: string) => {
    if (pending.kind === "create") {
      return [
        app.chain.arg.hash160Raw(pending.playerHash),
        app.chain.arg.byteArray(clean(pending.secretHashBase64)),
        app.chain.arg.integer(pending.amountFixed8 ?? "0"),
        app.chain.arg.integer(pending.difficulty ?? 0),
        app.chain.arg.string(clean(pending.title).slice(0, 100)),
        app.chain.arg.string(clean(pending.description).slice(0, 300)),
      ];
    }
    if (pending.kind === "attempt") {
      const normalizedSecret = clean(secret);
      if (!normalizedSecret) throw new Error(t("recoverySecretRequired"));
      return [
        app.chain.arg.integer(pending.vaultId ?? "0"),
        app.chain.arg.hash160Raw(pending.playerHash),
        app.chain.arg.byteArray(utf8ToBase64(normalizedSecret)),
      ];
    }
    if (pending.kind === "increase") {
      return [
        app.chain.arg.integer(pending.vaultId ?? "0"),
        app.chain.arg.integer(pending.amountFixed8 ?? "0"),
      ];
    }
    return [app.chain.arg.integer(pending.vaultId ?? "0")];
  };

  const operationFor = (kind: VaultOperationKind) => {
    if (kind === "create") return "createVault";
    if (kind === "attempt") return "attemptBreak";
    if (kind === "increase") return "increaseBounty";
    return "claimExpiredVault";
  };

  const recover = async (secret?: string): Promise<VaultRecoveryResult> => {
    const pending = pendingOperation.get();
    if (!pending) return { status: "none" };
    if (!recoveryStorageHealthy.get()) {
      throw new Error(t("recoveryStorageUnavailable"));
    }
    if (!isPendingVaultOperation(pending)) {
      clearPending();
      throw new Error(t("pendingInvalid"));
    }
    if (isRecovering.get()) return { status: "pending", pending };
    const releaseOperation = beginOperation();
    isRecovering.set(true);
    try {
      const wallet = await app.chain.ensureWallet();
      if (!(await contextMatches(pending, wallet))) {
        throw new Error(t("pendingContextMismatch"));
      }

      if (pending.stage === "action" && pending.txid) {
        let event = await app.events.waitFor(pending.txid, pending.eventName, VAULT_EVENT_WAIT_MS);
        if (!event) {
          const outcome = await readVaultTransactionOutcome(
            pending.network,
            pending.txid,
            pending.eventName,
            pending.contractHash,
          );
          if (outcome.state === "fault") {
            clearPending();
            return { status: "fault", pending };
          }
          event = outcome.event;
        }
        if (!event) return { status: "pending", pending };
        return { status: "confirmed", finalization: await finalize(pending, event) };
      }

      const payment = await readVaultPaymentOutcome(pending);
      if (payment.state === "fault") {
        clearPending();
        return { status: "fault", pending };
      }
      if (payment.state !== "halt" || !payment.event) {
        return { status: "pending", pending, needsSecret: pending.kind === "attempt" };
      }
      if (pending.kind === "attempt" && !clean(secret)) {
        return { status: "pending", pending, needsSecret: true };
      }

      // Rechecking the exact wallet network, pause state, and payment lane is a
      // pre-broadcast product boundary. An already-broadcast action remains
      // inspectable above even if new writes are temporarily disabled.
      const writeContext = await requireWritableVaultContext(app, t);
      if (
        writeContext.network !== pending.network
        || writeContext.contractHash !== pending.contractHash
      ) throw new Error(t("pendingContextMismatch"));

      const {
        stage: _stage,
        txid: _txid,
        paymentTxid: _paymentTxid,
        ...draft
      } = pending;
      const result = await app.chain.invoke(
        operationFor(pending.kind),
        actionArgs(pending, secret),
        {
          scriptHash: pending.contractHash,
          waitForEvent: pending.eventName,
          waitTimeoutMs: VAULT_EVENT_WAIT_MS,
          onTransactionSent: (id) => persistAction(draft, id),
        },
      );
      // Some wallet adapters return the txid without running the callback. The
      // returned id is equally authoritative and must replace the payment-stage
      // journal before this method can ever be retried.
      if (result.txid) persistAction(draft, result.txid);
      const actionPending = pendingOperation.get();
      if (result.verified === true && result.event && actionPending) {
        return { status: "confirmed", finalization: await finalize(actionPending, result.event) };
      }
      return { status: "pending", pending: actionPending ?? pending };
    } catch (error) {
      if (error instanceof VaultVerificationError) throw error;
      const current = pendingOperation.get();
      if (current?.stage === "action") return {
        status: "pending",
        pending: current,
        needsSecret: pending.kind === "attempt" && !clean(secret),
      };
      throw error;
    } finally {
      isRecovering.set(false);
      releaseOperation();
    }
  };

  return {
    pendingOperation,
    recoveryStorageHealthy,
    isRecovering,
    beginOperation,
    assertNoPending,
    refreshRecoveryStorage,
    prepare,
    persistPayment,
    persistAction,
    finalize,
    recover,
  };
}

function base64FromBytes(bytes: number[]): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

/** UTF-8 attempt encoding. Plaintext exists only in this call stack. */
export function utf8ToBase64(value: string): string {
  const bytes = Array.from(new TextEncoder().encode(value));
  return base64FromBytes(bytes);
}
