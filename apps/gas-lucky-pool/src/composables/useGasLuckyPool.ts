import { createDerived, createObservable } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import {
  formatGas,
  formatHash,
  fromFixed8,
  toFixed8,
} from "@shared/utils/format";
import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";

const APP_ID = "miniapp-gas-lucky-pool";
const ONEGATE_VAULT_DAPP_ID = "23";
const ONEGATE_VAULT_APP_URL = `https://onegate.space/app/${ONEGATE_VAULT_DAPP_ID}`;
const ONE_GAS_FIXED8 = 100000000n;
const MAX_VAULT_REWARD_FIXED8 = 50n * ONE_GAS_FIXED8;

export type GasPoolStatus =
  | "draft"
  | "active"
  | "empty"
  | "expired"
  | "unknown";
export type GasPoolSuccessType =
  | ""
  | "create"
  | "claim"
  | "refund"
  | "fund"
  | "withdraw";
export type GasPoolClaimProgress =
  | ""
  | "wallet"
  | "submitting"
  | "confirming"
  | "paid"
  | "failed";

export interface GasLuckyPool {
  id: string;
  creator: string;
  totalAmount: bigint;
  minClaimAmount: bigint;
  maxClaimAmount: bigint;
  maxClaims: number;
  claimedCount: number;
  remainingAmount: bigint;
  bestLuckAddress: string;
  bestLuckAmount: bigint;
  expiryTime: number;
  active: boolean;
  status: GasPoolStatus;
}

export interface GasLuckyClaim {
  id: string;
  poolId: string;
  claimer: string;
  amount: bigint;
  txid?: string;
}

export interface CreatePoolForm {
  totalAmount?: string;
  minClaim?: string;
  maxClaim?: string;
  maxClaims?: string;
  expiryHours?: string;
}

export interface TopUpPoolForm {
  poolId?: string;
  amount?: string;
}

interface ClaimLaunchIdentity {
  poolId?: string;
  oneGateAppId?: string;
  appId?: string;
  walletAddress?: string;
}

export interface UseGasLuckyPoolOptions {
  chain: ChainService;
  launchContext: MiniAppLaunchContext;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function asBigInt(value: unknown): bigint {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePool(id: string, raw: unknown): GasLuckyPool | null {
  if (!Array.isArray(raw) || raw.length < 11) return null;
  const expiryTime = asNumber(raw[9]);
  const claimedCount = asNumber(raw[5]);
  const maxClaims = asNumber(raw[4]);
  const remainingAmount = asBigInt(raw[6]);
  const active = Boolean(raw[10]);
  const expired = expiryTime > 0 && Math.floor(Date.now() / 1000) > expiryTime;
  const empty = remainingAmount <= 0n || claimedCount >= maxClaims;
  const status: GasPoolStatus = empty
    ? "empty"
    : expired
      ? "expired"
      : active
        ? "active"
        : "unknown";

  return {
    id,
    creator: String(raw[0] ?? ""),
    totalAmount: asBigInt(raw[1]),
    minClaimAmount: asBigInt(raw[2]),
    maxClaimAmount: asBigInt(raw[3]),
    maxClaims,
    claimedCount,
    remainingAmount,
    bestLuckAddress: String(raw[7] ?? ""),
    bestLuckAmount: asBigInt(raw[8]),
    expiryTime,
    active,
    status,
  };
}

function eventValue(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
}

function isWalletUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /wallet (not detected|unavailable|not connected)|install a nep-21|neoline extension/i.test(
    message,
  );
}

export function normalizePoolId(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^\d{1,32}$/.test(raw) ? raw : "";
}

export function normalizeClaimKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_:-]{6,128}$/.test(raw) ? raw : "";
}

function normalizeNeoAddress(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw) ? raw : "";
}

const NEO_N3_ADDRESS_VERSION = 0x35;
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

type OneGateAccountLike = Record<string, unknown>;

type OneGateDapiProviderLike = {
  name?: string;
  getAccounts?: () =>
    | Promise<Array<OneGateAccountLike>>
    | Array<OneGateAccountLike>;
};

type OneGateBridgeWindow = Window & {
  __OneGateBridge?: { invoke?: (payload: string) => void };
  __OneGateDapiCallback?: (response: unknown) => void;
};

type OneGateAddressDiagnostics = {
  providerRequests: number;
  providerReadyEvents: number;
  providerAttempts: string[];
  bridgeAttempts: string[];
  wallet: "skipped" | "available" | "unavailable" | "error";
};

const oneGateBridgePending = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

function createOneGateAddressDiagnostics(): OneGateAddressDiagnostics {
  return {
    providerRequests: 0,
    providerReadyEvents: 0,
    providerAttempts: [],
    bridgeAttempts: [],
    wallet: "skipped",
  };
}

function addOneGateDiag(
  diagnostics: OneGateAddressDiagnostics | undefined,
  bucket: "providerAttempts" | "bridgeAttempts",
  value: string,
) {
  if (!diagnostics) return;
  const target = diagnostics[bucket];
  if (target.includes(value) || target.length >= 24) return;
  target.push(value);
}

function oneGateErrorCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("timed out")) return "timeout";
    return "error";
  }
  return "unknown";
}

function oneGateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function oneGateRuntimeState() {
  if (typeof window === "undefined") {
    return {
      provider: "ssr",
      bridge: "ssr",
      callback: "ssr",
      ua: "ssr",
    };
  }
  const oneGateWindow = window as OneGateBridgeWindow & {
    OneGateDapiProvider?: unknown;
    Neo?: { DapiProvider?: unknown };
  };
  const provider = isOneGateDapiProviderLike(oneGateWindow.OneGateDapiProvider)
    ? "direct"
    : isOneGateDapiProviderLike(oneGateWindow.Neo?.DapiProvider)
      ? "neo"
      : "none";
  const bridge =
    typeof oneGateWindow.__OneGateBridge?.invoke === "function"
      ? "invoke"
      : oneGateWindow.__OneGateBridge
        ? "object"
        : "none";
  const callback =
    typeof oneGateWindow.__OneGateDapiCallback === "function"
      ? "function"
      : "none";
  const ua = navigator.userAgent.includes("iPhone")
    ? "iphone"
    : navigator.userAgent.includes("Android")
      ? "android"
      : navigator.userAgent.includes("Mac OS X")
        ? "ios-sim-or-mac"
        : "other";
  return { provider, bridge, callback, ua };
}

function formatOneGateAddressDiagnostics(
  diagnostics: OneGateAddressDiagnostics,
  launchContext: MiniAppLaunchContext,
  identity: ClaimLaunchIdentity,
) {
  const runtime = oneGateRuntimeState();
  const source = launchContext.source || "none";
  const operation = launchContext.operation || "none";
  const network = launchContext.network || "mainnet";
  const app = normalizeClaimIdentity(identity.oneGateAppId) || "none";
  const providerSteps = diagnostics.providerAttempts.join(",");
  const bridgeSteps = diagnostics.bridgeAttempts.join(",");
  return [
    "ogvdiag",
    "v=2",
    `source=${source}`,
    `op=${operation}`,
    `network=${network}`,
    `app=${app}`,
    `ua=${runtime.ua}`,
    `provider=${runtime.provider}`,
    `bridge=${runtime.bridge}`,
    `callback=${runtime.callback}`,
    `providerReq=${diagnostics.providerRequests}`,
    `providerReady=${diagnostics.providerReadyEvents}`,
    `wallet=${diagnostics.wallet}`,
    `providerSteps=${providerSteps || "none"}`,
    `bridgeSteps=${bridgeSteps || "none"}`,
  ].join(" ");
}

function oneGateAddressRequiredError(
  message: string,
  diagnostics: OneGateAddressDiagnostics,
  launchContext: MiniAppLaunchContext,
  identity: ClaimLaunchIdentity,
) {
  return new Error(
    `${message}\n[${formatOneGateAddressDiagnostics(
      diagnostics,
      launchContext,
      identity,
    )}]`,
  );
}

function isOneGateDapiProviderLike(
  value: unknown,
): value is OneGateDapiProviderLike {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as OneGateDapiProviderLike).getAccounts === "function"
  );
}

function normalizeNeoScriptHash(value: unknown): string {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(?:0x)?([0-9a-fA-F]{40})$/);
  return match ? match[1].toLowerCase() : "";
}

function oneGateCallTimeout<T>(
  operation: Promise<T> | T | undefined,
  timeoutMs: number,
): Promise<T | undefined> {
  if (operation === undefined) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OneGate dAPI call timed out"));
    }, timeoutMs);
    Promise.resolve(operation)
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function installOneGateBridgeCallback(
  windowRef: OneGateBridgeWindow,
  diagnostics?: OneGateAddressDiagnostics,
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    windowRef,
    "__OneGateDapiCallback",
  );
  const current =
    typeof descriptor?.get === "function"
      ? descriptor.get.call(windowRef)
      : windowRef.__OneGateDapiCallback;
  if ((current as { __oneGateVaultWrapped?: boolean } | undefined)?.__oneGateVaultWrapped) {
    addOneGateDiag(diagnostics, "bridgeAttempts", "callback:wrappedAlready");
    return;
  }
  addOneGateDiag(diagnostics, "bridgeAttempts", "callback:install");
  let hostCallback =
    typeof current === "function"
      ? (current as (response: unknown) => void)
      : undefined;
  const callback = (response: unknown) => {
    let parsed = response;
    if (typeof response === "string") {
      try {
        parsed = JSON.parse(response);
      } catch {
        addOneGateDiag(diagnostics, "bridgeAttempts", "callback:parseError");
        parsed = null;
      }
    }
    const record =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    const id = String(record.id ?? "");
    const pending = oneGateBridgePending.get(id);
    if (pending) {
      addOneGateDiag(diagnostics, "bridgeAttempts", "callback:pendingHit");
      oneGateBridgePending.delete(id);
      clearTimeout(pending.timeout);
      if (record.error) pending.reject(record.error);
      else pending.resolve(record.result);
      return;
    }
    addOneGateDiag(diagnostics, "bridgeAttempts", "callback:hostForward");
    hostCallback?.(response);
  };
  (callback as { __oneGateVaultWrapped?: boolean }).__oneGateVaultWrapped = true;
  try {
    Object.defineProperty(windowRef, "__OneGateDapiCallback", {
      configurable: true,
      enumerable: true,
      get: () => callback,
      set: (next: unknown) => {
        if (next === callback) return;
        addOneGateDiag(diagnostics, "bridgeAttempts", "callback:hostSet");
        hostCallback =
          typeof next === "function"
            ? (next as (response: unknown) => void)
            : undefined;
      },
    });
    addOneGateDiag(diagnostics, "bridgeAttempts", "callback:guarded");
  } catch {
    windowRef.__OneGateDapiCallback = callback;
    addOneGateDiag(diagnostics, "bridgeAttempts", "callback:assigned");
  }
}

function oneGateBridgeRpc(
  method: string,
  params: unknown[] = [],
  timeoutMs = 20_000,
  diagnostics?: OneGateAddressDiagnostics,
  options: { includeParams?: boolean; label?: string } = {},
): Promise<unknown> | null {
  if (typeof window === "undefined") return null;
  const windowRef = window as OneGateBridgeWindow;
  const invoke = windowRef.__OneGateBridge?.invoke;
  if (typeof invoke !== "function") {
    addOneGateDiag(
      diagnostics,
      "bridgeAttempts",
      `${options.label || method}:missing`,
    );
    return null;
  }
  installOneGateBridgeCallback(windowRef, diagnostics);
  const id = `onegate_vault_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      oneGateBridgePending.delete(id);
      reject(new Error("OneGate bridge call timed out"));
    }, timeoutMs);
    oneGateBridgePending.set(id, { resolve, reject, timeout });
    try {
      const label = options.label || method;
      addOneGateDiag(diagnostics, "bridgeAttempts", `${label}:sent`);
      const request: Record<string, unknown> = {
        jsonrpc: "2.0",
        id,
        method,
      };
      if (options.includeParams !== false) request.params = params;
      invoke(JSON.stringify(request));
    } catch (error) {
      oneGateBridgePending.delete(id);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }

  let output = "";
  while (value > 0n) {
    const index = Number(value % 58n);
    value /= 58n;
    output = BASE58_ALPHABET[index] + output;
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    output = BASE58_ALPHABET[0] + output;
  }

  return output || BASE58_ALPHABET[0];
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Sync(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 1 + 8) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((value, index) => {
    outputView.setUint32(index * 4, value);
  });
  return output;
}

async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest("SHA-256", bytes);
      return new Uint8Array(digest);
    } catch {
      /* Some embedded WebViews expose crypto without a working subtle API. */
    }
  }
  return sha256Sync(bytes);
}

async function scriptHashToNeoAddress(value: unknown): Promise<string> {
  const littleEndianHash = normalizeNeoScriptHash(value);
  if (!littleEndianHash) return "";

  const scriptHashBytes = hexToBytes(littleEndianHash);
  const addressHashBytes = new Uint8Array(scriptHashBytes).reverse();
  const payload = new Uint8Array(1 + addressHashBytes.length);
  payload[0] = NEO_N3_ADDRESS_VERSION;
  payload.set(addressHashBytes, 1);

  const checksumSource = await sha256Bytes(await sha256Bytes(payload));
  if (checksumSource.length < 4) return "";

  const addressBytes = new Uint8Array(payload.length + 4);
  addressBytes.set(payload, 0);
  addressBytes.set(checksumSource.slice(0, 4), payload.length);
  return normalizeNeoAddress(base58Encode(addressBytes));
}

async function normalizeOneGateAccountAddress(
  value: unknown,
): Promise<string> {
  const address = normalizeNeoAddress(value);
  if (address) return address;
  return scriptHashToNeoAddress(value);
}

function normalizeClaimIdentity(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(raw) ? raw : "";
}

const WALLET_ADDRESS_PARAM_KEYS = [
  "address",
  "wallet",
  "walletAddress",
  "wallet_address",
  "account",
  "accountAddress",
  "account_address",
  "neoAddress",
  "neo_address",
  "recipient",
  "recipientAddress",
  "recipient_address",
  "userAddress",
  "user_address",
  "toAddress",
  "to_address",
];

const ONEGATE_ACCOUNT_ADDRESS_KEYS = [
  ...WALLET_ADDRESS_PARAM_KEYS,
  "hash",
  "scriptHash",
  "script_hash",
  "accountHash",
  "account_hash",
];

const NORMALIZED_ONEGATE_ACCOUNT_ADDRESS_KEYS = new Set(
  ONEGATE_ACCOUNT_ADDRESS_KEYS.map((key) =>
    key.replace(/[-_.:]/g, "").toLowerCase(),
  ),
);

const NORMALIZED_WALLET_ADDRESS_PARAM_KEYS = new Set(
  WALLET_ADDRESS_PARAM_KEYS.map((key) =>
    key.replace(/[-_.:]/g, "").toLowerCase(),
  ),
);

function walletAddressFromParams(context: MiniAppLaunchContext): string {
  const exact = normalizeNeoAddress(
    getLaunchParam(context, WALLET_ADDRESS_PARAM_KEYS, ""),
  );
  if (exact) return exact;

  for (const [key, value] of Object.entries(context.params ?? {})) {
    const normalizedKey = key.replace(/[-_.:]/g, "").toLowerCase();
    if (!NORMALIZED_WALLET_ADDRESS_PARAM_KEYS.has(normalizedKey)) continue;
    const address = normalizeNeoAddress(value);
    if (address) return address;
  }
  return "";
}

async function addressFromOneGateRecord(
  record: unknown,
  depth = 0,
): Promise<string> {
  if (!record || typeof record !== "object") {
    return normalizeOneGateAccountAddress(record);
  }
  const values = record as Record<string, unknown>;

  for (const [key, value] of Object.entries(values)) {
    const normalizedKey = key.replace(/[-_.:]/g, "").toLowerCase();
    if (!NORMALIZED_ONEGATE_ACCOUNT_ADDRESS_KEYS.has(normalizedKey)) continue;
    const address = await normalizeOneGateAccountAddress(value);
    if (address) return address;
  }

  if (depth > 0) return "";
  for (const value of Object.values(values)) {
    if (!value || typeof value !== "object") continue;
    const address = await addressFromOneGateRecord(value, depth + 1);
    if (address) return address;
  }

  return "";
}

function isOneGateDefaultAccount(account: unknown): boolean {
  if (!account || typeof account !== "object") return false;
  return Object.entries(account as Record<string, unknown>).some(
    ([key, value]) =>
      key.replace(/[-_.:]/g, "").toLowerCase() === "isdefault" &&
      value === true,
  );
}

async function addressFromOneGateAccounts(accounts: unknown): Promise<string> {
  if (!Array.isArray(accounts)) return "";
  const orderedAccounts = [
    ...accounts.filter(isOneGateDefaultAccount),
    ...accounts.filter((account) => !isOneGateDefaultAccount(account)),
  ];
  for (const account of orderedAccounts) {
    const address = await addressFromOneGateRecord(account);
    if (address) return address;
  }
  return "";
}

function immediateOneGateDapiProvider(): OneGateDapiProviderLike | null {
  if (typeof window === "undefined") return null;
  const oneGateWindow = window as unknown as {
    OneGateDapiProvider?: unknown;
    Neo?: { DapiProvider?: unknown };
  };
  const directProvider = oneGateWindow.OneGateDapiProvider;
  if (isOneGateDapiProviderLike(directProvider)) return directProvider;

  const eventProvider = oneGateWindow.Neo?.DapiProvider;
  if (
    isOneGateDapiProviderLike(eventProvider) &&
    String(eventProvider.name ?? "").toLowerCase().includes("onegate")
  ) {
    return eventProvider;
  }
  return null;
}

function requestOneGateDapiProvider(diagnostics?: OneGateAddressDiagnostics) {
  if (typeof window === "undefined") return;
  if (diagnostics) diagnostics.providerRequests += 1;
  window.dispatchEvent(
    new CustomEvent("Neo.DapiProvider.request", {
      detail: { version: "1.0" },
    }),
  );
}

function eventOneGateDapiProvider(
  timeoutMs = 600,
  diagnostics?: OneGateAddressDiagnostics,
): Promise<OneGateDapiProviderLike | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const immediate = immediateOneGateDapiProvider();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("Neo.DapiProvider.ready", onReady);
    };
    const settle = (provider: OneGateDapiProviderLike | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(provider);
    };
    const onReady = (event: Event) => {
      if (diagnostics) diagnostics.providerReadyEvents += 1;
      const detail = (event as CustomEvent<{ provider?: unknown }>).detail;
      const provider = detail?.provider ?? detail;
      if (!isOneGateDapiProviderLike(provider)) return;
      const name = String(provider.name ?? "").toLowerCase();
      if (
        provider !== immediateOneGateDapiProvider() &&
        name &&
        !name.includes("onegate")
      ) {
        return;
      }
      settle(provider);
    };
    const probe = () => {
      const provider = immediateOneGateDapiProvider();
      if (provider) {
        settle(provider);
        return;
      }
      requestOneGateDapiProvider(diagnostics);
    };

    timeout = setTimeout(() => {
      settle(null);
    }, timeoutMs);
    interval = setInterval(probe, 150);
    window.addEventListener("Neo.DapiProvider.ready", onReady);
    probe();
  });
}

async function readOneGateProviderAddress(
  provider: unknown,
  diagnostics?: OneGateAddressDiagnostics,
  label = "provider",
): Promise<string> {
  if (!isOneGateDapiProviderLike(provider)) {
    addOneGateDiag(diagnostics, "providerAttempts", `${label}:missing`);
    return "";
  }

  try {
    const accounts = await oneGateCallTimeout(provider.getAccounts?.(), 2_500);
    const address = await addressFromOneGateAccounts(accounts);
    if (address) {
      addOneGateDiag(diagnostics, "providerAttempts", `${label}:accounts:ok`);
      return address;
    }
    addOneGateDiag(diagnostics, "providerAttempts", `${label}:accounts:empty`);
  } catch (error) {
    addOneGateDiag(
      diagnostics,
      "providerAttempts",
      `${label}:accounts:${oneGateErrorCode(error)}`,
    );
    /* QR claims must use OneGate's injected default account, not an address picker. */
  }

  return "";
}

async function readOneGateBridgeAddress(
  timeoutMs = 12_000,
  diagnostics?: OneGateAddressDiagnostics,
): Promise<string> {
  const variants = [
    {
      method: "getAccounts",
      includeParams: true,
      label: "getAccounts",
      delayMs: 0,
    },
    {
      method: "GetAccounts",
      includeParams: false,
      label: "GetAccountsNoParams",
      delayMs: 250,
    },
    {
      method: "getAccounts",
      includeParams: false,
      label: "getAccountsNoParams",
      delayMs: 500,
    },
    {
      method: "getAccounts",
      includeParams: true,
      label: "getAccountsRetry",
      delayMs: 1_250,
    },
  ];
  const startedAt = Date.now();
  let finished = false;

  const attempts = variants.map(async (variant) => {
    if (finished) return { address: "", missing: false };
    if (variant.delayMs > 0) {
      await oneGateDelay(
        Math.min(
          variant.delayMs,
          Math.max(0, timeoutMs - (Date.now() - startedAt)),
        ),
      );
    }
    if (finished) return { address: "", missing: false };
    const remainingMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
    if (remainingMs <= 0) return { address: "", missing: false };
    try {
      const accounts = await oneGateBridgeRpc(
        variant.method,
        [],
        remainingMs,
        diagnostics,
        {
          includeParams: variant.includeParams,
          label: variant.label,
        },
      );
      if (accounts === null) return { address: "", missing: true };
      const address = await addressFromOneGateAccounts(accounts);
      if (address) {
        addOneGateDiag(diagnostics, "bridgeAttempts", `${variant.label}:ok`);
        return { address, missing: false };
      }
      addOneGateDiag(diagnostics, "bridgeAttempts", `${variant.label}:empty`);
      return { address: "", missing: false };
    } catch (error) {
      addOneGateDiag(
        diagnostics,
        "bridgeAttempts",
        `${variant.label}:${oneGateErrorCode(error)}`,
      );
      return { address: "", missing: false };
    }
  });

  const pending = attempts.map((attempt, index) => ({ attempt, index }));
  while (pending.length > 0) {
    const { result, index } = await Promise.race(
      pending.map(({ attempt, index }) =>
        attempt.then((result) => ({ result, index })),
      ),
    );
    const pendingIndex = pending.findIndex((item) => item.index === index);
    if (pendingIndex >= 0) pending.splice(pendingIndex, 1);
    if (result.address) {
      finished = true;
      return result.address;
    }
    if (result.missing) {
      finished = true;
      return "";
    }
  }

  return "";
}

async function readOneGateInjectedAddressOnce(
  diagnostics?: OneGateAddressDiagnostics,
): Promise<string> {
  const providerAddress = await readOneGateProviderAddress(
    immediateOneGateDapiProvider(),
    diagnostics,
    "immediate",
  );
  if (providerAddress) return providerAddress;

  return "";
}

async function waitForOneGateInjectedAddress(
  timeoutMs = 15_000,
  diagnostics?: OneGateAddressDiagnostics,
): Promise<string> {
  const startedAt = Date.now();
  let bridgeAttempts = 0;

  do {
    const remainingMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
    const address = await readOneGateInjectedAddressOnce(diagnostics);
    if (address) return address;

    if (bridgeAttempts < 3) {
      bridgeAttempts += 1;
      const bridgeAddress = await readOneGateBridgeAddress(
        Math.min(Math.max(0, timeoutMs - (Date.now() - startedAt)), 12_000),
        diagnostics,
      );
      if (bridgeAddress) return bridgeAddress;
    }

    const eventProviderAddress = await readOneGateProviderAddress(
      await eventOneGateDapiProvider(Math.min(remainingMs, 500), diagnostics),
      diagnostics,
      "event",
    );
    if (eventProviderAddress) return eventProviderAddress;
    if (Date.now() - startedAt >= timeoutMs) break;
    requestOneGateDapiProvider(diagnostics);
    await oneGateDelay(
      Math.min(150, Math.max(0, timeoutMs - (Date.now() - startedAt))),
    );
  } while (true);
  addOneGateDiag(diagnostics, "providerAttempts", "wait:timeout");
  return "";
}

function luckPercentFromFixed8(value: unknown): string {
  const amount = asBigInt(value);
  const clamped =
    amount < 0n
      ? 0n
      : amount > MAX_VAULT_REWARD_FIXED8
        ? MAX_VAULT_REWARD_FIXED8
        : amount;
  const basisPoints = (clamped * 10000n) / MAX_VAULT_REWARD_FIXED8;
  return `${basisPoints / 100n}.${String(basisPoints % 100n).padStart(2, "0")}`;
}

function buildClaimKeyUrl(
  claimKey: string,
  network?: MiniAppLaunchContext["network"],
  identity: ClaimLaunchIdentity = {},
) {
  const key = normalizeClaimKey(claimKey);
  if (!key) return "";
  const appId =
    normalizeClaimIdentity(identity.oneGateAppId) || ONEGATE_VAULT_DAPP_ID;
  const url = new URL(`https://onegate.space/app/${encodeURIComponent(appId)}`);
  url.searchParams.set("source", "onegate");
  url.searchParams.set("operation", "claimOneGateVault");
  url.searchParams.set("oneGateAppId", appId);
  url.searchParams.set("key", key);
  if (identity.poolId) url.searchParams.set("pool", identity.poolId);
  if (network) url.searchParams.set("network", network);
  return url.toString();
}

function buildLegacyPoolClaimUrl(
  poolId: string,
  network?: MiniAppLaunchContext["network"],
) {
  const id = normalizePoolId(poolId);
  if (!id) return "";
  const url = new URL(ONEGATE_VAULT_APP_URL);
  url.searchParams.set("pool", id);
  if (network) url.searchParams.set("network", network);
  return url.toString();
}

export function useGasLuckyPool({
  chain,
  launchContext,
  t,
}: UseGasLuckyPoolOptions) {
  const launchIdentity: ClaimLaunchIdentity = {
    poolId:
      normalizeClaimIdentity(
        getLaunchParam(launchContext, ["poolId", "pool", "campaignId"], ""),
      ) || undefined,
    oneGateAppId:
      normalizeClaimIdentity(
        getLaunchParam(
          launchContext,
          ["oneGateAppId", "oneGateId", "onegateAppId"],
          "",
        ),
      ) || undefined,
    appId: normalizeClaimIdentity(launchContext.appId) || APP_ID,
    walletAddress: walletAddressFromParams(launchContext) || undefined,
  };
  const currentPoolId = createObservable(
    normalizePoolId(
      getLaunchParam(launchContext, ["poolId", "pool", "id"], ""),
    ),
  );
  const currentClaimKey = createObservable(
    normalizeClaimKey(
      getLaunchParam(launchContext, ["claimKey", "key", "code", "k"], ""),
    ),
  );
  const currentPool = createObservable<GasLuckyPool | null>(null);
  const recentPools = createObservable<GasLuckyPool[]>([]);
  const recentClaims = createObservable<GasLuckyClaim[]>([]);
  const isLoading = createObservable(false);
  const isCreating = createObservable(false);
  const isClaiming = createObservable(false);
  const isRefunding = createObservable(false);
  const isFunding = createObservable(false);
  const isCreditLoading = createObservable(false);
  const isWithdrawingCredit = createObservable(false);
  const lastTxid = createObservable("");
  const lastClaimAmount = createObservable<bigint>(0n);
  const lastClaimPoolId = createObservable("");
  const lastClaimKey = createObservable("");
  const lastClaimLuckPercent = createObservable("");
  const claimStatus = createObservable<"" | "submitted" | "paid" | "failed">(
    "",
  );
  const claimProgress = createObservable<GasPoolClaimProgress>("");
  const lastRefundAmount = createObservable<bigint>(0n);
  const lastRefundPoolId = createObservable("");
  const lastFundAmount = createObservable<bigint>(0n);
  const lastFundPoolId = createObservable("");
  const lastSuccessType = createObservable<GasPoolSuccessType>("");
  const lastError = createObservable("");
  const gasCredit = createObservable<bigint>(0n);

  const poolCount = createDerived(
    () => recentPools.get().length,
    [recentPools],
  );
  const claimCount = createDerived(
    () => recentClaims.get().length,
    [recentClaims],
  );
  const activePoolCount = createDerived(
    () => recentPools.get().filter((pool) => pool.status === "active").length,
    [recentPools],
  );
  const totalRemaining = createDerived(
    () =>
      recentPools.get().reduce((sum, pool) => sum + pool.remainingAmount, 0n),
    [recentPools],
  );
  const totalRemainingGas = createDerived(
    () => Number(totalRemaining.get()) / 100000000,
    [totalRemaining],
  );
  const gasCreditGas = createDerived(
    () => Number(gasCredit.get()) / 100000000,
    [gasCredit],
  );
  const currentShareUrl = createDerived(
    () =>
      currentClaimKey.get()
        ? buildClaimKeyUrl(
            currentClaimKey.get(),
            launchContext.network,
            launchIdentity,
          )
        : currentPoolId.get()
          ? buildLegacyPoolClaimUrl(currentPoolId.get(), launchContext.network)
          : "",
    [currentClaimKey, currentPoolId],
  );
  const currentRange = createDerived(() => {
    const pool = currentPool.get();
    if (!pool) return "1-50 GAS";
    return `${formatGas(pool.minClaimAmount, 2)}-${formatGas(pool.maxClaimAmount, 2)} GAS`;
  }, [currentPool]);

  async function loadPool(poolId = currentPoolId.get()) {
    const id = normalizePoolId(poolId);
    if (!id) {
      currentPool.set(null);
      return null;
    }
    const raw = await chain.readArray("getRangeGasPool", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: id },
    ]);
    const parsed = parsePool(id, raw);
    currentPool.set(parsed);
    return parsed;
  }

  async function loadRecentPools() {
    try {
      const events = await chain.listEvents("RangeGasPoolCreated", {
        limit: 10,
      });
      const items = events
        .map((event) => {
          const appId = String(eventValue(event, 0) ?? "");
          if (appId !== APP_ID) return null;
          const poolId = String(eventValue(event, 1) ?? "");
          if (!poolId) return null;
          return {
            id: poolId,
            creator: String(eventValue(event, 2) ?? ""),
            totalAmount: asBigInt(eventValue(event, 3)),
            minClaimAmount: asBigInt(eventValue(event, 4)),
            maxClaimAmount: asBigInt(eventValue(event, 5)),
            maxClaims: asNumber(eventValue(event, 6)),
            claimedCount: 0,
            remainingAmount: asBigInt(eventValue(event, 3)),
            bestLuckAddress: "",
            bestLuckAmount: 0n,
            expiryTime: 0,
            active: true,
            status: "active" as const,
          };
        })
        .filter((entry): entry is GasLuckyPool => Boolean(entry))
        .slice(0, 10);
      recentPools.set(items);
    } catch {
      recentPools.set([]);
    }
  }

  async function loadRecentClaims() {
    try {
      const events = await chain.listEvents("RangeGasPoolClaimed", {
        limit: 12,
      });
      const items = events
        .map((event) => {
          const appId = String(eventValue(event, 0) ?? "");
          if (appId !== APP_ID) return null;
          const poolId = String(eventValue(event, 1) ?? "");
          const claimer = String(eventValue(event, 2) ?? "");
          return {
            id: `${poolId}:${claimer}`,
            poolId,
            claimer,
            amount: asBigInt(eventValue(event, 3)),
          };
        })
        .filter((entry): entry is GasLuckyClaim => Boolean(entry))
        .slice(0, 12);
      recentClaims.set(items);
    } catch {
      recentClaims.set([]);
    }
  }

  async function loadAll() {
    if (isLoading.get()) return;
    isLoading.set(true);
    lastError.set("");
    try {
      const tasks: Promise<unknown>[] = [loadRecentPools(), loadRecentClaims()];
      if (currentPoolId.get()) tasks.unshift(loadPool(currentPoolId.get()));
      else currentPool.set(null);
      await Promise.all(tasks);
    } catch (error) {
      if (!isWalletUnavailableError(error)) {
        lastError.set(error instanceof Error ? error.message : t("loadFailed"));
      }
    } finally {
      isLoading.set(false);
    }
  }

  function validateCreateForm(form: CreatePoolForm) {
    const total = asBigInt(toFixed8(form.totalAmount || "0"));
    const min = asBigInt(toFixed8(form.minClaim || "0"));
    const max = asBigInt(toFixed8(form.maxClaim || "0"));
    const maxClaims = Math.floor(Number(form.maxClaims || 0));
    const expiryHours = Number(form.expiryHours || 0);

    if (total < ONE_GAS_FIXED8) throw new Error(t("invalidTotal"));
    if (min < ONE_GAS_FIXED8 || max > MAX_VAULT_REWARD_FIXED8 || min > max)
      throw new Error(t("invalidRange"));
    if (!Number.isFinite(maxClaims) || maxClaims < 1 || maxClaims > 100)
      throw new Error(t("invalidClaimSlots"));
    if (!Number.isFinite(expiryHours) || expiryHours <= 0 || expiryHours > 720)
      throw new Error(t("invalidExpiry"));
    if (total < min * BigInt(maxClaims)) throw new Error(t("poolBelowMinimum"));
    if (total > max * BigInt(maxClaims)) throw new Error(t("poolAboveMaximum"));

    return {
      total,
      min,
      max,
      maxClaims,
      expirySeconds: Math.round(expiryHours * 3600),
    };
  }

  async function createPool(form: CreatePoolForm) {
    if (isCreating.get()) return null;
    const parsed = validateCreateForm(form);
    isCreating.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const creator = await chain.ensureWallet();
      const result = await chain.invokeWithPayment(
        parsed.total.toString(),
        `gas-lucky-pool:create:${parsed.maxClaims}`,
        "createRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Hash160", value: creator },
          { type: "Integer", value: parsed.total.toString() },
          { type: "Integer", value: parsed.min.toString() },
          { type: "Integer", value: parsed.max.toString() },
          { type: "Integer", value: String(parsed.maxClaims) },
          { type: "Integer", value: String(parsed.expirySeconds) },
        ],
        { waitForEvent: "RangeGasPoolCreated", waitTimeoutMs: 30_000 },
      );
      lastTxid.set(result.txid);
      lastSuccessType.set("create");
      const createdPoolId = String(eventValue(result.event, 1) ?? "");
      if (createdPoolId) {
        currentPoolId.set(createdPoolId);
        await Promise.all([loadPool(createdPoolId), loadRecentPools()]);
      } else {
        await loadRecentPools();
      }
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("createFailed"));
      await loadGasCredit().catch(() => undefined);
      throw error;
    } finally {
      isCreating.set(false);
    }
  }

  async function loadGasCredit() {
    if (isCreditLoading.get()) return gasCredit.get();
    isCreditLoading.set(true);
    lastError.set("");
    try {
      const user = await chain.ensureWallet();
      const raw = await chain.read("getDirectGasCredit", [
        { type: "Hash160", value: user },
      ]);
      const amount = asBigInt(raw);
      gasCredit.set(amount);
      return amount;
    } catch (error) {
      lastError.set(error instanceof Error ? error.message : t("loadFailed"));
      throw error;
    } finally {
      isCreditLoading.set(false);
    }
  }

  async function withdrawGasCredit(amount = gasCredit.get()) {
    if (isWithdrawingCredit.get()) return null;
    const credit = asBigInt(amount);
    if (credit <= 0n) throw new Error(t("noGasCredit"));
    isWithdrawingCredit.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const user = await chain.ensureWallet();
      const result = await chain.invoke(
        "withdrawGasCredit",
        [
          { type: "Hash160", value: user },
          { type: "Integer", value: credit.toString() },
        ],
        { waitForEvent: "GasCreditWithdrawn", waitTimeoutMs: 30_000 },
      );
      lastTxid.set(result.txid);
      lastSuccessType.set("withdraw");
      gasCredit.set(0n);
      await loadGasCredit().catch(() => undefined);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(
        error instanceof Error ? error.message : t("withdrawGasCreditFailed"),
      );
      throw error;
    } finally {
      isWithdrawingCredit.set(false);
    }
  }

  function claimInputValue(input: unknown, key: "claimKey" | "poolId") {
    if (input && typeof input === "object")
      return (input as Record<string, unknown>)[key];
    return input;
  }

  function claimIdentityFromInput(input: unknown): ClaimLaunchIdentity {
    const record =
      input && typeof input === "object"
        ? (input as Record<string, unknown>)
        : {};
    return {
      poolId:
        normalizeClaimIdentity(
          record.poolId ?? record.pool ?? record.campaignId,
        ) ||
        launchIdentity.poolId ||
        undefined,
      oneGateAppId:
        normalizeClaimIdentity(
          record.oneGateAppId ?? record.oneGateId ?? record.onegateAppId,
        ) ||
        launchIdentity.oneGateAppId ||
        undefined,
      appId:
        normalizeClaimIdentity(record.appId ?? record.miniappId) ||
        launchIdentity.appId ||
        APP_ID,
      walletAddress:
        [
          record.address,
          record.wallet,
          record.walletAddress,
          record.wallet_address,
          record.account,
          record.accountAddress,
          record.account_address,
          record.neoAddress,
          record.neo_address,
          record.recipient,
          record.recipientAddress,
          record.recipient_address,
          record.userAddress,
          record.user_address,
          record.toAddress,
          record.to_address,
        ]
          .map(normalizeNeoAddress)
          .find(Boolean) ||
        launchIdentity.walletAddress ||
        undefined,
    };
  }

  async function resolveClaimAddress(identity: ClaimLaunchIdentity) {
    const diagnostics = createOneGateAddressDiagnostics();
    const launchAddress = normalizeNeoAddress(identity.walletAddress);
    if (launchAddress) return launchAddress;

    const currentAddress = normalizeNeoAddress(chain.address?.get?.());
    if (currentAddress) return currentAddress;

    const explicitOneGateLaunch =
      launchContext.source === "onegate" || !!identity.oneGateAppId;
    if (explicitOneGateLaunch) {
      const injectedAddress = await waitForOneGateInjectedAddress(
        15_000,
        diagnostics,
      );
      if (injectedAddress) return injectedAddress;
    }

    if (currentClaimKey.get()) {
      const immediateInjectedAddress =
        await readOneGateInjectedAddressOnce(diagnostics);
      if (immediateInjectedAddress) return immediateInjectedAddress;

      const oneGateAddressPromise = waitForOneGateInjectedAddress(
        15_000,
        diagnostics,
      );
      const walletAddressPromise = chain
        .ensureWallet()
        .then((address) => ({ kind: "wallet" as const, address }))
        .catch((error: unknown) => ({ kind: "walletError" as const, error }));
      const oneGateResultPromise = oneGateAddressPromise.then((address) => ({
        kind: "onegate" as const,
        address,
      }));
      const first = await Promise.race([
        walletAddressPromise,
        oneGateResultPromise,
      ]);

      if (first.kind === "wallet") {
        diagnostics.wallet = "available";
        const normalizedWalletAddress = normalizeNeoAddress(first.address);
        return normalizedWalletAddress || first.address;
      }
      if (first.kind === "onegate" && first.address) return first.address;
      if (first.kind === "walletError") {
        diagnostics.wallet = isWalletUnavailableError(first.error)
          ? "unavailable"
          : "error";
        if (!isWalletUnavailableError(first.error)) throw first.error;
        const injectedAddress = await oneGateAddressPromise;
        if (injectedAddress) return injectedAddress;
        throw oneGateAddressRequiredError(
          t("oneGateWalletAddressRequired"),
          diagnostics,
          launchContext,
          identity,
        );
      }

      const walletResult = await walletAddressPromise;
      if (walletResult.kind === "wallet") {
        diagnostics.wallet = "available";
        const normalizedWalletAddress = normalizeNeoAddress(
          walletResult.address,
        );
        return normalizedWalletAddress || walletResult.address;
      }
      if (isWalletUnavailableError(walletResult.error)) {
        diagnostics.wallet = "unavailable";
        throw oneGateAddressRequiredError(
          t("oneGateWalletAddressRequired"),
          diagnostics,
          launchContext,
          identity,
        );
      }
      diagnostics.wallet = "error";
      throw walletResult.error;
    }

    try {
      const walletAddress = await chain.ensureWallet();
      diagnostics.wallet = "available";
      const normalizedWalletAddress = normalizeNeoAddress(walletAddress);
      return normalizedWalletAddress || walletAddress;
    } catch (error) {
      if (isWalletUnavailableError(error)) {
        diagnostics.wallet = "unavailable";
        throw oneGateAddressRequiredError(
          t("oneGateWalletAddressRequired"),
          diagnostics,
          launchContext,
          identity,
        );
      }
      diagnostics.wallet = "error";
      throw error;
    }
  }

  function addClaimIdentity(
    target: URLSearchParams | Record<string, string>,
    identity: ClaimLaunchIdentity,
  ) {
    const entries = {
      poolId: identity.poolId,
      oneGateAppId: identity.oneGateAppId,
      appId: identity.appId || APP_ID,
    };
    for (const [key, value] of Object.entries(entries)) {
      if (!value) continue;
      if (target instanceof URLSearchParams) target.set(key, value);
      else target[key] = value;
    }
  }

  async function fetchClaimStatus(
    claimKey: string,
    address: string,
    identity: ClaimLaunchIdentity = launchIdentity,
  ) {
    const search = new URLSearchParams({
      claimKey,
      address,
      network: launchContext.network ?? "mainnet",
    });
    addClaimIdentity(search, identity);
    const response = await fetch(
      `/api/onegate-vault/status?${search.toString()}`,
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof body?.error?.message === "string"
          ? body.error.message
          : t("claimStatusFailed");
      throw new Error(message);
    }
    return body as {
      status?: "submitted" | "paid" | "failed";
      amountFixed8?: string;
      luckPercent?: string;
      txHash?: string;
      requestId?: string;
    };
  }

  async function claimKeyThroughBackend(
    claimKey: string,
    identity: ClaimLaunchIdentity = launchIdentity,
  ) {
    if (isClaiming.get()) return null;
    isClaiming.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("submitted");
    claimProgress.set("wallet");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const address = await resolveClaimAddress(identity);
      claimProgress.set("submitting");
      const request: Record<string, string> = {
        claimKey,
        address,
        network: launchContext.network ?? "mainnet",
      };
      addClaimIdentity(request, identity);
      const response = await fetch("/api/onegate-vault/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof body?.error?.message === "string"
            ? body.error.message
            : t("claimFailed");
        throw new Error(message);
      }

      const result = body as {
        status?: "submitted" | "paid";
        amountFixed8?: string;
        luckPercent?: string;
        txHash?: string;
      };
      currentClaimKey.set(claimKey);
      lastClaimKey.set(claimKey);
      lastTxid.set(String(result.txHash || ""));
      claimStatus.set(result.status === "paid" ? "paid" : "submitted");
      claimProgress.set(result.status === "paid" ? "paid" : "confirming");
      if (result.status === "paid") {
        lastSuccessType.set("claim");
        const amount = asBigInt(result.amountFixed8);
        if (amount > 0n) lastClaimAmount.set(amount);
        lastClaimLuckPercent.set(
          String(
            result.luckPercent || luckPercentFromFixed8(result.amountFixed8),
          ),
        );
      }

      if (result.status !== "paid") {
        const finalStatus = await pollClaimStatus(
          claimKey,
          address,
          identity,
        ).catch(() => undefined);
        if (finalStatus?.status === "failed") {
          throw new Error(t("claimFailed"));
        }
      }

      return {
        txid: String(result.txHash || ""),
        success: true,
        amountFixed8: result.amountFixed8,
        status: result.status,
      };
    } catch (error) {
      lastSuccessType.set("");
      claimStatus.set("failed");
      claimProgress.set("failed");
      lastError.set(error instanceof Error ? error.message : t("claimFailed"));
      throw error;
    } finally {
      isClaiming.set(false);
    }
  }

  async function pollClaimStatus(
    claimKey: string,
    address: string,
    identity: ClaimLaunchIdentity = launchIdentity,
  ) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      const status = await fetchClaimStatus(claimKey, address, identity);
      if (status.status === "paid" && status.amountFixed8) {
        const amount = asBigInt(status.amountFixed8);
        if (amount > 0n) lastClaimAmount.set(amount);
        lastClaimLuckPercent.set(
          String(
            status.luckPercent || luckPercentFromFixed8(status.amountFixed8),
          ),
        );
      }
      if (status.txHash) lastTxid.set(String(status.txHash));
      if (status.status === "paid") {
        claimStatus.set("paid");
        claimProgress.set("paid");
        lastSuccessType.set("claim");
        return status;
      }
      if (status.status === "submitted") {
        claimStatus.set("submitted");
        claimProgress.set("confirming");
      }
      if (status.status === "failed") {
        claimStatus.set("failed");
        claimProgress.set("failed");
        lastSuccessType.set("");
        lastError.set(t("claimFailed"));
        return status;
      }
    }
    return null;
  }

  async function checkClaimStatus(input: unknown = currentClaimKey.get()) {
    const explicitClaimKey =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).claimKey
        : input;
    const key = normalizeClaimKey(explicitClaimKey);
    if (!key) throw new Error(t("claimKeyRequired"));
    const identity = claimIdentityFromInput(input);
    const address = await resolveClaimAddress(identity);
    const status = await fetchClaimStatus(key, address, identity);
    lastClaimKey.set(key);
    if (status.txHash) lastTxid.set(String(status.txHash));
    if (status.status === "paid" && status.amountFixed8) {
      const amount = asBigInt(status.amountFixed8);
      if (amount > 0n) lastClaimAmount.set(amount);
      lastClaimLuckPercent.set(
        String(
          status.luckPercent || luckPercentFromFixed8(status.amountFixed8),
        ),
      );
    }
    claimStatus.set(
      status.status === "paid"
        ? "paid"
        : status.status === "failed"
          ? "failed"
          : "submitted",
    );
    claimProgress.set(
      status.status === "paid"
        ? "paid"
        : status.status === "failed"
          ? "failed"
          : "confirming",
    );
    if (status.status === "paid") lastSuccessType.set("claim");
    if (status.status === "failed") {
      lastSuccessType.set("");
      lastError.set(t("claimFailed"));
    }
    return status;
  }

  async function claimPool(
    input: unknown = currentClaimKey.get() || currentPoolId.get(),
  ) {
    const explicitClaimKey =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).claimKey
        : currentClaimKey.get() || (!normalizePoolId(input) ? input : "");
    const claimKey = normalizeClaimKey(explicitClaimKey);
    if (claimKey) {
      return claimKeyThroughBackend(claimKey, claimIdentityFromInput(input));
    }

    const poolId = claimInputValue(input, "poolId") ?? currentPoolId.get();
    const id = normalizePoolId(poolId);
    if (!id) throw new Error(t("poolIdRequired"));
    if (isClaiming.get()) return null;
    isClaiming.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    claimProgress.set("wallet");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const claimer = await chain.ensureWallet();
      claimProgress.set("submitting");
      const result = await chain.invoke(
        "claimRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Integer", value: id },
          { type: "Hash160", value: claimer },
        ],
        { waitForEvent: "RangeGasPoolClaimed", waitTimeoutMs: 30_000 },
      );
      currentPoolId.set(id);
      lastTxid.set(result.txid);
      lastSuccessType.set("claim");
      claimStatus.set("paid");
      claimProgress.set("paid");
      lastClaimPoolId.set(id);
      const claimedAmount = asBigInt(eventValue(result.event, 3));
      if (claimedAmount > 0n) {
        lastClaimAmount.set(claimedAmount);
        lastClaimLuckPercent.set(luckPercentFromFixed8(claimedAmount));
      }
      await Promise.all([loadPool(id), loadRecentClaims()]);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      claimStatus.set("failed");
      claimProgress.set("failed");
      lastError.set(error instanceof Error ? error.message : t("claimFailed"));
      throw error;
    } finally {
      isClaiming.set(false);
    }
  }

  async function refundPool(poolId = currentPoolId.get()) {
    const id = normalizePoolId(poolId);
    if (!id) throw new Error(t("poolIdRequired"));
    if (isRefunding.get()) return null;
    isRefunding.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const result = await chain.invoke(
        "refundRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Integer", value: id },
        ],
        { waitForEvent: "RangeGasPoolRefunded", waitTimeoutMs: 30_000 },
      );
      lastTxid.set(result.txid);
      lastSuccessType.set("refund");
      lastRefundPoolId.set(String(eventValue(result.event, 1) ?? id));
      lastRefundAmount.set(asBigInt(eventValue(result.event, 3)));
      await loadPool(id);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("refundFailed"));
      throw error;
    } finally {
      isRefunding.set(false);
    }
  }

  async function topUpPool(form: TopUpPoolForm = {}) {
    const id = normalizePoolId(form.poolId ?? currentPoolId.get());
    if (!id) throw new Error(t("poolIdRequired"));
    const amount = asBigInt(toFixed8(form.amount || "0"));
    if (amount <= 0n) throw new Error(t("invalidTopUpAmount"));
    if (isFunding.get()) return null;
    isFunding.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const creator = await chain.ensureWallet();
      const result = await chain.invokeWithPayment(
        amount.toString(),
        `gas-lucky-pool:fund:${id}`,
        "fundRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Integer", value: id },
          { type: "Hash160", value: creator },
          { type: "Integer", value: amount.toString() },
        ],
        { waitForEvent: "RangeGasPoolFunded", waitTimeoutMs: 30_000 },
      );
      currentPoolId.set(id);
      lastTxid.set(result.txid);
      lastSuccessType.set("fund");
      lastFundPoolId.set(String(eventValue(result.event, 1) ?? id));
      lastFundAmount.set(asBigInt(eventValue(result.event, 3)));
      await loadPool(id);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("topUpFailed"));
      await loadGasCredit().catch(() => undefined);
      throw error;
    } finally {
      isFunding.set(false);
    }
  }

  function setPoolId(poolId: string) {
    currentPoolId.set(String(poolId || "").trim());
  }

  function setClaimKey(claimKey: string) {
    currentClaimKey.set(normalizeClaimKey(claimKey));
  }

  return {
    currentPoolId,
    currentClaimKey,
    currentPool,
    recentPools,
    recentClaims,
    isLoading,
    isCreating,
    isClaiming,
    isRefunding,
    isFunding,
    isCreditLoading,
    isWithdrawingCredit,
    lastTxid,
    lastClaimAmount,
    lastClaimPoolId,
    lastClaimKey,
    lastClaimLuckPercent,
    claimStatus,
    claimProgress,
    lastRefundAmount,
    lastRefundPoolId,
    lastFundAmount,
    lastFundPoolId,
    lastSuccessType,
    lastError,
    gasCredit,
    gasCreditGas,
    poolCount,
    claimCount,
    activePoolCount,
    totalRemaining,
    totalRemainingGas,
    currentShareUrl,
    currentRange,
    loadAll,
    loadGasCredit,
    loadPool,
    createPool,
    claimPool,
    checkClaimStatus,
    refundPool,
    topUpPool,
    withdrawGasCredit,
    setPoolId,
    setClaimKey,
    formatPoolGas: (value: bigint | number | string) => formatGas(value, 4),
    formatPoolAddress: (value: string) => formatHash(value, 8, 6),
    fromFixed8,
    buildClaimUrl: (claimKey: string) =>
      buildClaimKeyUrl(claimKey, launchContext.network, launchIdentity),
    buildLegacyPoolClaimUrl: (poolId: string) =>
      buildLegacyPoolClaimUrl(poolId, launchContext.network),
  };
}

export type UseGasLuckyPoolReturn = ReturnType<typeof useGasLuckyPool>;
