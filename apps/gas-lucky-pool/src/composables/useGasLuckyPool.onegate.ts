import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";
import {
  APP_ID,
  MAX_VAULT_REWARD_FIXED8,
  ONEGATE_VAULT_APP_URL,
  ONEGATE_VAULT_DAPP_ID,
  asBigInt,
  normalizeClaimIdentity,
  normalizeClaimKey,
  normalizeNeoAddress,
  normalizePoolId,
  type ClaimLaunchIdentity,
} from "./useGasLuckyPool.shared";

const NEO_N3_ADDRESS_VERSION = 0x35;
export const ONEGATE_ADDRESS_DETECTION_TIMEOUT_MS = 8_000;
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

type OneGateAccountLike = Record<string, unknown>;

type OneGateAuthChallenge = {
  Action: "Authentication";
  grant_type: "Signature";
  allowed_algorithms: ["ECDSA-P256"];
  Domain: string;
  Networks: [number];
  Nonce: number;
  Timestamp: number;
};

type OneGateDapiProviderLike = {
  name?: string;
  dapiVersion?: string;
  compatibility?: unknown;
  icon?: string;
  website?: string;
  getAccounts?: () =>
    | Promise<Array<OneGateAccountLike>>
    | Array<OneGateAccountLike>;
  authenticate?: (
    challenge: OneGateAuthChallenge,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

export type OneGateAddressDiagnostics = {
  providerRequests: number;
  providerReadyEvents: number;
  providerAttempts: string[];
  bridgeAttempts: string[];
  wallet: "skipped" | "available" | "unavailable" | "error";
};

export function createOneGateAddressDiagnostics(): OneGateAddressDiagnostics {
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

function oneGateNetworkMagic(network?: MiniAppLaunchContext["network"]) {
  return network === "mainnet" ? 860833102 : 894710606;
}

function oneGateAuthChallenge(
  network?: MiniAppLaunchContext["network"],
): OneGateAuthChallenge {
  const nonceBytes = new Uint32Array(1);
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random is unavailable in this WebView");
  }
  try {
    crypto.getRandomValues(nonceBytes);
  } catch {
    throw new Error("Secure random is unavailable in this WebView");
  }
  return {
    Action: "Authentication",
    grant_type: "Signature",
    allowed_algorithms: ["ECDSA-P256"],
    Domain:
      typeof window !== "undefined" && window.location.hostname
        ? window.location.hostname
        : "neomini.app",
    Networks: [oneGateNetworkMagic(network)],
    Nonce: nonceBytes[0] ?? 0,
    Timestamp: Math.floor(Date.now() / 1000),
  };
}

function oneGateRuntimeState() {
  if (typeof window === "undefined") {
    return {
      provider: "ssr",
      bridge: "provider-only",
      callback: "provider-only",
      ua: "ssr",
    };
  }
  const oneGateWindow = window as Window & {
    OneGateDapiProvider?: unknown;
    Neo?: { DapiProvider?: unknown };
    NEP21Provider?: unknown;
  };
  const provider = isOneGateDapiProviderLike(oneGateWindow.NEP21Provider)
    ? "nep21"
    : isOneGateDapiProviderLike(oneGateWindow.OneGateDapiProvider)
      ? "direct"
      : isOneGateDapiProviderLike(oneGateWindow.Neo?.DapiProvider)
        ? "neo"
        : "none";
  const ua = navigator.userAgent.includes("iPhone")
    ? "iphone"
    : navigator.userAgent.includes("Android")
      ? "android"
      : navigator.userAgent.includes("Mac OS X")
        ? "ios-sim-or-mac"
        : "other";
  return {
    provider,
    bridge: "provider-only",
    callback: "provider-only",
    ua,
  };
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

async function reportOneGateVaultDiagnostic(input: {
  eventType: "missing_address" | "claim_error" | "scan_open" | "status_error";
  message: string;
  diagnostics: OneGateAddressDiagnostics;
  launchContext: MiniAppLaunchContext;
  identity: ClaimLaunchIdentity;
}) {
  if (typeof fetch !== "function") return;
  const runtime = oneGateRuntimeState();
  const controller =
    typeof AbortController === "function" ? new AbortController() : undefined;
  const timeout = controller
    ? setTimeout(() => controller.abort(), 1_200)
    : undefined;
  try {
    const request = fetch("/api/onegate-vault/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: input.eventType,
        message: input.message,
        diagnostic: formatOneGateAddressDiagnostics(
          input.diagnostics,
          input.launchContext,
          input.identity,
        ),
        network: input.launchContext.network || "mainnet",
        source: input.launchContext.source || "unknown",
        operation: input.launchContext.operation || "unknown",
        poolId: input.identity.poolId || "",
        oneGateAppId: input.identity.oneGateAppId || ONEGATE_VAULT_DAPP_ID,
        appId: input.identity.appId || APP_ID,
        locale:
          typeof navigator !== "undefined"
            ? navigator.language || "unknown"
            : "unknown",
        userAgent:
          typeof navigator !== "undefined"
            ? navigator.userAgent || "unknown"
            : "unknown",
        platform: runtime.ua,
        details: {
          provider: runtime.provider,
          bridge: runtime.bridge,
          callback: runtime.callback,
          providerRequests: input.diagnostics.providerRequests,
          providerReadyEvents: input.diagnostics.providerReadyEvents,
          providerSteps: input.diagnostics.providerAttempts,
          bridgeSteps: input.diagnostics.bridgeAttempts,
          wallet: input.diagnostics.wallet,
        },
      }),
      keepalive: true,
      signal: controller?.signal,
    });
    await (controller ? request : Promise.race([request, oneGateDelay(1_200)]));
  } catch {
    // Diagnostics must never block a claim screen or replace the real error.
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function throwOneGateAddressRequiredError(input: {
  message: string;
  diagnostics: OneGateAddressDiagnostics;
  launchContext: MiniAppLaunchContext;
  identity: ClaimLaunchIdentity;
}): Promise<never> {
  const error = oneGateAddressRequiredError(
    input.message,
    input.diagnostics,
    input.launchContext,
    input.identity,
  );
  await reportOneGateVaultDiagnostic({
    eventType: "missing_address",
    message: input.message,
    diagnostics: input.diagnostics,
    launchContext: input.launchContext,
    identity: input.identity,
  });
  throw error;
}

function isOneGateDapiProviderLike(
  value: unknown,
): value is OneGateDapiProviderLike {
  if (!value || typeof value !== "object") return false;
  const provider = value as OneGateDapiProviderLike;
  const compatibility = provider.compatibility;
  const isNep21 =
    Array.isArray(compatibility) &&
    compatibility.some((entry) => String(entry).toUpperCase() === "NEP-21") &&
    String(provider.dapiVersion ?? "") === "1.0";
  return isNep21 || typeof provider.getAccounts === "function";
}

function normalizeNeoScriptHash(value: unknown): string {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(?:0x)?([0-9a-fA-F]{40})$/);
  const scriptHash = match?.[1];
  return scriptHash ? scriptHash.toLowerCase() : "";
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
    output = (BASE58_ALPHABET[index] ?? "") + output;
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    output = (BASE58_ALPHABET[0] ?? "") + output;
  }

  return output || (BASE58_ALPHABET[0] ?? "");
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
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
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
      const temp1 = (h + s1 + ch + (SHA256_K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
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
      const input = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(input).set(bytes);
      const digest = await subtle.digest("SHA-256", input);
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

async function normalizeOneGateAccountAddress(value: unknown): Promise<string> {
  const address = normalizeNeoAddress(value);
  if (address) return address;
  return scriptHashToNeoAddress(value);
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

export function walletAddressFromParams(context: MiniAppLaunchContext): string {
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

type OneGateDapiDiscoveryState = {
  cleanup?: () => void;
  provider?: OneGateDapiProviderLike;
  started: boolean;
  window?: Window;
};

const oneGateDapiDiscovery: OneGateDapiDiscoveryState = {
  started: false,
};

function oneGateWindowWithProviders() {
  if (typeof window === "undefined") return null;
  return window as Window & {
    OneGateDapiProvider?: unknown;
    Neo?: { DapiProvider?: unknown };
    NEP21Provider?: unknown;
    NEP21Providers?: Record<string, unknown>;
  };
}

function resetOneGateDapiDiscoveryForWindow(targetWindow: Window) {
  if (oneGateDapiDiscovery.window === targetWindow) return;
  oneGateDapiDiscovery.cleanup?.();
  oneGateDapiDiscovery.cleanup = undefined;
  oneGateDapiDiscovery.provider = undefined;
  oneGateDapiDiscovery.started = false;
  oneGateDapiDiscovery.window = targetWindow;
}

function rememberOneGateDapiProvider(
  provider: unknown,
): OneGateDapiProviderLike | null {
  if (!isOneGateDapiProviderLike(provider)) return null;
  const oneGateWindow = oneGateWindowWithProviders();
  if (!oneGateWindow) return provider;
  resetOneGateDapiDiscoveryForWindow(oneGateWindow);

  const name = String(provider.name ?? "").trim();
  const providerRegistry = oneGateWindow as unknown as {
    NEP21Provider?: unknown;
    NEP21Providers?: Record<string, unknown>;
  };
  oneGateDapiDiscovery.provider = provider;
  if (providerRegistry.NEP21Provider !== provider) {
    try {
      providerRegistry.NEP21Provider = provider;
    } catch {
      // Some mobile WebViews expose provider globals as read-only host objects.
      // The original provider remains usable; caching must not break the claim.
    }
  }
  if (name) {
    try {
      if (
        providerRegistry.NEP21Providers &&
        typeof providerRegistry.NEP21Providers === "object"
      ) {
        providerRegistry.NEP21Providers[name] = provider;
      } else {
        providerRegistry.NEP21Providers = {
          [name]: provider,
        };
      }
    } catch {
      // Best-effort registry mirror only; provider discovery already has it.
    }
  }
  return provider;
}

function cachedOneGateDapiProvider(): OneGateDapiProviderLike | null {
  const oneGateWindow = oneGateWindowWithProviders();
  if (!oneGateWindow) return null;
  resetOneGateDapiDiscoveryForWindow(oneGateWindow);

  const provider = oneGateDapiDiscovery.provider;
  if (!provider) return null;
  const name = String(provider.name ?? "").trim();
  if (
    oneGateWindow.NEP21Provider === provider ||
    (name && oneGateWindow.NEP21Providers?.[name] === provider)
  ) {
    return provider;
  }
  oneGateDapiDiscovery.provider = undefined;
  return null;
}

function immediateOneGateDapiProvider(): OneGateDapiProviderLike | null {
  const oneGateWindow = oneGateWindowWithProviders();
  if (!oneGateWindow) return null;
  const cachedProvider = cachedOneGateDapiProvider();
  if (cachedProvider) return cachedProvider;

  const registeredProvider = rememberOneGateDapiProvider(
    oneGateWindow.NEP21Provider,
  );
  if (registeredProvider) return registeredProvider;

  const directProvider = oneGateWindow.OneGateDapiProvider;
  const rememberedDirect = rememberOneGateDapiProvider(directProvider);
  if (rememberedDirect) return rememberedDirect;

  const eventProvider = oneGateWindow.Neo?.DapiProvider;
  const rememberedEvent = rememberOneGateDapiProvider(eventProvider);
  if (rememberedEvent) return rememberedEvent;
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
      const provider = rememberOneGateDapiProvider(detail?.provider ?? detail);
      if (!provider) return;
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

export function startOneGateDapiProviderDiscovery() {
  const oneGateWindow = oneGateWindowWithProviders();
  if (!oneGateWindow) return;
  resetOneGateDapiDiscoveryForWindow(oneGateWindow);
  if (cachedOneGateDapiProvider()) return;

  if (!oneGateDapiDiscovery.started) {
    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<{ provider?: unknown }>).detail;
      rememberOneGateDapiProvider(detail?.provider ?? detail);
    };
    oneGateWindow.addEventListener("Neo.DapiProvider.ready", onReady);
    oneGateDapiDiscovery.cleanup = () => {
      oneGateWindow.removeEventListener("Neo.DapiProvider.ready", onReady);
    };
    oneGateDapiDiscovery.started = true;
  }
  requestOneGateDapiProvider();
}

async function readOneGateProviderAddress(
  provider: unknown,
  diagnostics?: OneGateAddressDiagnostics,
  label = "provider",
  network?: MiniAppLaunchContext["network"],
): Promise<string> {
  if (!isOneGateDapiProviderLike(provider)) {
    addOneGateDiag(diagnostics, "providerAttempts", `${label}:missing`);
    return "";
  }

  try {
    if (typeof provider.getAccounts !== "function") {
      addOneGateDiag(
        diagnostics,
        "providerAttempts",
        `${label}:accounts:missing`,
      );
      return "";
    }
    const accounts = await oneGateCallTimeout(provider.getAccounts(), 2_500);
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
  }

  if (typeof provider.authenticate === "function") {
    try {
      const response = await oneGateCallTimeout(
        provider.authenticate(oneGateAuthChallenge(network)),
        3_500,
      );
      const address = await addressFromOneGateRecord(response);
      if (address) {
        addOneGateDiag(diagnostics, "providerAttempts", `${label}:auth:ok`);
        return address;
      }
      addOneGateDiag(diagnostics, "providerAttempts", `${label}:auth:empty`);
    } catch (error) {
      addOneGateDiag(
        diagnostics,
        "providerAttempts",
        `${label}:auth:${oneGateErrorCode(error)}`,
      );
    }
  }

  return "";
}

async function pollOneGateProviderAddress(
  timeoutMs: number,
  diagnostics?: OneGateAddressDiagnostics,
  network?: MiniAppLaunchContext["network"],
): Promise<string> {
  const startedAt = Date.now();

  do {
    const address = await readOneGateInjectedAddressOnce(diagnostics, network);
    if (address) return address;

    const remainingMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
    const eventProviderAddress = await readOneGateProviderAddress(
      await eventOneGateDapiProvider(Math.min(remainingMs, 500), diagnostics),
      diagnostics,
      "event",
      network,
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

async function readOneGateInjectedAddressOnce(
  diagnostics?: OneGateAddressDiagnostics,
  network?: MiniAppLaunchContext["network"],
): Promise<string> {
  const providerAddress = await readOneGateProviderAddress(
    immediateOneGateDapiProvider(),
    diagnostics,
    "immediate",
    network,
  );
  if (providerAddress) return providerAddress;

  return "";
}

export async function waitForOneGateInjectedAddress(
  timeoutMs = ONEGATE_ADDRESS_DETECTION_TIMEOUT_MS,
  diagnostics?: OneGateAddressDiagnostics,
  network?: MiniAppLaunchContext["network"],
): Promise<string> {
  addOneGateDiag(diagnostics, "providerAttempts", "providerOnly");
  return pollOneGateProviderAddress(timeoutMs, diagnostics, network);
}

export function luckPercentFromFixed8(value: unknown): string {
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

export function buildClaimKeyUrl(
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

export function buildLegacyPoolClaimUrl(
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
