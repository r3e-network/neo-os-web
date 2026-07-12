/**
 * Direct read-only JSON-RPC helpers for the official Neo Name Service contract.
 *
 * The wallet/host `chain.read` bridge cannot traverse a `tokensOf` session
 * iterator: the NNS contract returns the owned token ids as an
 * `InteropInterface`/`IIterator` (verified live against api.n3index.dev), and
 * nothing in the bridge (RPC proxy allowlist, host bridge, wallet sdk) walks
 * the iterator — so `chain.read("tokensOf", …)` always yields an empty list and
 * "My Domains" can never populate.
 *
 * The reliable, allowlisted alternative is the `getnep11balances` RPC method
 * (verified working on the configured public endpoint), which returns the owned
 * token ids directly. From each token id we read `properties` (expiry) and
 * `resolve` (target address) with ordinary `invokefunction` test calls.
 *
 * Everything here is read-only — no transaction is ever broadcast.
 */
import { getRpcUrl, resolveNeoNetwork, type NeoNetwork } from "@shared/constants/rpc";
import { sha256 } from "@shared/shims/noble-hashes-sha256.js";

const RPC_TIMEOUT_MS = 12_000;
const OWNED_DOMAIN_READ_CONCURRENCY = 6;
const MAX_OWNED_DOMAIN_ROWS = 10_000;
const MAX_TOKEN_ID_HEX_CHARS = (63 + ".neo".length) * 2;
/** NNS TXT record used by the platform to store a Neo N3 address target. */
const RECORD_TYPE_ADDRESS = 16;
const MAX_PLAUSIBLE_EXPIRY_MS = Date.UTC(2200, 0, 1);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_N3_ADDRESS_VERSION = 0x35;
const NNS_ROOT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.neo$/;

export interface OwnedDomain {
  name: string;
  expiration: number;
  target?: string;
}

export type NnsAvailability = "available" | "owned" | "restricted";

export interface NnsNameSnapshot extends OwnedDomain {
  owner: string;
}

export interface NnsSearchSnapshot {
  name: string;
  availability: NnsAvailability;
  /** Exact Fixed8 GAS amount in datoshi. `-1` means committee-reserved. */
  priceBase: string;
  owner?: string;
  expiration?: number;
}

export interface NnsTransferEvent {
  from: string;
  to: string;
  amount: string;
  name: string;
}

export interface NnsRenewEvent {
  name: string;
  oldExpiration: number;
  newExpiration: number;
}

export interface NnsTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  transfer: NnsTransferEvent | null;
  renew: NnsRenewEvent | null;
}

interface Nep11Token {
  tokenid?: string;
  amount?: string;
}

interface Nep11Balance {
  assethash?: string;
  tokens?: Nep11Token[];
}

interface RpcStackItem {
  type?: string;
  value?: unknown;
}

interface RpcInvokeResult {
  state?: string;
  exception?: string | null;
  stack?: RpcStackItem[];
}

// framework-exempt: neo-ns nnsRpc getnep11balances/invokefunction — the
// chain bridge cannot traverse tokensOf iterators (plan §3.6); these direct
// read-only JSON-RPC calls stay until n3index moves into the framework.
async function rpcCall<T>(network: NeoNetwork, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(getRpcUrl(network), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (response.ok === false) throw new Error(`${method} RPC request failed (${response.status})`);
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || `${method} failed`);
  if (payload.result === undefined) throw new Error(`${method} returned an empty result`);
  return payload.result;
}

function requireHalt(result: RpcInvokeResult, operation: string): RpcStackItem[] {
  if (String(result.state ?? "").toUpperCase() !== "HALT") {
    throw new Error(result.exception || `${operation} returned a non-HALT VM state`);
  }
  if (!Array.isArray(result.stack)) throw new Error(`${operation} returned no stack`);
  return result.stack;
}

function strictInteger(value: unknown, label: string, allowNegative = false): bigint {
  const raw = String(value ?? "").trim();
  if (!(allowNegative ? /^-?\d+$/ : /^\d+$/).test(raw)) {
    throw new Error(`${label} is malformed`);
  }
  return BigInt(raw);
}

function strictBoolean(item: RpcStackItem | undefined, label: string): boolean {
  if (!item || item.type !== "Boolean") throw new Error(`${label} is malformed`);
  if (typeof item.value === "boolean") return item.value;
  const normalized = String(item.value ?? "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new Error(`${label} is malformed`);
}

/** Convert the contract's seconds-or-milliseconds expiration into epoch ms. */
export function normalizeNnsExpiryMs(raw: unknown): number {
  let ms = Number(strictInteger(raw, "NNS expiration"));
  if (!Number.isFinite(ms) || ms <= 0) throw new Error("NNS expiration is malformed");
  if (ms < 1e12) ms *= 1000;
  if (ms > MAX_PLAUSIBLE_EXPIRY_MS) ms = Math.floor(ms / 1000);
  if (!Number.isSafeInteger(ms) || ms <= 0 || ms > MAX_PLAUSIBLE_EXPIRY_MS) {
    throw new Error("NNS expiration is outside the supported range");
  }
  return ms;
}

/** Format an exact Fixed8 GAS integer without passing through floating point. */
export function formatGasBaseUnits(raw: unknown): string {
  const units = strictInteger(raw, "NNS price", true);
  if (units < 0n) return "";
  const whole = units / 100_000_000n;
  const fraction = (units % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) return new Uint8Array();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base58Encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const byte of bytes) num = num * 256n + BigInt(byte);
  let out = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num /= 58n;
    out = BASE58_ALPHABET[rem] + out;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = BASE58_ALPHABET[0] + out;
  }
  return out;
}

/**
 * Encode a 20-byte script hash (chain / little-endian byte order, exactly as
 * `ownerOf` returns it) into a Neo N3 N-address. Returns "" when the input is
 * not a 20-byte hash.
 *
 * The owner value read from chain arrives little-endian; an N-address is the
 * Base58Check of `version(0x35) + 20 raw script-hash bytes + checksum`, where
 * those 20 bytes are already in the little-endian order the read provides — no
 * reversal is applied (verified: `ownerOf(neo.neo)` little-endian bytes
 * `fda64993…` encode to `Nj39M97Rk2e23JiULBBMQmvpcnKaRHqxFf`).
 */
export function scriptHashToAddress(scriptHashLe: string): string {
  const bytes = hexToBytes(scriptHashLe);
  if (bytes.length !== 20) return "";
  const payload = new Uint8Array(21);
  payload[0] = NEO_N3_ADDRESS_VERSION;
  payload.set(bytes, 1);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  const full = new Uint8Array(25);
  full.set(payload, 0);
  full.set(checksum, 21);
  return base58Encode(full);
}

/**
 * Normalise a raw NNS owner value into display form.
 *
 * Accepts the shapes a `chain.read("ownerOf")` can produce — a base64
 * ByteString value, a `0x`-prefixed little-endian hex string (the
 * `parseByteLike` fallback), or a bare 40-char hex string — and returns the
 * N-address. Falls back to the original value when it is not a 20-byte hash.
 */
export function ownerValueToAddress(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  // Already an N-address.
  if (/^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw)) return raw;
  // 0x-hex (little-endian) form from parseByteLike.
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return scriptHashToAddress(raw) || raw;
  }
  // Bare 40-char hex.
  if (/^[0-9a-fA-F]{40}$/.test(raw)) {
    return scriptHashToAddress(raw) || raw;
  }
  // Raw base64 ByteString (20 bytes).
  try {
    const binary = atob(raw);
    if (binary.length === 20) {
      const bytes = new Uint8Array(20);
      for (let i = 0; i < 20; i += 1) bytes[i] = binary.charCodeAt(i);
      return scriptHashToAddress(bytesToHex(bytes)) || raw;
    }
  } catch {
    /* not base64 */
  }
  return raw;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode a getnep11balances hex token id (e.g. "6e656f2e6e656f") into "neo.neo". */
function tokenIdHexToName(tokenIdHex: string): string {
  const bytes = hexToBytes(tokenIdHex);
  if (bytes.length === 0) return "";
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "";
  }
}

function readByteStringText(item: RpcStackItem | undefined): string {
  if (!item || item.value == null) return "";
  if (item.type === "ByteString" || item.type === "ByteArray") {
    try {
      const binary = atob(String(item.value));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return "";
    }
  }
  return item.type === "String" ? String(item.value) : "";
}

function readOptionalText(item: RpcStackItem | undefined, label: string): string | undefined {
  if (!item || item.type === "Any" || item.value == null) return undefined;
  const text = readByteStringText(item).trim();
  if (!text) throw new Error(`${label} is malformed`);
  return text;
}

function findMapValue(stack: RpcStackItem[] | undefined, key: string): RpcStackItem | undefined {
  const map = stack?.[0];
  if (!map || map.type !== "Map" || !Array.isArray(map.value)) return undefined;
  for (const entry of map.value as Array<{ key?: RpcStackItem; value?: RpcStackItem }>) {
    const entryKey = readByteStringText(entry.key);
    if (entryKey === key) return entry.value;
  }
  return undefined;
}

async function invokeRead(
  network: NeoNetwork,
  scriptHash: string,
  operation: string,
  args: unknown[],
): Promise<RpcStackItem[]> {
  const result = await rpcCall<RpcInvokeResult>(network, "invokefunction", [
    scriptHash,
    operation,
    args,
  ]);
  return requireHalt(result, operation);
}

async function readProperties(
  network: NeoNetwork,
  scriptHash: string,
  tokenIdBase64: string,
): Promise<{ name?: string; expiration: number }> {
  const stack = await invokeRead(network, scriptHash, "properties", [
    { type: "ByteArray", value: tokenIdBase64 },
  ]);
  const name = readOptionalText(findMapValue(stack, "name"), "NNS property name");
  const expirationItem = findMapValue(stack, "expiration");
  return { ...(name ? { name } : {}), expiration: normalizeNnsExpiryMs(expirationItem?.value) };
}

async function readTarget(
  network: NeoNetwork,
  scriptHash: string,
  name: string,
): Promise<string | undefined> {
  const stack = await invokeRead(network, scriptHash, "resolve", [
    { type: "String", value: name },
    { type: "Integer", value: String(RECORD_TYPE_ADDRESS) },
  ]);
  return readOptionalText(stack[0], "NNS target");
}

async function readOwner(
  network: NeoNetwork,
  scriptHash: string,
  tokenIdBase64: string,
): Promise<string> {
  const stack = await invokeRead(network, scriptHash, "ownerOf", [
    { type: "ByteArray", value: tokenIdBase64 },
  ]);
  const owner = ownerValueToAddress(stack[0]?.value);
  if (!/^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(owner)) throw new Error("NNS owner is malformed");
  return owner;
}

/** Strict owner/expiry read for one registered root name. Target is opt-in. */
export async function readNnsNameSnapshot(
  network: NeoNetwork,
  scriptHash: string,
  name: string,
  options: { includeTarget?: boolean } = {},
): Promise<NnsNameSnapshot> {
  if (!normalizeContractHash(scriptHash)) throw new Error("NNS contract hash is malformed");
  if (!NNS_ROOT_NAME_PATTERN.test(name)) throw new Error("NNS name is malformed");
  const tokenIdBase64 = bytesToBase64(new TextEncoder().encode(name));
  const [owner, properties, target] = await Promise.all([
    readOwner(network, scriptHash, tokenIdBase64),
    readProperties(network, scriptHash, tokenIdBase64),
    options.includeTarget ? readTarget(network, scriptHash, name) : Promise.resolve(undefined),
  ]);
  if (!properties.name || properties.name !== name) throw new Error("NNS property name does not match the requested name");
  return { name, owner, expiration: properties.expiration, ...(target ? { target } : {}) };
}

/**
 * Read availability and exact price. A false availability with a negative
 * price is committee-reserved rather than owned, so owner/expiry reads are not
 * attempted for that legitimate state.
 */
export async function readNnsSearchSnapshot(
  network: NeoNetwork,
  scriptHash: string,
  name: string,
): Promise<NnsSearchSnapshot> {
  if (!normalizeContractHash(scriptHash)) throw new Error("NNS contract hash is malformed");
  if (!NNS_ROOT_NAME_PATTERN.test(name)) throw new Error("NNS name is malformed");
  const baseName = name.endsWith(".neo") ? name.slice(0, -4) : name;
  const [availabilityStack, priceStack] = await Promise.all([
    invokeRead(network, scriptHash, "isAvailable", [{ type: "String", value: name }]),
    invokeRead(network, scriptHash, "getPrice", [{ type: "Integer", value: String(baseName.length) }]),
  ]);
  const available = strictBoolean(availabilityStack[0], "NNS availability");
  const priceBase = strictInteger(priceStack[0]?.value, "NNS price", true).toString();
  if (available) {
    if (BigInt(priceBase) < 0n) throw new Error("NNS returned an available name with a restricted price");
    return { name, availability: "available", priceBase };
  }
  if (BigInt(priceBase) < 0n) return { name, availability: "restricted", priceBase };
  const registered = await readNnsNameSnapshot(network, scriptHash, name);
  return {
    name,
    availability: "owned",
    priceBase,
    owner: registered.owner,
    expiration: registered.expiration,
  };
}

/**
 * Resolve every `.neo` domain owned by `address` via `getnep11balances`, then
 * hydrate each with its expiry (properties) and target (resolve). Read-only.
 *
 * @param address   - the owner's N-address
 * @param network   - the active chain network id ("neo-n3-mainnet" etc.)
 * @param contractHash - the NNS contract script hash (0x-prefixed)
 */
export async function fetchOwnedDomains(
  address: string,
  network: string,
  contractHash: string,
): Promise<OwnedDomain[]> {
  if (!address) return [];
  const networkName = String(network ?? "").trim().toLowerCase();
  if (!["mainnet", "testnet", "neo-n3-mainnet", "neo-n3-testnet"].includes(networkName)) {
    throw new Error("NNS network is malformed");
  }
  const net = resolveNeoNetwork(network);
  const normalizedContract = normalizeContractHash(contractHash);
  if (!normalizedContract) throw new Error("NNS contract hash is malformed");

  const result = await rpcCall<{ balance?: Nep11Balance[] }>(net, "getnep11balances", [address]);
  if (!Array.isArray(result.balance)) throw new Error("getnep11balances returned a malformed balance list");
  const nnsBalance = result.balance.find(
    (balance) => String(balance.assethash ?? "").toLowerCase() === normalizedContract,
  );
  if (nnsBalance && !Array.isArray(nnsBalance.tokens)) throw new Error("NNS balance returned a malformed token list");
  const tokens = nnsBalance?.tokens ?? [];
  if (tokens.length === 0) return [];
  if (tokens.length > MAX_OWNED_DOMAIN_ROWS) {
    throw new Error("NNS balance returned too many token rows");
  }

  const domains = new Array<OwnedDomain>(tokens.length);
  const seenTokenIds = new Set<string>();
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(OWNED_DOMAIN_READ_CONCURRENCY, tokens.length) },
    async () => {
      while (cursor < tokens.length) {
        const index = cursor;
        cursor += 1;
        const token = tokens[index]!;
        const tokenIdHex = String(token.tokenid ?? "").toLowerCase();
        if (
          !tokenIdHex || tokenIdHex.length > MAX_TOKEN_ID_HEX_CHARS ||
          tokenIdHex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(tokenIdHex)
        ) throw new Error("NNS balance returned a malformed token id");
        if (seenTokenIds.has(tokenIdHex)) throw new Error("NNS balance returned a duplicate token id");
        seenTokenIds.add(tokenIdHex);
        const name = tokenIdHexToName(tokenIdHex);
        if (!NNS_ROOT_NAME_PATTERN.test(name)) throw new Error("NNS balance returned a malformed token id");
        if (String(token.amount ?? "") !== "1") {
          throw new Error("NNS balance returned a non-unique token amount");
        }
        const tokenIdBase64 = bytesToBase64(hexToBytes(tokenIdHex));
        const [properties, target] = await Promise.all([
          readProperties(net, contractHash, tokenIdBase64),
          readTarget(net, contractHash, name),
        ]);
        if (!properties.name || properties.name !== name) {
          throw new Error("NNS balance and properties names do not match");
        }
        domains[index] = { name, expiration: properties.expiration, ...(target ? { target } : {}) };
      }
    },
  );
  await Promise.all(workers);

  return domains;
}

function normalizeContractHash(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(raw) ? raw : "";
}

function reverseHash(value: string): string {
  const clean = normalizeContractHash(value);
  if (!clean) return "";
  return `0x${(clean.slice(2).match(/../g) ?? []).reverse().join("")}`;
}

function contractMatches(value: unknown, expected: string): boolean {
  const actual = normalizeContractHash(value);
  const canonical = normalizeContractHash(expected);
  return Boolean(actual && canonical && (actual === canonical || reverseHash(actual) === canonical));
}

function notificationState(value: unknown): RpcStackItem[] | null {
  if (Array.isArray(value)) return value as RpcStackItem[];
  if (value && typeof value === "object") {
    const record = value as RpcStackItem;
    if (record.type === "Array" && Array.isArray(record.value)) return record.value as RpcStackItem[];
  }
  return null;
}

function parseTransferNotification(state: RpcStackItem[]): NnsTransferEvent | null {
  if (state.length !== 4) return null;
  const from = state[0]?.type === "Any" ? "" : ownerValueToAddress(state[0]?.value);
  const to = ownerValueToAddress(state[1]?.value);
  const amount = String(state[2]?.value ?? "").trim();
  const name = readByteStringText(state[3]).trim();
  if ((from && !/^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(from)) || !/^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(to)) return null;
  if (!/^\d+$/.test(amount) || !name) return null;
  return { from, to, amount, name };
}

function parseRenewNotification(state: RpcStackItem[]): NnsRenewEvent | null {
  if (state.length !== 3) return null;
  const name = readByteStringText(state[0]).trim();
  if (!name) return null;
  try {
    return {
      name,
      oldExpiration: normalizeNnsExpiryMs(state[1]?.value),
      newExpiration: normalizeNnsExpiryMs(state[2]?.value),
    };
  } catch {
    return null;
  }
}

/** Read the VM result and exact NNS notifications for a broadcast txid. */
export async function readNnsTransactionOutcome(
  network: NeoNetwork,
  txid: string,
  contractHash: string,
): Promise<NnsTransactionOutcome> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(txid ?? "").trim()) || !normalizeContractHash(contractHash)) {
    return { state: "unknown", transfer: null, renew: null };
  }
  try {
    const result = await rpcCall<{
      executions?: Array<{
        vmstate?: unknown;
        notifications?: Array<{ contract?: unknown; eventname?: unknown; state?: unknown }>;
      }>;
    }>(network, "getapplicationlog", [txid]);
    const executions = result.executions ?? [];
    if (executions.length === 0) return { state: "unknown", transfer: null, renew: null };
    const states = executions.map((execution) => String(execution.vmstate ?? "").toUpperCase());
    if (states.some((state) => state.includes("FAULT"))) {
      return { state: "fault", transfer: null, renew: null };
    }
    if (!states.every((state) => state.includes("HALT"))) {
      return { state: "unknown", transfer: null, renew: null };
    }
    let transfer: NnsTransferEvent | null = null;
    let renew: NnsRenewEvent | null = null;
    let transferCount = 0;
    let renewCount = 0;
    for (const notification of executions.flatMap((execution) => execution.notifications ?? [])) {
      if (!contractMatches(notification.contract, contractHash)) continue;
      const state = notificationState(notification.state);
      if (!state) continue;
      if (notification.eventname === "Transfer") {
        transferCount += 1;
        transfer = parseTransferNotification(state);
      }
      if (notification.eventname === "Renew") {
        renewCount += 1;
        renew = parseRenewNotification(state);
      }
    }
    if (transferCount !== 1) transfer = null;
    if (renewCount !== 1) renew = null;
    return { state: "halt", transfer, renew };
  } catch {
    return { state: "unknown", transfer: null, renew: null };
  }
}
