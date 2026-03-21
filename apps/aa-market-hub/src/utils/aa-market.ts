import { GAS_HASH, getExternalIntegrationConfig } from "@shared/constants/rpc";
import { addressToScriptHash, normalizeScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import type { ContractArg, InvokeResult, WalletSDK } from "@shared/utils/wallet-sdk";

const LISTING_STATUS: Record<number, string> = {
  1: "active",
  2: "sold",
  3: "cancelled",
};

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

function sanitizeHex(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/^0x/i, "");
}

function reverseHex(hexValue: string): string {
  const hex = sanitizeHex(hexValue);
  let output = "";
  for (let index = hex.length; index > 0; index -= 2) {
    output += hex.slice(index - 2, index);
  }
  return output;
}

function base64ToBytes(value: unknown): Uint8Array {
  const binary = atob(String(value ?? ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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
    throw new Error("Price must be a positive GAS amount with up to 8 decimals.");
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

function decodeByteString(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const typed = item as { type?: string; value?: unknown };
  if (typed.type === "String") return String(typed.value ?? "");
  if (typed.type !== "ByteString") return "";
  return new TextDecoder().decode(base64ToBytes(typed.value));
}

function decodeHash160(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const typed = item as { type?: string; value?: unknown };
  if (typed.type === "Hash160") return sanitizeHex(typed.value);
  if (typed.type === "ByteString") {
    return reverseHex(bytesToHex(base64ToBytes(typed.value)));
  }
  return "";
}

function decodeInteger(item: unknown): string {
  if (!item || typeof item !== "object") return "0";
  const typed = item as { type?: string; value?: unknown };
  if (typed.type === "Integer") return String(typed.value ?? "0");
  if (typed.type === "Boolean") return typed.value ? "1" : "0";
  if (typed.type === "ByteString") {
    return String(BigInt(`0x${bytesToHex(base64ToBytes(typed.value)) || "0"}`));
  }
  return "0";
}

function decodeListing(result: InvokeResult): Omit<MarketListing, "myPendingPayment" | "isMine"> | null {
  const item = Array.isArray(result?.stack) ? result.stack[0] : null;
  if (!item || typeof item !== "object") return null;
  const typed = item as { type?: string; value?: unknown };
  if (typed.type !== "Array" || !Array.isArray(typed.value) || typed.value.length === 0) {
    return null;
  }

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
  ] = typed.value;

  const statusCode = Number(decodeInteger(statusItem));
  const sellerScriptHash = decodeHash160(sellerItem);
  const buyerScriptHash = decodeHash160(buyerItem);

  return {
    id: decodeInteger(idItem),
    aaContractHash: normalizeScriptHash(decodeHash160(aaContractItem)),
    accountIdHash: normalizeScriptHash(decodeHash160(accountIdItem)),
    sellerScriptHash,
    buyerScriptHash,
    seller: sellerScriptHash ? normalizeScriptHash(sellerScriptHash) : "",
    buyer: buyerScriptHash ? normalizeScriptHash(buyerScriptHash) : "",
    priceRaw: decodeInteger(priceItem),
    priceGas: formatGasFractions(decodeInteger(priceItem)),
    title: decodeByteString(titleItem),
    metadataUri: decodeByteString(metadataUriItem),
    statusCode,
    status: LISTING_STATUS[statusCode] || "unknown",
    createdAt: decodeInteger(createdAtItem),
    updatedAt: decodeInteger(updatedAtItem),
  };
}

async function ensureWalletConnected(wallet: WalletSDK): Promise<string> {
  if (!wallet.address.value) {
    await wallet.connect();
  }
  const address = String(wallet.address.value ?? "").trim();
  if (!address) {
    throw new Error("Wallet not connected.");
  }
  return address;
}

async function invokeMarketRead(
  wallet: WalletSDK,
  marketHash: string,
  operation: string,
  args: ContractArg[] = [],
): Promise<InvokeResult> {
  const result = await wallet.invokeRead({
    scriptHash: normalizeScriptHash(marketHash),
    operation,
    args,
  });
  if (String(result?.state ?? "").toUpperCase().includes("FAULT")) {
    throw new Error(result?.exception || `${operation} faulted`);
  }
  return result;
}

export async function getPendingPaymentOf(
  wallet: WalletSDK,
  marketHash: string,
  listingId: string,
  payerAddress?: string | null,
): Promise<string> {
  if (!payerAddress) return "0";
  const payerHash = normalizeHash160Input(payerAddress, "Payer");
  const result = await invokeMarketRead(wallet, marketHash, "getPendingPaymentOf", [
    { type: "Integer", value: String(listingId) },
    { type: "Hash160", value: normalizeScriptHash(payerHash) },
  ]);
  return decodeInteger(result?.stack?.[0]);
}

export async function readAddressListing(
  wallet: WalletSDK,
  marketHash: string,
  listingId: string,
  currentAddress?: string | null,
): Promise<MarketListing> {
  const result = await invokeMarketRead(wallet, marketHash, "getListing", [
    { type: "Integer", value: String(listingId) },
  ]);
  const decoded = decodeListing(result);
  if (!decoded) {
    throw new Error("Listing not found.");
  }

  const myPendingPayment = currentAddress
    ? await getPendingPaymentOf(wallet, marketHash, decoded.id, currentAddress).catch((_e: unknown) => "0")
    : "0";

  return {
    ...decoded,
    myPendingPayment,
    isMine: ownerMatchesAddress(decoded.seller, currentAddress),
  };
}

export async function listAddressListings(
  wallet: WalletSDK,
  marketHash: string,
  currentAddress?: string | null,
): Promise<MarketListing[]> {
  const countResult = await invokeMarketRead(wallet, marketHash, "getListingCount");
  const count = Number(decodeInteger(countResult?.stack?.[0]));
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  const reads = Array.from({ length: count }, (_, index) =>
    invokeMarketRead(wallet, marketHash, "getListing", [{ type: "Integer", value: String(index + 1) }]).catch((_e: unknown) => null));

  const decoded = (await Promise.all(reads))
    .map((result) => (result ? decodeListing(result) : null))
    .filter((listing): listing is Omit<MarketListing, "myPendingPayment" | "isMine"> => Boolean(listing));

  if (!currentAddress) {
    return decoded
      .map((listing) => ({ ...listing, myPendingPayment: "0", isMine: false }))
      .sort((left, right) => Number(right.id) - Number(left.id));
  }

  const pendingPayments = await Promise.all(
    decoded.map((listing) => getPendingPaymentOf(wallet, marketHash, listing.id, currentAddress).catch((_e: unknown) => "0")),
  );

  return decoded
    .map((listing, index) => ({
      ...listing,
      myPendingPayment: pendingPayments[index] || "0",
      isMine: ownerMatchesAddress(listing.seller, currentAddress),
    }))
    .sort((left, right) => Number(right.id) - Number(left.id));
}

function buildEscrowCreationSigner(accountAddress: string, marketHash: string, aaContractHash: string) {
  return {
    account: accountAddress,
    scopes: 16,
    allowedContracts: [normalizeScriptHash(marketHash), normalizeScriptHash(aaContractHash)],
  };
}

export async function createAddressListing(
  wallet: WalletSDK,
  marketHash: string,
  input: CreateListingInput,
): Promise<{ txid: string }> {
  const address = await ensureWalletConnected(wallet);
  const aaContractHash = normalizeHash160Input(input.aaContractHash || getDefaultAAContractHash(), "AA contract");
  const accountIdHash = normalizeHash160Input(input.accountIdHash, "Account ID hash");

  const result = await wallet.invokeContract({
    scriptHash: normalizeScriptHash(marketHash),
    operation: "createListing",
    args: [
      { type: "Hash160", value: normalizeScriptHash(aaContractHash) },
      { type: "Hash160", value: normalizeScriptHash(accountIdHash) },
      { type: "Integer", value: parseGasToFractions(input.priceGas) },
      { type: "String", value: String(input.title ?? "").trim() },
      { type: "String", value: String(input.metadataUri ?? "").trim() },
    ],
    signers: [buildEscrowCreationSigner(address, marketHash, aaContractHash)],
  });

  return { txid: String(result?.txid ?? "") };
}

export async function updateAddressListingPrice(
  wallet: WalletSDK,
  marketHash: string,
  listingId: string,
  priceGas: string,
): Promise<{ txid: string }> {
  const address = await ensureWalletConnected(wallet);
  const result = await wallet.invokeContract({
    scriptHash: normalizeScriptHash(marketHash),
    operation: "updateListingPrice",
    args: [
      { type: "Integer", value: String(listingId) },
      { type: "Integer", value: parseGasToFractions(priceGas) },
    ],
    signers: [{ account: address, scopes: 1 }],
  });

  return { txid: String(result?.txid ?? "") };
}

export async function cancelAddressListing(
  wallet: WalletSDK,
  marketHash: string,
  listingId: string,
): Promise<{ txid: string }> {
  const address = await ensureWalletConnected(wallet);
  const result = await wallet.invokeContract({
    scriptHash: normalizeScriptHash(marketHash),
    operation: "cancelListing",
    args: [{ type: "Integer", value: String(listingId) }],
    signers: [{ account: address, scopes: 1 }],
  });

  return { txid: String(result?.txid ?? "") };
}

export async function buyAddressListing(
  wallet: WalletSDK,
  marketHash: string,
  listingId: string,
  options: { newBackupOwner?: string },
): Promise<{ txid: string }> {
  const address = await ensureWalletConnected(wallet);
  const backupOwner = normalizeHash160Input(options.newBackupOwner || address, "Backup owner");
  const result = await wallet.invokeContract({
    scriptHash: normalizeScriptHash(marketHash),
    operation: "buyListing",
    args: [
      { type: "Integer", value: String(listingId) },
      { type: "Hash160", value: normalizeScriptHash(backupOwner) },
      { type: "Hash160", value: normalizeScriptHash(GAS_HASH) },
    ],
    signers: [{ account: address, scopes: 1 }],
  });

  return { txid: String(result?.txid ?? "") };
}

export async function refundPendingAddressPurchase(
  wallet: WalletSDK,
  marketHash: string,
  listingId: string,
): Promise<{ txid: string }> {
  const address = await ensureWalletConnected(wallet);
  const result = await wallet.invokeContract({
    scriptHash: normalizeScriptHash(marketHash),
    operation: "refundPendingPurchase",
    args: [{ type: "Integer", value: String(listingId) }],
    signers: [{ account: address, scopes: 1 }],
  });

  return { txid: String(result?.txid ?? "") };
}
