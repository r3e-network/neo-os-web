import type { MiniAppFramework } from "@shared/react";
import type { FrameworkContractArg } from "@framework/index";
import { GAS_HASH, type NeoNetwork } from "@shared/constants/rpc";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import {
  aaMarketAccountMatches,
  normalizeAAMarketAccount,
  parseChainHash160,
  readAAMarketRpc,
  readAAMarketRpcBatch,
  requireCanonicalAAMarketContext,
  type AAMarketContext,
} from "../aa-market-safety";

const LISTING_STATUS: Record<number, MarketListing["status"]> = {
  1: "active",
  2: "sold",
  3: "cancelled",
};

export const MAX_LISTINGS = 200;
const RPC_CHUNK_SIZE = 20;
const MIN_PRICE_RAW = 1_000_000n; // 0.01 GAS
const MAX_PRICE_RAW = 100_000_000_000n; // 1,000 GAS

const MARKET_HASH_BY_NETWORK: Record<NeoNetwork, string> = {
  mainnet: "0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69",
  testnet: "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf",
};

const AA_CORE_HASH_BY_NETWORK: Record<NeoNetwork, string> = {
  mainnet: "0x0268a387913b250166ddec032b03332690a1ef78",
  testnet: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
};

export interface ListAddressListingsResult {
  listings: MarketListing[];
  total: number;
  truncated: boolean;
  failedReads: number;
  source: "chain" | "partial";
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
  status: "active" | "sold" | "cancelled" | "unknown";
  createdAt: string;
  updatedAt: string;
  myPendingPayment: string;
  pendingPaymentKnown: boolean;
  isMine: boolean;
  isCanonicalAA: boolean;
}

export interface CreateListingInput {
  aaContractHash?: string;
  accountIdHash: string;
  priceGas: string;
  title?: string;
  metadataUri?: string;
}

export interface MarketInvokeOptions {
  onTransactionSent?: (txid: string) => void;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function unsigned(value: unknown, label: string): string {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) throw new Error(`${label} is malformed.`);
  return BigInt(raw).toString();
}

function positive(value: unknown, label: string): string {
  const parsed = unsigned(value, label);
  if (BigInt(parsed) <= 0n) throw new Error(`${label} must be positive.`);
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is malformed.`);
  return value;
}

function hash160(value: unknown, label: string, allowEmpty = false): string {
  if (allowEmpty && (value === "" || value === null || value === undefined)) return "";
  const parsed = parseChainHash160(value);
  if (!parsed) throw new Error(`${label} is malformed.`);
  return parsed;
}

function normalizeHash160Input(value: unknown, label: string): string {
  const normalized = normalizeAAMarketAccount(value);
  if (!normalized) throw new Error(`${label} must be a Neo address or 20-byte hash.`);
  return normalized;
}

export function getDefaultMarketHash(network: NeoNetwork = "mainnet"): string {
  return MARKET_HASH_BY_NETWORK[network];
}

export function getDefaultAAContractHash(network: NeoNetwork = "mainnet"): string {
  return AA_CORE_HASH_BY_NETWORK[network];
}

export function parseGasToFractions(value: unknown): string {
  const raw = clean(value);
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) {
    throw new Error("Price must use up to 8 decimal places.");
  }
  const [wholePart, fractionPart = ""] = raw.split(".");
  const total = BigInt(wholePart || "0") * 100_000_000n
    + BigInt((fractionPart + "00000000").slice(0, 8));
  if (total < MIN_PRICE_RAW || total > MAX_PRICE_RAW) {
    throw new Error("Price must be between 0.01 and 1000 GAS.");
  }
  return total.toString();
}

export function formatGasFractions(value: unknown): string {
  const raw = BigInt(unsigned(value, "GAS amount"));
  const whole = raw / 100_000_000n;
  const fraction = raw % 100_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

function integerArg(value: string): FrameworkContractArg {
  return { type: "Integer", value };
}

function hashArg(value: string): FrameworkContractArg {
  return { type: "Hash160", value: normalizeScriptHash(value) };
}

function rpcIntegerArg(value: string) {
  return { type: "Integer", value };
}

function rpcHashArg(value: string) {
  return { type: "Hash160", value: normalizeScriptHash(value) };
}

function decodeListing(
  row: unknown,
  context: AAMarketContext,
): Omit<MarketListing, "myPendingPayment" | "pendingPaymentKnown" | "isMine"> {
  if (!Array.isArray(row) || row.length < 11) throw new Error("Listing row is malformed.");
  const id = positive(row[0], "Listing ID");
  const aaContractHash = hash160(row[1], "AA contract");
  const accountIdHash = hash160(row[2], "Account ID");
  const seller = hash160(row[3], "Seller");
  const priceRaw = positive(row[4], "Listing price");
  const title = text(row[5], "Listing title");
  const metadataUri = text(row[6], "Listing metadata");
  const statusRaw = BigInt(unsigned(row[7], "Listing status"));
  if (statusRaw > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Listing status is too large.");
  const statusCode = Number(statusRaw);
  const buyer = hash160(row[8], "Buyer", true);
  const createdAt = unsigned(row[9], "Created time");
  const updatedAt = unsigned(row[10], "Updated time");
  if (title.length > 80 || metadataUri.length > 240) throw new Error("Listing text exceeds contract limits.");
  return {
    id,
    aaContractHash,
    accountIdHash,
    sellerScriptHash: seller.replace(/^0x/i, ""),
    buyerScriptHash: buyer.replace(/^0x/i, ""),
    seller,
    buyer,
    priceRaw,
    priceGas: formatGasFractions(priceRaw),
    title,
    metadataUri,
    statusCode,
    status: LISTING_STATUS[statusCode] ?? "unknown",
    createdAt,
    updatedAt,
    isCanonicalAA: aaMarketAccountMatches(aaContractHash, context.aaCoreHash),
  };
}

async function canonicalContext(
  app: MiniAppFramework,
  marketHash?: string,
): Promise<AAMarketContext> {
  const context = await requireCanonicalAAMarketContext(app);
  if (marketHash && !aaMarketAccountMatches(marketHash, context.marketHash)) {
    throw new Error("aaMarketChainContextMismatch");
  }
  return context;
}

async function mapChunks<T, R>(
  items: T[],
  size: number,
  worker: (slice: T[]) => Promise<R[]>,
): Promise<R[]> {
  const output: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(...await worker(items.slice(index, index + size)));
  }
  return output;
}

export async function getPendingPaymentOf(
  app: MiniAppFramework,
  marketHash: string,
  listingId: string,
  payerAddress?: string | null,
): Promise<string> {
  if (!payerAddress) return "0";
  const context = await canonicalContext(app, marketHash);
  const payerHash = normalizeHash160Input(payerAddress, "Payer");
  const value = await readAAMarketRpc(context, context.marketHash, "getPendingPaymentOf", [
    rpcIntegerArg(positive(listingId, "Listing ID")),
    rpcHashArg(payerHash),
  ]);
  return unsigned(value, "Pending payment");
}

export async function readAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  listingId: string,
  currentAddress?: string | null,
): Promise<MarketListing> {
  const context = await canonicalContext(app, marketHash);
  const value = await readAAMarketRpc(context, context.marketHash, "getListing", [
    rpcIntegerArg(positive(listingId, "Listing ID")),
  ]);
  const listing = decodeListing(value, context);
  let myPendingPayment = "0";
  let pendingPaymentKnown = !currentAddress;
  if (currentAddress) {
    try {
      myPendingPayment = await getPendingPaymentOf(app, marketHash, listing.id, currentAddress);
      pendingPaymentKnown = true;
    } catch {
      pendingPaymentKnown = false;
    }
  }
  return {
    ...listing,
    myPendingPayment,
    pendingPaymentKnown,
    isMine: aaMarketAccountMatches(listing.seller, currentAddress),
  };
}

export async function listAddressListings(
  app: MiniAppFramework,
  marketHash: string,
  currentAddress?: string | null,
): Promise<ListAddressListingsResult> {
  const context = await canonicalContext(app, marketHash);
  const countRaw = await readAAMarketRpc(context, context.marketHash, "getListingCount");
  const countString = unsigned(countRaw, "Listing count");
  const count = Number(countString);
  if (!Number.isSafeInteger(count)) throw new Error("Listing count is too large.");
  if (count === 0) {
    return { listings: [], total: 0, truncated: false, failedReads: 0, source: "chain" };
  }

  const fetchCount = Math.min(count, MAX_LISTINGS);
  const ids = Array.from({ length: fetchCount }, (_, index) => count - index);
  let failedReads = 0;
  const decoded = await mapChunks(ids, RPC_CHUNK_SIZE, async (slice) => {
    const results = await readAAMarketRpcBatch(context, slice.map((id) => ({
      id: `listing:${id}`,
      scriptHash: context.marketHash,
      operation: "getListing",
      args: [rpcIntegerArg(String(id))],
    })));
    return slice.flatMap((id) => {
      const result = results.get(`listing:${id}`);
      if (!result?.ok) {
        failedReads += 1;
        return [];
      }
      try {
        return [decodeListing(result.value, context)];
      } catch {
        failedReads += 1;
        return [];
      }
    });
  });

  let pendingById = new Map<string, string>();
  let unknownPending = new Set<string>();
  if (currentAddress) {
    const payerHash = normalizeHash160Input(currentAddress, "Payer");
    pendingById = new Map();
    unknownPending = new Set();
    await mapChunks(decoded, RPC_CHUNK_SIZE, async (slice) => {
      const results = await readAAMarketRpcBatch(context, slice.map((listing) => ({
        id: `pending:${listing.id}`,
        scriptHash: context.marketHash,
        operation: "getPendingPaymentOf",
        args: [rpcIntegerArg(listing.id), rpcHashArg(payerHash)],
      })));
      for (const listing of slice) {
        const result = results.get(`pending:${listing.id}`);
        if (!result?.ok) {
          unknownPending.add(listing.id);
          continue;
        }
        try {
          pendingById.set(listing.id, unsigned(result.value, "Pending payment"));
        } catch {
          unknownPending.add(listing.id);
        }
      }
      return slice;
    });
  }

  const listings = decoded.map((listing) => ({
    ...listing,
    myPendingPayment: pendingById.get(listing.id) ?? "0",
    pendingPaymentKnown: !currentAddress || !unknownPending.has(listing.id),
    isMine: aaMarketAccountMatches(listing.seller, currentAddress),
  }));
  failedReads += unknownPending.size;
  return {
    listings,
    total: count,
    truncated: count > fetchCount,
    failedReads,
    source: failedReads > 0 ? "partial" : "chain",
  };
}

function requireAddress(address: string | null | undefined): string {
  const trimmed = clean(address);
  if (!trimmed || !normalizeAAMarketAccount(trimmed)) throw new Error("Wallet not connected.");
  return trimmed;
}

function txid(result: unknown): string {
  const value = clean((result as { txid?: unknown } | null)?.txid);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("Wallet did not return a transaction ID.");
  return value;
}

function titleAndMetadata(input: CreateListingInput) {
  const title = clean(input.title);
  const metadataUri = clean(input.metadataUri);
  if (title.length > 80) throw new Error("Listing title must be 80 characters or fewer.");
  if (metadataUri.length > 240) throw new Error("Metadata URI must be 240 characters or fewer.");
  return { title, metadataUri };
}

export async function createAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  input: CreateListingInput,
  options: MarketInvokeOptions = {},
): Promise<{ txid: string }> {
  const context = await canonicalContext(app, marketHash);
  const address = requireAddress(callerAddress);
  const aaContractHash = normalizeHash160Input(input.aaContractHash || context.aaCoreHash, "AA contract");
  if (!aaMarketAccountMatches(aaContractHash, context.aaCoreHash)) throw new Error("aaMarketChainContextMismatch");
  const accountIdHash = normalizeHash160Input(input.accountIdHash, "Account ID");
  const { title, metadataUri } = titleAndMetadata(input);
  const result = await app.chain.invoke("createListing", [
    hashArg(aaContractHash),
    hashArg(accountIdHash),
    integerArg(parseGasToFractions(input.priceGas)),
    { type: "String", value: title },
    { type: "String", value: metadataUri },
  ], {
    scriptHash: context.marketHash,
    signers: [{
      account: address,
      scopes: 16,
      allowedContracts: [context.marketHash, context.aaCoreHash],
    }],
    notify: "silent",
    onTransactionSent: options.onTransactionSent,
  });
  return { txid: txid(result) };
}

export async function updateAddressListingPrice(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listingId: string,
  priceGas: string,
  options: MarketInvokeOptions = {},
): Promise<{ txid: string }> {
  const context = await canonicalContext(app, marketHash);
  const address = requireAddress(callerAddress);
  const result = await app.chain.invoke("updateListingPrice", [
    integerArg(positive(listingId, "Listing ID")),
    integerArg(parseGasToFractions(priceGas)),
  ], {
    scriptHash: context.marketHash,
    signers: [{ account: address, scopes: 1 }],
    notify: "silent",
    onTransactionSent: options.onTransactionSent,
  });
  return { txid: txid(result) };
}

export async function cancelAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listingId: string,
  options: MarketInvokeOptions = {},
): Promise<{ txid: string }> {
  const context = await canonicalContext(app, marketHash);
  const address = requireAddress(callerAddress);
  const result = await app.chain.invoke("cancelListing", [
    integerArg(positive(listingId, "Listing ID")),
  ], {
    scriptHash: context.marketHash,
    signers: [{ account: address, scopes: 1 }],
    notify: "silent",
    onTransactionSent: options.onTransactionSent,
  });
  return { txid: txid(result) };
}

export async function buyAddressListing(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listing: Pick<MarketListing, "id" | "priceRaw">,
  options: MarketInvokeOptions & { newBackupOwner?: string },
): Promise<{ txid: string }> {
  const context = await canonicalContext(app, marketHash);
  const address = requireAddress(callerAddress);
  const buyerHash = normalizeHash160Input(address, "Buyer");
  const backupOwner = normalizeHash160Input(options.newBackupOwner || address, "Backup owner");
  const listingId = positive(listing.id, "Listing ID");
  const priceRaw = positive(listing.priceRaw, "Listing price");
  const result = await app.chain.invokeMultiple([
    {
      scriptHash: GAS_HASH,
      operation: "transfer",
      args: [
        hashArg(buyerHash),
        hashArg(context.marketHash),
        integerArg(priceRaw),
        // AAAddressMarket.OnNEP17Payment parses this exact listing id. Any/null
        // leaves funds unassociated and makes settleListing fail.
        integerArg(listingId),
      ],
    },
    {
      scriptHash: context.marketHash,
      operation: "settleListing",
      args: [integerArg(listingId), hashArg(buyerHash), hashArg(backupOwner)],
    },
  ], {
    signers: [{ account: address, scopes: 1 }],
    notify: "silent",
    onTransactionSent: options.onTransactionSent,
  });
  return { txid: txid(result) };
}

export async function refundPendingAddressPurchase(
  app: MiniAppFramework,
  marketHash: string,
  callerAddress: string,
  listingId: string,
  options: MarketInvokeOptions = {},
): Promise<{ txid: string }> {
  const context = await canonicalContext(app, marketHash);
  const address = requireAddress(callerAddress);
  const payerHash = normalizeHash160Input(address, "Payer");
  const result = await app.chain.invoke("refundPendingPayment", [
    integerArg(positive(listingId, "Listing ID")),
    hashArg(payerHash),
  ], {
    scriptHash: context.marketHash,
    signers: [{ account: address, scopes: 1 }],
    notify: "silent",
    onTransactionSent: options.onTransactionSent,
  });
  return { txid: txid(result) };
}

export function addressHash(address: string): string {
  return normalizeAAMarketAccount(addressToScriptHash(address) || address);
}
