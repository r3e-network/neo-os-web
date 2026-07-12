/**
 * Durable transaction evidence for Breakup Contract.
 *
 * A wallet callback proves only that a transaction was broadcast.  A pending
 * record is terminal only when the exact transaction application log proves a
 * VM FAULT, or when it proves HALT with the expected contract event and a fresh
 * contract read confirms the same transition.
 */
import type { MiniAppFramework } from "@shared/react";
import {
  GAS_HASH,
  getExternalIntegrationConfig,
  getMiniAppContractHash,
} from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { ownerMatchesAddress, parseHash160, parseStackItem } from "@shared/utils/neo";

export const BREAKUP_APP_ID = "miniapp-breakupcontract";
export const BREAKUP_PENDING_STORE_KEY = "pending-actions";

export type BreakupNetwork = "mainnet" | "testnet";
export type BreakupPendingKind =
  | "deposit-create"
  | "create"
  | "deposit-sign"
  | "sign"
  | "cancel"
  | "break"
  | "settle"
  | "withdraw";

export type BreakupEventName =
  | "Credited"
  | "PactCreated"
  | "PactSigned"
  | "PactCancelled"
  | "PactBroken"
  | "PactSettled"
  | "CreditWithdrawn";

export interface PendingBreakupAction {
  version: 2;
  kind: BreakupPendingKind;
  eventName: BreakupEventName;
  network: BreakupNetwork;
  contractHash: string;
  walletHash: string;
  txid: string;
  createdAt: number;
  pactId?: string;
  beforePactId?: string;
  party1Hash?: string;
  party2Hash?: string;
  beneficiaryHash?: string;
  stakeRaw?: string;
  amountRaw?: string;
  beforeCreditRaw?: string;
  requiredCreditRaw?: string;
  durationSeconds?: number;
  assetHash?: string;
  memo?: string;
  title?: string;
  terms?: string;
}

export interface BreakupNotification {
  contract: string;
  eventName: string;
  values: unknown[];
}

export interface BreakupTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: BreakupNotification[];
}

export interface BreakupChainContext {
  network: BreakupNetwork;
  contractHash: string;
}

const HASH160_PATTERN = /^0x[0-9a-f]{40}$/;
const TXID_PATTERN = /^0x[0-9a-f]{64}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const UNSIGNED_INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/;
const MIN_DURATION_SECONDS = 30 * 86_400;
const MAX_DURATION_SECONDS = 3650 * 86_400;

const clean = (value: unknown): string => String(value ?? "").trim();

/** Strict decimal parser: unavailable/malformed values never become zero. */
export function parseBreakupInteger(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) ? BigInt(value) : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^-?(?:0|[1-9]\d*)$/.test(normalized)) return null;
    try { return BigInt(normalized); } catch { return null; }
  }
  if (value && typeof value === "object" && "value" in value) {
    return parseBreakupInteger((value as { value?: unknown }).value);
  }
  return null;
}

export function explicitBreakupNetwork(value: unknown): BreakupNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function normalizeBreakupHash(value: unknown): string {
  const normalized = clean(value).toLowerCase();
  return HASH160_PATTERN.test(normalized) && !/^0x0{40}$/.test(normalized)
    ? normalized
    : "";
}

export function normalizeBreakupTxid(value: unknown): string {
  const normalized = clean(value).toLowerCase().replace(/^0x/, "");
  const prefixed = `0x${normalized}`;
  return TXID_PATTERN.test(prefixed) ? prefixed : "";
}

export function eventNameForBreakupKind(kind: BreakupPendingKind): BreakupEventName {
  if (kind === "deposit-create" || kind === "deposit-sign") return "Credited";
  if (kind === "create") return "PactCreated";
  if (kind === "sign") return "PactSigned";
  if (kind === "cancel") return "PactCancelled";
  if (kind === "break") return "PactBroken";
  if (kind === "settle") return "PactSettled";
  return "CreditWithdrawn";
}

function positiveInteger(value: unknown): string {
  const normalized = clean(value);
  return POSITIVE_INTEGER_PATTERN.test(normalized) ? normalized : "";
}

function unsignedInteger(value: unknown): string {
  const normalized = clean(value);
  return UNSIGNED_INTEGER_PATTERN.test(normalized) ? normalized : "";
}

function accountMatches(value: unknown, expectedHash: string): boolean {
  const expected = normalizeBreakupHash(expectedHash);
  const raw = clean(value);
  if (!expected || !raw) return false;
  if (normalizeBreakupHash(raw) === expected) return true;
  if (ownerMatchesAddress(raw, expected)) return true;
  return normalizeBreakupHash(parseHash160(raw)) === expected;
}

function integerMatches(value: unknown, expected: string): boolean {
  return parseBreakupInteger(value)?.toString() === expected;
}

function integerValue(value: unknown): bigint | null {
  return parseBreakupInteger(value);
}

export function isPendingBreakupAction(value: unknown): value is PendingBreakupAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingBreakupAction>;
  const kinds: BreakupPendingKind[] = [
    "deposit-create",
    "create",
    "deposit-sign",
    "sign",
    "cancel",
    "break",
    "settle",
    "withdraw",
  ];
  if (
    pending.version !== 2 ||
    !kinds.includes(pending.kind as BreakupPendingKind) ||
    pending.eventName !== eventNameForBreakupKind(pending.kind as BreakupPendingKind) ||
    (pending.network !== "mainnet" && pending.network !== "testnet") ||
    normalizeBreakupHash(pending.contractHash) !== pending.contractHash ||
    normalizeBreakupHash(pending.walletHash) !== pending.walletHash ||
    normalizeBreakupTxid(pending.txid) !== pending.txid ||
    !Number.isSafeInteger(pending.createdAt) ||
    Number(pending.createdAt) <= 0
  ) return false;

  const stake = positiveInteger(pending.stakeRaw);
  if (pending.kind === "deposit-create" || pending.kind === "deposit-sign") {
    const amount = positiveInteger(pending.amountRaw);
    const before = unsignedInteger(pending.beforeCreditRaw);
    const required = positiveInteger(pending.requiredCreditRaw);
    if (!stake || !amount || !before || !required) return false;
    if (BigInt(before) + BigInt(amount) !== BigInt(required) || BigInt(required) !== BigInt(stake)) return false;
    if (normalizeBreakupHash(pending.assetHash) !== GAS_HASH || pending.memo !== "miniapp-breakup:stake") return false;
    return pending.kind === "deposit-create" || Boolean(positiveInteger(pending.pactId));
  }

  if (pending.kind === "create") {
    return Boolean(
      stake &&
      unsignedInteger(pending.beforePactId) &&
      normalizeBreakupHash(pending.party2Hash) &&
      Number.isSafeInteger(pending.durationSeconds) &&
      Number(pending.durationSeconds) >= MIN_DURATION_SECONDS &&
      Number(pending.durationSeconds) <= MAX_DURATION_SECONDS &&
      typeof pending.title === "string" &&
      pending.title === pending.title.trim() &&
      clean(pending.title).length > 0 &&
      clean(pending.title).length <= 100 &&
      typeof pending.terms === "string" &&
      pending.terms === pending.terms.trim() &&
      clean(pending.terms).length <= 2000
    );
  }

  if (pending.kind === "withdraw") return Boolean(positiveInteger(pending.beforeCreditRaw));

  if (
    !positiveInteger(pending.pactId) ||
    !stake ||
    !normalizeBreakupHash(pending.party1Hash) ||
    !normalizeBreakupHash(pending.party2Hash)
  ) return false;
  if (pending.kind === "break") return Boolean(normalizeBreakupHash(pending.beneficiaryHash));
  return true;
}

function notificationState(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const values = (state as { value?: unknown }).value;
    return Array.isArray(values) ? values : null;
  }
  return null;
}

function parseNotification(notification: unknown): BreakupNotification | null {
  if (!notification || typeof notification !== "object") return null;
  const record = notification as { contract?: unknown; eventname?: unknown; event_name?: unknown };
  const contract = normalizeBreakupHash(record.contract);
  const eventName = clean(record.eventname ?? record.event_name);
  const state = notificationState(notification);
  if (!contract || !eventName || !state) return null;
  return {
    contract,
    eventName,
    values: state.map((entry) => {
      if (entry && typeof entry === "object" && !("type" in entry) && "value" in entry) {
        return (entry as { value?: unknown }).value;
      }
      return parseStackItem(entry);
    }),
  };
}

export function parseBreakupApplicationLog(payload: unknown): BreakupTransactionOutcome {
  if (!payload || typeof payload !== "object") return { state: "unknown", notifications: [] };
  const response = payload as {
    error?: unknown;
    result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
  };
  if (response.error) return { state: "unknown", notifications: [] };
  const executions = response.result?.executions ?? [];
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
      .filter((entry): entry is BreakupNotification => entry !== null),
  };
}

export async function readBreakupTransactionOutcome(
  pending: PendingBreakupAction,
): Promise<BreakupTransactionOutcome> {
  if (!isPendingBreakupAction(pending)) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(getExternalIntegrationConfig(pending.network).rpcUrl, {
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
    return parseBreakupApplicationLog(await response.json());
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

/** Return the one exact target-contract event that matches the persisted intent. */
export function findMatchingBreakupEvent(
  pending: PendingBreakupAction,
  outcome: BreakupTransactionOutcome,
): BreakupNotification | null {
  if (!isPendingBreakupAction(pending) || outcome.state !== "halt") return null;
  return outcome.notifications.find((notification) => {
    if (
      notification.contract !== pending.contractHash ||
      notification.eventName !== pending.eventName
    ) return false;
    const value = notification.values;
    if (pending.kind === "deposit-create" || pending.kind === "deposit-sign") {
      return accountMatches(value[0], pending.walletHash) &&
        integerMatches(value[1], pending.amountRaw ?? "") &&
        integerMatches(value[2], pending.requiredCreditRaw ?? "");
    }
    if (pending.kind === "create") {
      const id = integerValue(value[0]);
      const before = BigInt(pending.beforePactId ?? "0");
      const endTime = integerValue(value[4]);
      return id !== null && id > before &&
        accountMatches(value[1], pending.walletHash) &&
        accountMatches(value[2], pending.party2Hash ?? "") &&
        integerMatches(value[3], pending.stakeRaw ?? "") &&
        endTime !== null && endTime > 0n;
    }
    if (pending.kind === "sign") {
      return integerMatches(value[0], pending.pactId ?? "") &&
        accountMatches(value[1], pending.walletHash);
    }
    if (pending.kind === "cancel") {
      return integerMatches(value[0], pending.pactId ?? "") &&
        accountMatches(value[1], pending.walletHash) &&
        integerMatches(value[2], pending.stakeRaw ?? "");
    }
    if (pending.kind === "break") {
      return integerMatches(value[0], pending.pactId ?? "") &&
        accountMatches(value[1], pending.walletHash) &&
        accountMatches(value[2], pending.beneficiaryHash ?? "") &&
        integerMatches(value[3], (BigInt(pending.stakeRaw ?? "0") * 2n).toString());
    }
    if (pending.kind === "settle") {
      return integerMatches(value[0], pending.pactId ?? "") &&
        integerMatches(value[1], pending.stakeRaw ?? "");
    }
    return accountMatches(value[0], pending.walletHash) &&
      integerMatches(value[1], pending.beforeCreditRaw ?? "");
  }) ?? null;
}

export function classifyBreakupConfirmation(
  outcomeState: BreakupTransactionOutcome["state"],
  exactEvent: boolean,
  authoritativeReadback: boolean,
): "fault" | "confirmed" | "pending" {
  if (outcomeState === "fault") return "fault";
  if (outcomeState === "halt" && exactEvent && authoritativeReadback) return "confirmed";
  return "pending";
}

export async function requireCanonicalBreakupContext(
  app: MiniAppFramework,
  errorMessage: string,
  requireDetectedNetwork = false,
): Promise<BreakupChainContext> {
  const launchNetwork = explicitBreakupNetwork(app.platform.launch.network);
  let detectedNetwork: BreakupNetwork | "" = "";
  try {
    detectedNetwork = explicitBreakupNetwork(await app.chain.detectNetwork?.());
  } catch {
    // Read-only refresh may use an explicit launch boundary. Writes require a
    // detected wallet network and pass requireDetectedNetwork=true below.
  }
  if (requireDetectedNetwork && !detectedNetwork) throw new Error(errorMessage);
  if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) throw new Error(errorMessage);
  const network = detectedNetwork || launchNetwork;
  if (!network) throw new Error(errorMessage);
  const configured = normalizeBreakupHash(app.chain.contractAddress?.get());
  const expected = normalizeBreakupHash(getMiniAppContractHash(BREAKUP_APP_ID, network));
  if (!configured || !expected || configured !== expected) throw new Error(errorMessage);
  return { network, contractHash: configured };
}
