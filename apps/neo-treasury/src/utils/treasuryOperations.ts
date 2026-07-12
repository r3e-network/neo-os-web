import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { getNep17Transfers } from "@shared/utils/n3index";
import { addressToScriptHash } from "@shared/utils/neo";

export type TreasuryAsset = "GAS" | "NEO";
export type TreasuryNetwork = "mainnet" | "testnet";
export const TREASURY_INPUT_LIMITS = {
  amount: 80,
  address: 128,
  memo: 120,
} as const;

const MAX_NATIVE_BALANCE_DIGITS = 100;
const MAX_PENDING_CLOCK_SKEW_MS = 5 * 60 * 1000;
export type TreasurySettlementStatus =
  | "confirmed"
  | "indexing"
  | "binding-mismatch"
  | "readback-pending"
  | "unreachable";

export interface TreasuryDisbursementInput {
  asset?: unknown;
  amount?: unknown;
  recipient?: unknown;
  memo?: unknown;
}

export interface TreasuryTransferIntent {
  version: 1;
  network: TreasuryNetwork;
  asset: TreasuryAsset;
  amount: string;
  scaledAmount: string;
  senderHash: string;
  recipientHash: string;
  memo: string;
  scriptHash: string;
  createdAt: number;
  bindingKey: string;
  args: Array<{ type: "Hash160" | "Integer" | "String"; value: string }>;
}

export interface TreasuryDisbursementPreview {
  asset: TreasuryAsset;
  amount: string;
  scaledAmount: string;
  recipientHash: string;
  memo: string;
  scriptHash: string;
  senderHash?: string;
}

export interface PendingTreasuryTransfer extends TreasuryTransferIntent {
  txid: string;
  preSenderBalance: string;
  preRecipientBalance: string;
  broadcastAt: number;
}

export interface TreasurySettlementResult {
  status: TreasurySettlementStatus;
  eventMatched: boolean;
  stateReadback: boolean;
}

export interface TreasurySettlementDependencies {
  listTransfers?: (
    network: TreasuryNetwork,
    txid: string,
    limit?: number,
  ) => Promise<unknown[]>;
  readRecipientBalance: (
    scriptHash: string,
    recipientHash: string,
  ) => Promise<unknown>;
  readSenderBalance: (
    scriptHash: string,
    senderHash: string,
  ) => Promise<unknown>;
}

export class TreasuryOperationError extends Error {
  readonly messageKey: string;
  readonly params?: Record<string, string | number>;

  constructor(
    messageKey: string,
    fallbackMessage: string,
    params?: Record<string, string | number>,
  ) {
    super(fallbackMessage);
    this.name = "TreasuryOperationError";
    this.messageKey = messageKey;
    this.params = params;
  }
}

function operationError(
  messageKey: string,
  fallbackMessage: string,
  params?: Record<string, string | number>,
) {
  return new TreasuryOperationError(messageKey, fallbackMessage, params);
}

export function formatTreasuryOperationError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return error instanceof TreasuryOperationError
    ? t(error.messageKey, error.params)
    : error instanceof Error
      ? error.message
      : String(error);
}

const TXID_PATTERN = /^0x[0-9a-f]{64}$/;

function asCleanString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHash(value: unknown) {
  return asCleanString(value).toLowerCase();
}

export function normalizeTreasuryTxid(value: unknown) {
  const raw = normalizeHash(value);
  return /^[0-9a-f]{64}$/.test(raw) ? `0x${raw}` : raw;
}

function canonicalAmount(raw: string) {
  const [wholeRaw = "0", fractionRaw = ""] = raw.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionRaw.replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function normalizeTreasuryNetwork(value: unknown): TreasuryNetwork {
  const raw = asCleanString(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") {
    return "mainnet";
  }
  if (raw === "testnet" || raw === "neo-n3-testnet") {
    return "testnet";
  }
  throw operationError(
    "treasuryErrorNetworkUnverified",
    "Wallet network could not be verified as Neo N3 Mainnet or Testnet.",
  );
}

export function assertTreasuryWalletNetwork(
  selectedNetwork: TreasuryNetwork,
  walletNetwork: unknown,
) {
  const detected = normalizeTreasuryNetwork(walletNetwork);
  if (detected !== selectedNetwork) {
    throw operationError(
      "treasuryErrorNetworkMismatch",
      `Wallet is on Neo N3 ${detected === "testnet" ? "Testnet" : "Mainnet"}; switch to Neo N3 ${selectedNetwork === "testnet" ? "Testnet" : "Mainnet"} before signing.`,
      {
        current: detected === "testnet" ? "Testnet" : "Mainnet",
        expected: selectedNetwork === "testnet" ? "Testnet" : "Mainnet",
      },
    );
  }
  return detected;
}

export function normalizeTreasuryAsset(value: unknown): TreasuryAsset {
  const asset = asCleanString(value).toUpperCase();
  if (asset === "NEO" || asset === "GAS") return asset;
  throw operationError("treasuryErrorAsset", "Select NEO or GAS before submitting the transfer.");
}

export function normalizeTreasuryHash160(value: unknown, label: string) {
  const raw = asCleanString(value);
  if (!raw || raw.length > TREASURY_INPUT_LIMITS.address) {
    throw operationError(
      label === "Recipient" ? "treasuryErrorRecipient" : "treasuryErrorAddress",
      `${label} must be a valid Neo N3 address or Hash160.`,
    );
  }
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return (raw.startsWith("0x") ? raw : `0x${raw}`).toLowerCase();
  }

  const converted = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(converted)) return converted.toLowerCase();
  throw operationError(
    label === "Recipient" ? "treasuryErrorRecipient" : "treasuryErrorAddress",
    `${label} must be a valid Neo N3 address or Hash160.`,
  );
}

export function scaleTreasuryAmount(asset: TreasuryAsset, value: unknown) {
  const raw = asCleanString(value);
  if (raw.length > TREASURY_INPUT_LIMITS.amount) {
    throw operationError(
      "treasuryErrorAmountLength",
      "Amount is too long to review safely.",
    );
  }
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw operationError("treasuryErrorAmountNumber", "Amount must be a positive number.");
  }

  const decimals = asset === "NEO" ? TOKEN_CONSTANTS.NEO_DECIMALS : TOKEN_CONSTANTS.GAS_DECIMALS;
  const [wholeRaw = "0", fractionRaw = ""] = raw.split(".");
  if (fractionRaw.length > decimals) {
    throw operationError(
      asset === "NEO" ? "treasuryErrorNeoWhole" : "treasuryErrorGasDecimals",
      asset === "NEO"
        ? "NEO transfers must use whole token amounts."
        : `GAS transfers support at most ${decimals} decimal places.`,
    );
  }

  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionRaw.padEnd(decimals, "0");
  const scaled = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  if (BigInt(scaled) <= 0n) {
    throw operationError("treasuryErrorAmountPositive", "Amount must be greater than zero.");
  }
  return scaled;
}

export function buildTreasuryTransferIntent(
  sender: unknown,
  input: TreasuryDisbursementInput,
  network: TreasuryNetwork = "mainnet",
  now = Date.now(),
): TreasuryTransferIntent {
  const preview = buildTreasuryDisbursementPreview(input, sender);
  const normalizedNetwork = normalizeTreasuryNetwork(network);
  const senderHash = preview.senderHash;
  if (!senderHash) throw operationError("treasuryErrorWalletRequired", "Connected wallet is required before submitting.");
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw operationError("treasuryErrorReviewTime", "Transfer review time is invalid.");
  }

  const createdAt = Math.trunc(now);
  const bindingKey = JSON.stringify([
    normalizedNetwork,
    preview.scriptHash.toLowerCase(),
    senderHash,
    preview.recipientHash,
    preview.scaledAmount,
    preview.memo,
  ]);

  return {
    version: 1,
    network: normalizedNetwork,
    asset: preview.asset,
    amount: preview.amount,
    scaledAmount: preview.scaledAmount,
    senderHash,
    recipientHash: preview.recipientHash,
    memo: preview.memo,
    scriptHash: preview.scriptHash,
    createdAt,
    bindingKey,
    args: [
      { type: "Hash160", value: senderHash },
      { type: "Hash160", value: preview.recipientHash },
      { type: "Integer", value: preview.scaledAmount },
      { type: "String", value: preview.memo },
    ],
  };
}

export function buildTreasuryDisbursementPreview(
  input: TreasuryDisbursementInput,
  sender?: unknown,
): TreasuryDisbursementPreview {
  const asset = normalizeTreasuryAsset(input.asset || "GAS");
  const rawAmount = asCleanString(input.amount);
  const scaledAmount = scaleTreasuryAmount(asset, rawAmount);
  const recipientHash = normalizeTreasuryHash160(input.recipient, "Recipient");
  const senderInput = asCleanString(sender);
  const senderHash = senderInput
    ? normalizeTreasuryHash160(senderInput, "Connected wallet")
    : undefined;
  if (senderHash && senderHash === recipientHash) {
    throw operationError("treasuryErrorSelfTransfer", "Recipient must be different from the connected wallet.");
  }
  const memoInput = String(input.memo ?? "");
  if (memoInput.length > TREASURY_INPUT_LIMITS.memo) {
    throw operationError("treasuryErrorMemoLength", "Memo must be 120 characters or fewer.");
  }
  const rawMemo = memoInput.trim();
  const scriptHash =
    asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;

  return {
    asset,
    amount: canonicalAmount(rawAmount),
    scaledAmount,
    recipientHash,
    memo: rawMemo,
    scriptHash: scriptHash.toLowerCase(),
    senderHash,
  };
}

export function parseTreasuryBalance(value: unknown, label = "Token balance") {
  const raw = typeof value === "bigint" ? value.toString() : asCleanString(value);
  if (!/^\d+$/.test(raw) || raw.length > MAX_NATIVE_BALANCE_DIGITS) {
    throw operationError("treasuryErrorBalanceRead", `${label} could not be verified on-chain.`);
  }
  return BigInt(raw);
}

export function assertTreasurySpendableBalance(
  intent: TreasuryTransferIntent,
  senderBalance: unknown,
) {
  const balance = parseTreasuryBalance(senderBalance, `${intent.asset} balance`);
  const amount = BigInt(intent.scaledAmount);
  if (balance < amount) {
    throw operationError(
      "treasuryErrorInsufficientBalance",
      `Insufficient ${intent.asset} balance for this transfer.`,
      { asset: intent.asset },
    );
  }
  if (intent.asset === "GAS" && balance === amount) {
    throw operationError(
      "treasuryErrorGasHeadroom",
      "Keep some GAS for network fees; the transfer amount cannot use the entire GAS balance.",
    );
  }
  return balance;
}

export function buildPendingTreasuryTransfer(
  intent: TreasuryTransferIntent,
  txid: unknown,
  preSenderBalance: unknown,
  preRecipientBalance: unknown,
  broadcastAt = Date.now(),
): PendingTreasuryTransfer {
  const normalizedTxid = normalizeTreasuryTxid(txid);
  if (!TXID_PATTERN.test(normalizedTxid)) {
    throw operationError("treasuryErrorTxid", "Wallet did not return a valid transaction hash.");
  }
  const senderBefore = parseTreasuryBalance(preSenderBalance, "Sender balance");
  const recipientBefore = parseTreasuryBalance(preRecipientBalance, "Recipient balance");
  const broadcastTime = Math.trunc(broadcastAt);
  if (!Number.isSafeInteger(broadcastTime) || broadcastTime <= 0 || broadcastTime < intent.createdAt) {
    throw operationError("treasuryErrorBroadcastTime", "Transaction broadcast time is invalid.");
  }
  return {
    ...intent,
    txid: normalizedTxid,
    preSenderBalance: senderBefore.toString(),
    preRecipientBalance: recipientBefore.toString(),
    broadcastAt: broadcastTime,
  };
}

export function parsePendingTreasuryTransfer(
  value: unknown,
  now = Date.now(),
): PendingTreasuryTransfer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Number.isSafeInteger(now) || now <= 0) return null;
  const record = value as Record<string, unknown>;
  try {
    const asset = normalizeTreasuryAsset(record.asset);
    const network = normalizeTreasuryNetwork(record.network);
    const scriptHash = normalizeHash(record.scriptHash);
    const expectedScriptHash = (
      asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH
    ).toLowerCase();
    const senderHash = normalizeTreasuryHash160(record.senderHash, "Sender");
    const recipientHash = normalizeTreasuryHash160(record.recipientHash, "Recipient");
    const txid = normalizeTreasuryTxid(record.txid);
    const scaledAmount = asCleanString(record.scaledAmount);
    const preSenderBalance = asCleanString(record.preSenderBalance);
    const preRecipientBalance = asCleanString(record.preRecipientBalance);
    const createdAt = Number(record.createdAt);
    const broadcastAt = Number(record.broadcastAt);
    if (record.version !== 1 || scriptHash !== expectedScriptHash) return null;
    if (!TXID_PATTERN.test(txid) || !/^\d+$/.test(scaledAmount) || BigInt(scaledAmount) <= 0n) return null;
    const parsedSenderBalance = parseTreasuryBalance(preSenderBalance, "Sender balance");
    parseTreasuryBalance(preRecipientBalance, "Recipient balance");
    if (parsedSenderBalance < BigInt(scaledAmount)) return null;
    if (![createdAt, broadcastAt].every((value) => Number.isSafeInteger(value) && value > 0)) return null;
    if (createdAt > now + MAX_PENDING_CLOCK_SKEW_MS || broadcastAt > now + MAX_PENDING_CLOCK_SKEW_MS) return null;
    if (senderHash === recipientHash) return null;
    const memo = asCleanString(record.memo);
    if (memo.length > TREASURY_INPUT_LIMITS.memo) return null;
    const amount = asCleanString(record.amount);
    if (!amount || canonicalAmount(amount) !== amount || scaleTreasuryAmount(asset, amount) !== scaledAmount) return null;
    const bindingKey = asCleanString(record.bindingKey);
    const expectedBindingKey = JSON.stringify([
      network,
      scriptHash,
      senderHash,
      recipientHash,
      scaledAmount,
      memo,
    ]);
    if (bindingKey !== expectedBindingKey) return null;
    if (broadcastAt < createdAt) return null;
    return {
      version: 1,
      network,
      asset,
      amount,
      scaledAmount,
      senderHash,
      recipientHash,
      memo,
      scriptHash,
      createdAt,
      bindingKey,
      args: [
        { type: "Hash160", value: senderHash },
        { type: "Hash160", value: recipientHash },
        { type: "Integer", value: scaledAmount },
        { type: "String", value: memo },
      ],
      txid,
      preSenderBalance,
      preRecipientBalance,
      broadcastAt,
    };
  } catch {
    return null;
  }
}

function transferHash(value: unknown) {
  try {
    return normalizeTreasuryHash160(value, "Transfer address");
  } catch {
    return "";
  }
}

export function matchesPendingTreasuryTransfer(
  row: unknown,
  pending: PendingTreasuryTransfer,
) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const record = row as Record<string, unknown>;
  const amountRaw = asCleanString(record.amount_raw ?? record.amountRaw ?? record.amount);
  if (!/^\d+$/.test(amountRaw)) return false;
  return (
    normalizeTreasuryTxid(record.txid) === pending.txid &&
    normalizeHash(record.network) === pending.network &&
    normalizeHash(record.contract_hash ?? record.contractHash) === pending.scriptHash &&
    transferHash(record.from_address ?? record.fromAddress ?? record.from) === pending.senderHash &&
    transferHash(record.to_address ?? record.toAddress ?? record.to) === pending.recipientHash &&
    BigInt(amountRaw) === BigInt(pending.scaledAmount)
  );
}

export async function inspectPendingTreasuryTransfer(
  pending: PendingTreasuryTransfer,
  dependencies: TreasurySettlementDependencies,
): Promise<TreasurySettlementResult> {
  const listTransfers = dependencies.listTransfers ?? getNep17Transfers;
  let rows: unknown[];
  try {
    rows = await listTransfers(pending.network, pending.txid, 20);
  } catch {
    return { status: "unreachable", eventMatched: false, stateReadback: false };
  }

  const exactMatches = rows.filter((row) => matchesPendingTreasuryTransfer(row, pending));
  if (exactMatches.length !== 1) {
    return {
      status: rows.length > 0 ? "binding-mismatch" : "indexing",
      eventMatched: false,
      stateReadback: false,
    };
  }

  let currentRecipientBalance: bigint;
  let currentSenderBalance: bigint;
  try {
    const [recipientBalance, senderBalance] = await Promise.all([
      dependencies.readRecipientBalance(pending.scriptHash, pending.recipientHash),
      dependencies.readSenderBalance(pending.scriptHash, pending.senderHash),
    ]);
    currentRecipientBalance = parseTreasuryBalance(recipientBalance, "Recipient balance");
    currentSenderBalance = parseTreasuryBalance(senderBalance, "Sender balance");
  } catch {
    return { status: "unreachable", eventMatched: true, stateReadback: false };
  }

  const expectedMinimum = BigInt(pending.preRecipientBalance) + BigInt(pending.scaledAmount);
  const expectedSenderMaximum = BigInt(pending.preSenderBalance) - BigInt(pending.scaledAmount);
  // Both sides must agree with the saved pre-transfer baseline. An exact
  // indexed event proves which transfer executed, while the two balance reads
  // prove that the currently observed native-token state has caught up. Using
  // `&&` here would incorrectly confirm when only one side changed (for
  // example, an unrelated incoming transfer to the recipient).
  if (
    currentRecipientBalance < expectedMinimum ||
    currentSenderBalance > expectedSenderMaximum
  ) {
    return { status: "readback-pending", eventMatched: true, stateReadback: false };
  }
  return { status: "confirmed", eventMatched: true, stateReadback: true };
}
