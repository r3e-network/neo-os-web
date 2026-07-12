import type { MiniAppFramework } from "@shared/react";
import {
  GAS_HASH,
  getMiniAppContractHash,
  getNetwork,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export const DAILY_CHECKIN_APP_ID = "miniapp-dailycheckin";
export const DAILY_CHECKIN_CONFIRMATION_ATTEMPTS = 12;
export const DAILY_CHECKIN_CONFIRMATION_DELAY_MS = 2_500;

export type DailyCheckinOperationKind = "checkin" | "claim";
export type DailyCheckinEventName = "CheckedIn" | "RewardsClaimed" | "Transfer";

export interface DailyCheckinContext {
  network: NeoNetwork;
  contractHash: string;
  gasHash: string;
}

export interface PendingDailyCheckinOperation {
  version: 1;
  kind: DailyCheckinOperationKind;
  network: NeoNetwork;
  contractHash: string;
  gasHash: string;
  actorHash: string;
  txid: string;
  createdAt: number;
  feeRaw?: string;
  claimAmountRaw?: string;
  beforeStreak: string;
  beforeLastCheckinDay: string;
  beforeUserCheckins: string;
  beforeUnclaimedRaw: string;
  beforeClaimedRaw: string;
  beforeGlobalCheckins: string;
  beforeGlobalRewardedRaw: string;
}

export interface DailyCheckinNotification {
  contract: string;
  eventName: string;
  event: { state: Array<{ value: unknown }> };
}

export interface DailyCheckinTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: DailyCheckinNotification[];
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

function reverseHash(value: string): string {
  const bytes = value.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

export function normalizeDailyCheckinAccount(value: unknown): string {
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

export function dailyCheckinAccountMatches(value: unknown, expected: unknown): boolean {
  const variants = (candidate: unknown) => {
    const values = new Set<string>();
    const normalized = normalizeDailyCheckinAccount(candidate);
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
  return left.size > 0 && right.size > 0 && [...left].some((entry) => right.has(entry));
}

export function unsignedDailyCheckinInteger(value: unknown): string {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return "";
  return BigInt(raw).toString();
}

function positiveInteger(value: unknown): string {
  const parsed = unsignedDailyCheckinInteger(value);
  return parsed && BigInt(parsed) > 0n ? parsed : "";
}

export function isPendingDailyCheckinOperation(
  value: unknown,
): value is PendingDailyCheckinOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingDailyCheckinOperation>;
  if (
    pending.version !== 1 ||
    (pending.kind !== "checkin" && pending.kind !== "claim") ||
    !explicitNetwork(pending.network) ||
    !normalizeDailyCheckinAccount(pending.contractHash) ||
    !normalizeDailyCheckinAccount(pending.gasHash) ||
    !normalizeDailyCheckinAccount(pending.actorHash) ||
    !/^0x[0-9a-fA-F]{64}$/.test(clean(pending.txid)) ||
    !Number.isFinite(pending.createdAt) ||
    Number(pending.createdAt) <= 0
  ) return false;

  const baselines = [
    pending.beforeStreak,
    pending.beforeLastCheckinDay,
    pending.beforeUserCheckins,
    pending.beforeUnclaimedRaw,
    pending.beforeClaimedRaw,
    pending.beforeGlobalCheckins,
    pending.beforeGlobalRewardedRaw,
  ];
  if (baselines.some((entry) => !unsignedDailyCheckinInteger(entry))) return false;
  return pending.kind === "checkin"
    ? Boolean(positiveInteger(pending.feeRaw))
    : Boolean(positiveInteger(pending.claimAmountRaw));
}

export async function requireCanonicalDailyCheckinContext(
  app: MiniAppFramework,
  errorMessage = "dailyCheckinContextMismatch",
): Promise<DailyCheckinContext> {
  const launch = explicitNetwork(app.platform.launch.network);
  let detected: NeoNetwork | "" = "";
  try {
    detected = explicitNetwork(await app.chain.detectNetwork());
  } catch {
    // A launch-bound read can continue through a temporary wallet detection
    // failure. Writes independently require a connected actor.
  }
  if (launch && detected && launch !== detected) throw new Error(errorMessage);
  const network = detected || launch || resolveNeoNetwork(getNetwork());
  const contractHash = normalizeDailyCheckinAccount(
    getMiniAppContractHash(DAILY_CHECKIN_APP_ID, network),
  );
  const configured = normalizeDailyCheckinAccount(app.chain.contractAddress.get());
  const gasHash = normalizeDailyCheckinAccount(GAS_HASH);
  if (!contractHash || !gasHash || (configured && configured !== contractHash)) {
    throw new Error(errorMessage);
  }
  return { network, contractHash, gasHash };
}

function rpcUrl(network: NeoNetwork): string {
  return `https://api.n3index.dev/${network}`;
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

function parseNotification(notification: unknown): DailyCheckinNotification | null {
  if (!notification || typeof notification !== "object") return null;
  const record = notification as { contract?: unknown; eventname?: unknown };
  const contract = normalizeDailyCheckinAccount(record.contract);
  const eventName = clean(record.eventname);
  const state = stateArray(notification);
  if (!contract || !eventName || !state) return null;
  return {
    contract,
    eventName,
    event: { state: state.map((entry) => ({ value: parseStackItem(entry) })) },
  };
}

export function dailyCheckinNotificationValue(
  notification: DailyCheckinNotification,
  index: number,
): unknown {
  return notification.event.state[index]?.value;
}

export function findDailyCheckinNotification(
  outcome: DailyCheckinTransactionOutcome,
  contract: string,
  eventName: DailyCheckinEventName,
  predicate?: (notification: DailyCheckinNotification) => boolean,
): DailyCheckinNotification | null {
  return outcome.notifications.find((notification) =>
    notification.eventName === eventName &&
    dailyCheckinAccountMatches(notification.contract, contract) &&
    (!predicate || predicate(notification))) ?? null;
}

export async function readDailyCheckinTransactionOutcome(
  pending: PendingDailyCheckinOperation,
): Promise<DailyCheckinTransactionOutcome> {
  if (!isPendingDailyCheckinOperation(pending)) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(rpcUrl(pending.network), {
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
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error) return { state: "unknown", notifications: [] };
    const executions = payload.result?.executions ?? [];
    const states = executions
      .map((entry) => clean(entry.vmstate).toUpperCase())
      .filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) {
      return { state: "fault", notifications: [] };
    }
    if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) {
      return { state: "unknown", notifications: [] };
    }
    const notifications = executions
      .flatMap((entry) => entry.notifications ?? [])
      .map(parseNotification)
      .filter((entry): entry is DailyCheckinNotification => entry !== null);
    return { state: "halt", notifications };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

export async function waitForDailyCheckinTransactionOutcome(
  pending: PendingDailyCheckinOperation,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<DailyCheckinTransactionOutcome> {
  const attempts = options.attempts ?? DAILY_CHECKIN_CONFIRMATION_ATTEMPTS;
  const delayMs = options.delayMs ?? DAILY_CHECKIN_CONFIRMATION_DELAY_MS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await readDailyCheckinTransactionOutcome(pending);
    if (outcome.state !== "unknown") return outcome;
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { state: "unknown", notifications: [] };
}
