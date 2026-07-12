import type { MiniAppFramework } from "@shared/react";
import { GAS_HASH, getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  addressToScriptHash,
  ownerMatchesAddress,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";

export const FLASHLOAN_APP_ID = "miniapp-flashloan";

export type FlashloanNetwork = "mainnet" | "testnet";
export type FlashloanEventName = "LoanExecuted" | "LiquidityDeposited" | "LiquidityWithdrawn";

export interface FlashloanChainContext {
  network: FlashloanNetwork;
  contractHash: string;
}

export interface FlashloanTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  event: unknown | null;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeFlashloanNetwork(value: unknown): FlashloanNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function normalizeFlashloanContract(value: unknown): string {
  const normalized = clean(value).toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(normalized) && !/^0x0{40}$/.test(normalized)
    ? normalized
    : "";
}

export function normalizeFlashloanTxid(value: unknown): string {
  const normalized = clean(value).toLowerCase().replace(/^0x/, "");
  return /^[0-9a-f]{64}$/.test(normalized) ? `0x${normalized}` : "";
}

export function normalizeFlashloanAccount(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const addressHash = addressToScriptHash(raw);
  if (/^0x[0-9a-f]{40}$/.test(addressHash)) return addressHash.toLowerCase();
  const parsed = parseHash160(raw);
  return /^0x[0-9a-f]{40}$/.test(parsed) ? parsed.toLowerCase() : "";
}

export function flashloanAccountsMatch(value: unknown, expected: unknown): boolean {
  const expectedHash = normalizeFlashloanAccount(expected);
  const raw = clean(value);
  if (!raw || !expectedHash) return false;
  if (raw.toLowerCase() === expectedHash) return true;
  if (ownerMatchesAddress(raw, expectedHash)) return true;
  return normalizeFlashloanAccount(raw) === expectedHash;
}

export function isConfiguredFlashloanAccount(value: unknown): boolean {
  const account = normalizeFlashloanAccount(value);
  return Boolean(account && !/^0x0{40}$/.test(account));
}

export function expectedFlashloanContract(network: FlashloanNetwork): string {
  return normalizeFlashloanContract(
    getMiniAppContractHash(FLASHLOAN_APP_ID, resolveNeoNetwork(network)),
  );
}

export function requireCanonicalFlashloanContext(
  app: MiniAppFramework,
  network: FlashloanNetwork,
  message: string,
): FlashloanChainContext {
  const configured = normalizeFlashloanContract(app.chain.contractAddress.get());
  const expected = expectedFlashloanContract(network);
  if (!configured || !expected || configured !== expected) throw new Error(message);
  return { network, contractHash: configured };
}

/**
 * Write boundary: the wallet-reported network and configured contract must
 * match the launch network. Launch metadata alone is not enough to authorize a
 * financial transaction.
 */
export async function requireWritableFlashloanContext(
  app: MiniAppFramework,
  network: FlashloanNetwork,
  t: (key: string) => string,
): Promise<FlashloanChainContext> {
  const context = requireCanonicalFlashloanContext(app, network, t("chainContextMismatch"));
  let detected: FlashloanNetwork | "" = "";
  try {
    detected = normalizeFlashloanNetwork(await app.chain.detectNetwork());
  } catch {
    // An undetectable wallet network is not sufficient for a write.
  }
  if (!detected || detected !== network) throw new Error(t("chainContextMismatch"));
  return context;
}

/** Prove local recovery metadata can be durably written before opening a wallet. */
export function assertFlashloanRecoveryStorage(
  app: MiniAppFramework,
  t: (key: string) => string,
): void {
  const key = "flashloan-recovery-probe";
  const marker = { version: 1, createdAt: Date.now(), nonce: Math.random().toString(36) };
  try {
    app.storage.local.set(key, marker);
    const stored = app.storage.local.get<typeof marker | null>(key, null);
    app.storage.local.delete(key);
    const removed = app.storage.local.get<unknown>(key, null);
    if (JSON.stringify(stored) === JSON.stringify(marker) && removed === null) return;
  } catch {
    // Fall through to the localized product error below.
  }
  try {
    app.storage.local.delete(key);
  } catch {
    // Best-effort probe cleanup only.
  }
  throw new Error(t("recoveryStorageUnavailable"));
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

function notificationContract(notification: unknown): string {
  if (!notification || typeof notification !== "object") return "";
  return normalizeFlashloanContract((notification as { contract?: unknown }).contract);
}

function notificationName(notification: unknown): string {
  if (!notification || typeof notification !== "object") return "";
  return clean((notification as { eventname?: unknown }).eventname);
}

function endpoints(network: FlashloanNetwork): string[] {
  return [
    `https://api.n3index.dev/${network}`,
    network === "mainnet"
      ? "https://mainnet1.neo.coz.io:443"
      : "https://testnet1.neo.coz.io:443",
  ];
}

async function applicationLog(
  network: FlashloanNetwork,
  targetTxid: string,
): Promise<{ state: "halt" | "fault" | "unknown"; notifications: unknown[] }> {
  const txid = normalizeFlashloanTxid(targetTxid);
  if (!txid) return { state: "unknown", notifications: [] };

  for (const endpoint of endpoints(network)) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getapplicationlog",
          params: [txid],
        }),
        timeoutMs: 8_000,
      });
      if (!response.ok) continue;
      const payload = await response.json() as {
        result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
        error?: unknown;
      };
      if (payload.error) continue;
      const executions = payload.result?.executions ?? [];
      const vmStates = executions
        .map((execution) => clean(execution.vmstate).toUpperCase())
        .filter(Boolean);
      if (vmStates.some((state) => state.includes("FAULT"))) {
        return { state: "fault", notifications: [] };
      }
      if (vmStates.length > 0 && vmStates.every((state) => state.includes("HALT"))) {
        return {
          state: "halt",
          notifications: executions.flatMap((execution) => execution.notifications ?? []),
        };
      }
    } catch {
      // Try the next read-only endpoint.
    }
  }
  return { state: "unknown", notifications: [] };
}

/** Read the exact VM outcome and target-contract event for a submitted write. */
export async function readFlashloanTransactionOutcome(
  network: FlashloanNetwork,
  targetTxid: string,
  eventName: FlashloanEventName,
  contractHash: string,
): Promise<FlashloanTransactionOutcome> {
  const wantedContract = normalizeFlashloanContract(contractHash);
  if (!normalizeFlashloanTxid(targetTxid) || !wantedContract) {
    return { state: "unknown", event: null };
  }
  const outcome = await applicationLog(network, targetTxid);
  if (outcome.state !== "halt") return { state: outcome.state, event: null };
  const notification = outcome.notifications.find((item) => (
    notificationName(item) === eventName
    && notificationContract(item) === wantedContract
  ));
  return { state: "halt", event: parsedNotification(notification) };
}

/**
 * Verify the prepaid testnet GAS transfer before a finalize-only retry. A HALT
 * plus the exact GAS Transfer to this contract proves the payment landed; the
 * contract's onNEP17Payment would have faulted the same transaction for an
 * unsupported memo.
 */
export async function readFlashloanPaymentOutcome(input: {
  network: FlashloanNetwork;
  paymentTxid: string;
  providerHash: string;
  contractHash: string;
  amountFixed8: string;
}): Promise<FlashloanTransactionOutcome> {
  if (
    !normalizeFlashloanTxid(input.paymentTxid)
    || !normalizeFlashloanAccount(input.providerHash)
    || !normalizeFlashloanContract(input.contractHash)
    || !/^[1-9]\d*$/.test(input.amountFixed8)
  ) return { state: "unknown", event: null };

  const outcome = await applicationLog(input.network, input.paymentTxid);
  if (outcome.state !== "halt") return { state: outcome.state, event: null };
  const transfer = outcome.notifications.find((item) => {
    if (
      notificationName(item) !== "Transfer"
      || notificationContract(item) !== normalizeFlashloanContract(GAS_HASH)
    ) return false;
    const parsed = parsedNotification(item);
    const slots = stateArray(parsed);
    const value = (index: number) => {
      const slot = slots?.[index];
      return slot && typeof slot === "object" && "value" in slot
        ? (slot as { value?: unknown }).value
        : slot;
    };
    return flashloanAccountsMatch(value(0), input.providerHash)
      && flashloanAccountsMatch(value(1), input.contractHash)
      && parseBigInt(value(2)) === BigInt(input.amountFixed8);
  });
  return { state: "halt", event: parsedNotification(transfer) };
}
