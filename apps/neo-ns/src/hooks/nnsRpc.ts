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
/** NNS `resolve` record type for an address target (NEP-12 RecordType.A). */
const RECORD_TYPE_ADDRESS = 16;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_N3_ADDRESS_VERSION = 0x35;

export interface OwnedDomain {
  name: string;
  expiration: number;
  target?: string;
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
  stack?: RpcStackItem[];
}

async function rpcCall<T>(network: NeoNetwork, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(getRpcUrl(network), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || `${method} failed`);
  if (payload.result === undefined) throw new Error(`${method} returned an empty result`);
  return payload.result;
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
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      return "";
    }
  }
  return String(item.value);
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

async function readProperties(
  network: NeoNetwork,
  scriptHash: string,
  tokenIdBase64: string,
): Promise<{ expiration: number }> {
  const result = await rpcCall<RpcInvokeResult>(network, "invokefunction", [
    scriptHash,
    "properties",
    [{ type: "ByteArray", value: tokenIdBase64 }],
  ]);
  if (result.state !== "HALT") return { expiration: 0 };
  const expirationItem = findMapValue(result.stack, "expiration");
  const expiration = Number(expirationItem?.value ?? 0);
  return { expiration: Number.isFinite(expiration) ? expiration : 0 };
}

async function readTarget(
  network: NeoNetwork,
  scriptHash: string,
  name: string,
): Promise<string | undefined> {
  try {
    const result = await rpcCall<RpcInvokeResult>(network, "invokefunction", [
      scriptHash,
      "resolve",
      [
        { type: "String", value: name },
        { type: "Integer", value: String(RECORD_TYPE_ADDRESS) },
      ],
    ]);
    if (result.state !== "HALT") return undefined;
    const text = readByteStringText(result.stack?.[0]);
    return text || undefined;
  } catch {
    return undefined;
  }
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
  const net = resolveNeoNetwork(network);
  const normalizedContract = contractHash.toLowerCase();

  const result = await rpcCall<{ balance?: Nep11Balance[] }>(net, "getnep11balances", [address]);
  const nnsBalance = (result.balance ?? []).find(
    (balance) => String(balance.assethash ?? "").toLowerCase() === normalizedContract,
  );
  const tokens = nnsBalance?.tokens ?? [];
  if (tokens.length === 0) return [];

  const domains = await Promise.all(
    tokens.map(async (token) => {
      const tokenIdHex = String(token.tokenid ?? "");
      const name = tokenIdHexToName(tokenIdHex);
      if (!name) return null;
      const tokenIdBase64 = bytesToBase64(hexToBytes(tokenIdHex));
      try {
        const [{ expiration }, target] = await Promise.all([
          readProperties(net, contractHash, tokenIdBase64),
          readTarget(net, contractHash, name),
        ]);
        return { name, expiration, target } satisfies OwnedDomain;
      } catch {
        return { name, expiration: 0 } satisfies OwnedDomain;
      }
    }),
  );

  return domains.filter((domain): domain is OwnedDomain => domain !== null);
}
