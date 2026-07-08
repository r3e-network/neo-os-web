import {
  GAS_HASH,
  getExternalIntegrationConfig,
  getNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import {
  addressToScriptHash,
  normalizeScriptHash,
  ownerMatchesAddress,
  parseHash160,
} from "@shared/utils/neo";
import type { MiniAppFramework } from "@shared/react";
import type { FrameworkContractArg } from "@framework/index";

const LISTING_STATUS: Record<number, string> = {
  1: "active",
  2: "sold",
  3: "cancelled",
};

// Cap the number of listings fetched/rendered per load to avoid flooding the
// RPC with hundreds of concurrent reads and mounting an unbounded DOM list.
export const MAX_LISTINGS = 200;
// Number of concurrent reads per batch when fanning out per-listing fetches.
const READ_CHUNK_SIZE = 20;

async function runChunked<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    const slice = items.slice(start, start + size);
    const settled = await Promise.all(
      slice.map((item, offset) => worker(item, start + offset)),
    );
    results.push(...settled);
  }
  return results;
}

export interface ListAddressListingsResult {
  listings: MarketListing[];
  total: number;
  truncated: boolean;
}

export interface MarketListing {
  id: string;
  aaContractHash: string;
  accountIdHash: string;
  sellerScriptHash: string;
  buyerScriptHash: string;
  seller: string;
  buyer: string;
  priceRaw: string;
  priceGas: string;
  title: string;
  metadataUri: string;
  statusCode: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  myPendingPayment: string;
  isMine: boolean;
}

export interface CreateListingInput {
  aaContractHash?: string;
  accountIdHash: string;
  priceGas: string;
  title?: string;
  metadataUri?: string;
}

export function getDefaultAAContractHash(): string {
  return normalizeScriptHash(getExternalIntegrationConfig().contracts.aaCore);
}

// The canonical AAAddressMarket contract for the active network. The runtime
// integration config carries it on mainnet but not testnet, so fall back to the
// app's deployment manifest hashes (which declare both) — a first-time user must
// not face an empty board for a market the app already knows.
const MARKET_HASH_BY_NETWORK: Record<string, string> = {
  mainnet: "0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69",
  testnet: "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf",
};

export function getDefaultMarketHash(network?: NeoNetwork): string {
  const fromIntegration = getExternalIntegrationConfig(network).contracts.aaAddressMarket;
  const resolved = fromIntegration || MARKET_HASH_BY_NETWORK[network ?? getNetwork()] || "";
  return resolved ? normalizeScriptHash(resolved) : "";
}

function sanitizeHex(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^0x/i, "");
}

function normalizeHash160Input(value: unknown, label: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error(`${label} is required.`);
  }

  if (raw.startsWith("N")) {
    const hash = sanitizeHex(addressToScriptHash(raw));
    if (/^[0-9a-f]{40}$/.test(hash)) return hash;
    throw new Error(`${label} must be a Neo address or 20-byte hash.`);
  }

  const normalized = sanitizeHex(raw);
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`${label} must be a 20-byte hash.`);
  }
  return normalized;
}

function parseGasToFractions(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) {
    throw new Error(
      "Price must be a positive GAS amount with up to 8 decimals.",
    );
  }

  const [wholePart, fractionPart = ""] = raw.split(".");
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt((fractionPart + "00000000").slice(0, 8));
  const total = whole * 100000000n + fraction;
  if (total <= 0n) {
    throw new Error("Price must be positive.");
  }
  return total.toString();
}

export function formatGasFractions(value: unknown): string {
  const raw = BigInt(String(value ?? "0") || "0");
  const whole = raw / 100000000n;
  const fraction = raw % 100000000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

// ---------------------------------------------------------------------------
// Parsed stack-value decoding
//
// Reads now go through app.chain (readRaw / enumerate), whose host lane parses
// stack items before they reach the app (Integer → number|string, ByteString →
// printable text or chain-order 0x-hex). The decoders below reproduce the
// legacy raw-stack decode byte-for-byte on those parsed shapes: hashes come
// back in the same bare display-order hex, integers as the same decimal
// strings, titles as the same UTF-8 text.
// ---------------------------------------------------------------------------

/** Legacy decodeInteger on a parsed stack value — always a decimal string. */
function parsedIntegerString(value: unknown): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) return trimmed;
    // ByteString-integer lane: the parser renders non-text bytes as 0x-hex;
    // the legacy decoder read those bytes as a big-endian BigInt.
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      try {
        return BigInt(trimmed).toString();
      } catch {
        return "0";
      }
    }
  }
  return "0";
}

/**
 * Legacy decodeHash160 on a parsed stack value: UInt160 ByteStrings arrive
 * from the parser as chain-order 0x-hex (or, when all 20 bytes are printable,
 * as text). parseHash160 accepts both shapes and returns the display-order
 * 0x-hex; strip the prefix to keep the bare-hex shape the raw decoder exposed
 * (normalizeScriptHash re-adds the prefix downstream). Empty/absent buyer
 * fields decode to "" exactly as before.
 */
function parsedHash160Hex(value: unknown): string {
  return parseHash160(value).replace(/^0x/i, "");
}

/** Legacy decodeByteString on a parsed stack value — text or "". */
function parsedText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function decodeListing(
  row: unknown,
): Omit<MarketListing, "myPendingPayment" | "isMine"> | null {
  if (!Array.isArray(row) || row.length === 0) return null;

  const [
    idItem,
    aaContractItem,
    accountIdItem,
    sellerItem,
    priceItem,
    titleItem,
    metadataUriItem,
    statusItem,
    buyerItem,
    createdAtItem,
    updatedAtItem,
  ] = row;

  const statusCode = Number(parsedIntegerString(statusItem));
  const sellerScriptHash = parsedHash160Hex(sellerItem);
  const buyerScriptHash = parsedHash160Hex(buyerItem);

  return {
    id: parsedIntegerString(idItem),
    aaContractHash: normalizeScriptHash(parsedHash160Hex(aaContractItem)),
    accountIdHash: normalizeScriptHash(parsedHash160Hex(accountIdItem)),
    sellerScriptHash,
    buyerScriptHash,
    seller: sellerScriptHash ? normalizeScriptHash(sellerScriptHash) : "",
    buyer: buyerScriptHash ? normalizeScriptHash(buyerScriptHash) : "",
    priceRaw: parsedIntegerString(priceItem),
    priceGas: formatGasFractions(parsedIntegerString(priceItem)),
    title: parsedText(titleItem),
    metadataUri: parsedText(metadataUriItem),
    statusCode,
    status: LISTING_STATUS[statusCode] || "unknown",
    createdAt: parsedIntegerString(createdAtItem),
    updatedAt: parsedIntegerString(updatedAtItem),
  };
}

function requireAddress(address: string | null | undefined): string {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) {
    throw new Error("Wallet not connected.");
  }
  return trimmed;
}

/**
 * Market read through the framework passthrough. The host lane returns null
 * for a FAULTed read (a reverted read carries no data), so the legacy
 * throw-on-FAULT branch surfaces via {@link requireReadResult} where the
 * caller needs it.
 */
async function readMarket(
  app: MiniAppFramework,
  marketHash: string,
  operation: string,
  args: FrameworkContractArg[] = [],
): Promise<unknown> {
  return app.chain.readRaw(operation, args, {
    scriptHash: normalizeScriptHash(marketHash),
  });
}

/**
 * A null read result on an always-returning contract method means the read
 * FAULTed (wrong market hash / missing method). Rethrow the same sanitized
 * generic the legacy FAULT branch produced for unusable exception payloads so
 * the load flow keeps its error toast instead of presenting an empty board.
 */
function requireReadResult(value: unknown): unknown {
  if (value === null || value === undefined) {
    throw new Error("Contract operation failed");
  }
  return value;
}

export async function getPendingPaymentOf(
  app: MiniAppFramework,
  marketHash: string,
  listingId: string,
  payerAddress?: string | null,
): Promise<string> {
  if (!payerAddress) return "0";
  const payerHash = normalizeHash160Input(payerAddress, "Payer");
  const result = await readMarket(app, marketHash, "getPendingPaymentOf", [
    { type: "Integer", value: String(listingId) },
    { type: "Hash160", value: normalizeScriptHash(payerHash) },
  ]);
  // A FAULTed pending-payment read resolved to "0" in every legacy caller
  // (each one caught and defaulted); the parsed lane folds that in directly.
  return result === null || result === undefined
    ? "0"
    : parsedIntegerString(result);
}

export async function readAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  listingId: string,
  currentAddress?: string | null,
): Promise<MarketListing> {
  const result = await readMarket(app, marketHash, "getListing", [
    { type: "Integer", value: String(listingId) },
  ]);
  const decoded = decodeListing(result);
  if (!decoded) {
    throw new Error("Listing not found.");
  }

  const myPendingPayment = currentAddress
    ? await getPendingPaymentOf(
        app,
        marketHash,
        decoded.id,
        currentAddress,
      ).catch((e: unknown) => {
        console.warn(
          "[aa-market] getPendingPaymentOf failed, using '0':",
          e instanceof Error ? e.message : String(e),
        );
        return "0";
      })
    : "0";

  return {
    ...decoded,
    myPendingPayment,
    isMine: ownerMatchesAddress(decoded.seller, currentAddress),
  };
}

export async function listAddressListings(
  app: MiniAppFramework,
  marketHash: string,
  currentAddress?: string | null,
): Promise<ListAddressListingsResult> {
  const countResult = requireReadResult(
    await readMarket(app, marketHash, "getListingCount"),
  );
  const count = Number(parsedIntegerString(countResult));
  if (!Number.isFinite(count) || count <= 0) {
    return { listings: [], total: 0, truncated: false };
  }

  // Cap the work and fetch the most recent listings (highest ids) so the cap
  // does not silently hide newer entries behind older ones.
  const fetchCount = Math.min(count, MAX_LISTINGS);
  const truncated = count > fetchCount;
  const startId = count - fetchCount + 1;
  const ids = Array.from({ length: fetchCount }, (_, index) => startId + index);

  // Framework count-then-page fan-out: per-id read/decode failures are
  // swallowed (one bad row never sinks the page) and rows come back sorted
  // newest-first by numeric id — the same shape the hand-rolled chunked
  // fetch + filter + sort produced.
  const decoded = await app.chain.enumerate<
    Omit<MarketListing, "myPendingPayment" | "isMine">
  >({
    ids,
    cap: MAX_LISTINGS,
    detailOp: "getListing",
    detailArgs: (listingId) => [
      { type: "Integer", value: String(listingId) },
    ],
    decode: (raw) => decodeListing(raw),
    order: "newest",
    scriptHash: normalizeScriptHash(marketHash),
  });

  if (!currentAddress) {
    return {
      listings: decoded.map((listing) => ({
        ...listing,
        myPendingPayment: "0",
        isMine: false,
      })),
      total: count,
      truncated,
    };
  }

  const pendingPayments = await runChunked(
    decoded,
    READ_CHUNK_SIZE,
    (listing) =>
      getPendingPaymentOf(
        app,
        marketHash,
        listing.id,
        currentAddress,
      ).catch((e: unknown) => {
        console.warn(
          "[aa-market] getPendingPaymentOf failed for listing",
          listing.id,
          ":",
          e instanceof Error ? e.message : String(e),
        );
        return "0";
      }),
  );

  return {
    listings: decoded.map((listing, index) => ({
      ...listing,
      myPendingPayment: pendingPayments[index] || "0",
      isMine: ownerMatchesAddress(listing.seller, currentAddress),
    })),
    total: count,
    truncated,
  };
}

function buildEscrowCreationSigner(
  accountAddress: string,
  marketHash: string,
  aaContractHash: string,
) {
  return {
    account: accountAddress,
    scopes: 16,
    allowedContracts: [
      normalizeScriptHash(marketHash),
      normalizeScriptHash(aaContractHash),
    ],
  };
}

export async function createAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  input: CreateListingInput,
): Promise<{ txid: string }> {
  const address = requireAddress(callerAddress);
  const aaContractHash = normalizeHash160Input(
    input.aaContractHash || getDefaultAAContractHash(),
    "AA contract",
  );
  const accountIdHash = normalizeHash160Input(
    input.accountIdHash,
    "Account ID hash",
  );

  const result = await app.chain.invoke(
    "createListing",
    [
      { type: "Hash160", value: normalizeScriptHash(aaContractHash) },
      { type: "Hash160", value: normalizeScriptHash(accountIdHash) },
      { type: "Integer", value: parseGasToFractions(input.priceGas) },
      { type: "String", value: String(input.title ?? "").trim() },
      { type: "String", value: String(input.metadataUri ?? "").trim() },
    ],
    {
      scriptHash: normalizeScriptHash(marketHash),
      // scopes-16 (CustomContracts) with an allowedContracts pair: the escrow
      // creation witnesses both the market and the AA core contract.
      signers: [buildEscrowCreationSigner(address, marketHash, aaContractHash)],
    },
  );

  return { txid: String(result?.txid ?? "") };
}

export async function updateAddressListingPrice(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listingId: string,
  priceGas: string,
): Promise<{ txid: string }> {
  const address = requireAddress(callerAddress);
  const result = await app.chain.invoke(
    "updateListingPrice",
    [
      { type: "Integer", value: String(listingId) },
      { type: "Integer", value: parseGasToFractions(priceGas) },
    ],
    {
      scriptHash: normalizeScriptHash(marketHash),
      signers: [{ account: address, scopes: 1 }],
    },
  );

  return { txid: String(result?.txid ?? "") };
}

export async function cancelAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listingId: string,
): Promise<{ txid: string }> {
  const address = requireAddress(callerAddress);
  const result = await app.chain.invoke(
    "cancelListing",
    [{ type: "Integer", value: String(listingId) }],
    {
      scriptHash: normalizeScriptHash(marketHash),
      signers: [{ account: address, scopes: 1 }],
    },
  );

  return { txid: String(result?.txid ?? "") };
}

// The GAS transfer's `data` parameter must travel as an Any/null argument.
// FrameworkContractArg has no Any member (no framework surface builds one),
// but the wallet lane forwards the literal untouched — cast once here.
const ANY_NULL_ARG = { type: "Any", value: null } as unknown as FrameworkContractArg;

export async function buyAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listing: Pick<MarketListing, "id" | "priceRaw">,
  options: { newBackupOwner?: string },
): Promise<{ txid: string }> {
  const address = requireAddress(callerAddress);
  const buyerHash = normalizeHash160Input(address, "Buyer");
  const backupOwner = normalizeHash160Input(
    options.newBackupOwner || address,
    "Backup owner",
  );
  const marketScriptHash = normalizeScriptHash(marketHash);
  // Transfer-then-settle in ONE transaction (S7 chain.invokeMultiple): the
  // GAS payment and the settle call ride the same signer. notify:'silent'
  // because the buy operation owns its own toast keys — a FAULTed batch still
  // throws (sanitized) for the operation's error lane.
  const result = await app.chain.invokeMultiple(
    [
      {
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: normalizeScriptHash(buyerHash) },
          { type: "Hash160", value: marketScriptHash },
          { type: "Integer", value: String(listing.priceRaw) },
          ANY_NULL_ARG,
        ],
      },
      {
        scriptHash: marketScriptHash,
        operation: "settleListing",
        args: [
          { type: "Integer", value: String(listing.id) },
          { type: "Hash160", value: normalizeScriptHash(buyerHash) },
          { type: "Hash160", value: normalizeScriptHash(backupOwner) },
        ],
      },
    ],
    { signers: [{ account: address, scopes: 1 }], notify: "silent" },
  );

  return { txid: String(result?.txid ?? "") };
}

export async function refundPendingAddressPurchase(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listingId: string,
): Promise<{ txid: string }> {
  const address = requireAddress(callerAddress);
  const payerHash = normalizeHash160Input(address, "Payer");
  const result = await app.chain.invoke(
    "refundPendingPayment",
    [
      { type: "Integer", value: String(listingId) },
      { type: "Hash160", value: normalizeScriptHash(payerHash) },
    ],
    {
      scriptHash: normalizeScriptHash(marketHash),
      signers: [{ account: address, scopes: 1 }],
    },
  );

  return { txid: String(result?.txid ?? "") };
}
