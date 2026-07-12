/**
 * Shared helpers for the MiniApp Credits ledger stack
 * (credits-ledger / credits-indexer / credits-settler).
 *
 * Architecture recap (see docs/MINIAPP_CREDITS_LEDGER.md):
 *   BUY on-chain (GAS -> MiniAppCredits, memo-gated) -> indexer credits DB;
 *   SPEND DB-first (instant, feeless, idempotent);
 *   SETTLE periodically (one operator-signed postSettlement batch per epoch).
 *
 * Rate is fixed in the contract: 1 GAS = 50 credits, so
 * 1 credit = 2_000_000 GAS base units (fixed8).
 */

import { getEnv, isProductionEnv } from "./env.ts";
import { error } from "./response.ts";
import { normalizeUInt160 } from "./contracts.ts";

export const CREDITS_PER_GAS = 50n;
export const GAS_BASE_UNITS_PER_CREDIT = 2_000_000n;
export const CREDITS_BUY_MEMO = "miniapp-credits:buy";

export type CreditsNetwork = "mainnet" | "testnet";

export function parseCreditsNetwork(value: unknown): CreditsNetwork | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "mainnet" || raw === "testnet" ? raw : null;
}

/**
 * Resolve the MiniAppCredits contract hash for a network.
 *
 * Read lazily per call (kernel-rpc E-6 idiom) so a function booted before its
 * secrets arrive fails against the live env instead of caching "" forever.
 * Env precedence: CONTRACT_MINIAPP_CREDITS_HASH_<NETWORK> then the network-
 * agnostic CONTRACT_MINIAPP_CREDITS_HASH. Returns "" when unconfigured.
 */
export function getCreditsContractHash(network: CreditsNetwork): string {
  const specific = getEnv(`CONTRACT_MINIAPP_CREDITS_HASH_${network.toUpperCase()}`);
  const generic = getEnv("CONTRACT_MINIAPP_CREDITS_HASH");
  const raw = specific ?? generic ?? "";
  if (!raw) return "";
  try {
    return normalizeUInt160(raw);
  } catch {
    return "";
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Authenticate a cron-able operator endpoint (credits-indexer/settler).
 *
 * Requires the X-Cron-Secret header to match CREDITS_CRON_SECRET. Comparison
 * runs over SHA-256 digests so it is constant-time and length-independent.
 * Fails closed: when the env var is unset the endpoint is 503, never open.
 * Returns null when authorized, otherwise an error Response.
 */
export async function requireCronAuth(req: Request): Promise<Response | null> {
  const secret = getEnv("CREDITS_CRON_SECRET");
  if (!secret) {
    return error(503, "credits cron secret not configured", "NOT_CONFIGURED", req);
  }
  if (isProductionEnv() && secret.length < 32) {
    return error(503, "credits cron secret too short for production", "NOT_CONFIGURED", req);
  }

  const provided = (req.headers.get("X-Cron-Secret") ?? "").trim();
  if (!provided) {
    return error(401, "missing X-Cron-Secret", "AUTH_REQUIRED", req);
  }

  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff !== 0) {
    return error(401, "invalid cron secret", "AUTH_INVALID", req);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Application-log notification parsing
// ---------------------------------------------------------------------------

function decodeBase64Bytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Parse a Hash160 notification state item into display form ("0x" + 40
 * big-endian hex chars). Application logs encode UInt160 values as
 * base64 ByteStrings carrying the raw little-endian 20 bytes.
 */
export function parseHash160StackItem(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const typed = item as Record<string, unknown>;
  const type = String(typed.type ?? "");
  const value = String(typed.value ?? "");
  if (type === "Hash160") {
    try {
      return normalizeUInt160(value);
    } catch {
      return null;
    }
  }
  if (type !== "ByteString" && type !== "Buffer") return null;
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64Bytes(value);
  } catch {
    return null;
  }
  if (bytes.length !== 20) return null;
  return `0x${Array.from(bytes).reverse().map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Parse an Integer notification state item into a bigint. */
export function parseIntegerStackItem(item: unknown): bigint | null {
  if (!item || typeof item !== "object") return null;
  const typed = item as Record<string, unknown>;
  if (String(typed.type ?? "") !== "Integer") return null;
  const value = String(typed.value ?? "");
  if (!/^-?\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export type CreditsChainEvent = {
  txHash: string;
  /** Position within the flattened HALT-execution notification list. */
  eventIndex: number;
  eventName: "CreditsPurchased" | "CreditsExited";
  /** Display-form script hash of the user wallet. */
  userHash: string;
  /** CreditsPurchased: GAS paid in; CreditsExited: GAS paid out (base units). */
  gasAmount: bigint;
  /** CreditsPurchased: credits minted; CreditsExited: settled credits burned. */
  credits: bigint;
};

/**
 * Extract MiniAppCredits events from a getapplicationlog response.
 *
 * Only HALT executions are scanned (a FAULT never persists contract state).
 * eventIndex is the notification's position in the flattened notification
 * list across HALT executions — stable per tx, so (tx_hash, event_index) is a
 * safe replay-dedupe anchor. Malformed notifications are skipped.
 *
 * Event shapes (contracts/MiniAppCredits):
 *   CreditsPurchased(user: Hash160, gasAmount: Integer, credits: Integer)
 *   CreditsExited(user: Hash160, credits: Integer, gasPaid: Integer)
 */
export function extractCreditsChainEvents(
  txHash: string,
  appLog: unknown,
  contractHash: string,
): CreditsChainEvent[] {
  const out: CreditsChainEvent[] = [];
  if (!appLog || typeof appLog !== "object") return out;
  const executions = (appLog as Record<string, unknown>).executions;
  if (!Array.isArray(executions)) return out;

  const wanted = contractHash.toLowerCase();
  let index = -1;
  for (const execution of executions) {
    if (!execution || typeof execution !== "object") continue;
    const exec = execution as Record<string, unknown>;
    if (String(exec.vmstate ?? "") !== "HALT") continue;
    const notifications = Array.isArray(exec.notifications) ? exec.notifications : [];
    for (const notification of notifications) {
      index += 1;
      if (!notification || typeof notification !== "object") continue;
      const note = notification as Record<string, unknown>;
      if (String(note.contract ?? "").toLowerCase() !== wanted) continue;
      const eventName = String(note.eventname ?? "");
      if (eventName !== "CreditsPurchased" && eventName !== "CreditsExited") continue;

      const state = note.state as Record<string, unknown> | undefined;
      const values = Array.isArray(state?.value) ? (state?.value as unknown[]) : [];
      if (values.length < 3) continue;

      const userHash = parseHash160StackItem(values[0]);
      const second = parseIntegerStackItem(values[1]);
      const third = parseIntegerStackItem(values[2]);
      if (!userHash || second === null || third === null) continue;

      if (eventName === "CreditsPurchased") {
        // (user, gasAmount, credits)
        if (second <= 0n || third <= 0n) continue;
        out.push({ txHash, eventIndex: index, eventName, userHash, gasAmount: second, credits: third });
      } else {
        // CreditsExited: (user, credits, gasPaid)
        if (second <= 0n || third < 0n) continue;
        out.push({ txHash, eventIndex: index, eventName, userHash, gasAmount: third, credits: second });
      }
    }
  }
  return out;
}
