import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { addressToScriptHash } from "@shared/utils/neo";

export type TreasuryAsset = "GAS" | "NEO";

export interface TreasuryDisbursementInput {
  asset?: unknown;
  amount?: unknown;
  recipient?: unknown;
  memo?: unknown;
}

export interface TreasuryTransferIntent {
  asset: TreasuryAsset;
  amount: string;
  scaledAmount: string;
  senderHash: string;
  recipientHash: string;
  memo: string;
  scriptHash: string;
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

function asCleanString(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeTreasuryAsset(value: unknown): TreasuryAsset {
  const asset = asCleanString(value).toUpperCase();
  if (asset === "NEO" || asset === "GAS") return asset;
  throw new Error("Select NEO or GAS before submitting the disbursement.");
}

export function normalizeTreasuryHash160(value: unknown, label: string) {
  const raw = asCleanString(value);
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return raw.startsWith("0x") ? raw : `0x${raw}`;
  }

  const converted = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(converted)) return converted;
  throw new Error(`${label} must be a valid Neo N3 address or Hash160.`);
}

export function scaleTreasuryAmount(asset: TreasuryAsset, value: unknown) {
  const raw = asCleanString(value);
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("Amount must be a positive number.");
  }

  const decimals = asset === "NEO" ? TOKEN_CONSTANTS.NEO_DECIMALS : TOKEN_CONSTANTS.GAS_DECIMALS;
  const [wholeRaw = "0", fractionRaw = ""] = raw.split(".");
  if (fractionRaw.length > decimals) {
    throw new Error(
      asset === "NEO"
        ? "NEO transfers must use whole token amounts."
        : `GAS transfers support at most ${decimals} decimal places.`,
    );
  }

  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionRaw.padEnd(decimals, "0");
  const scaled = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  if (BigInt(scaled) <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  return scaled;
}

export function buildTreasuryTransferIntent(
  sender: unknown,
  input: TreasuryDisbursementInput,
): TreasuryTransferIntent {
  const preview = buildTreasuryDisbursementPreview(input, sender);
  const senderHash = preview.senderHash;
  if (!senderHash) throw new Error("Connected wallet is required before submitting.");

  return {
    asset: preview.asset,
    amount: preview.amount,
    scaledAmount: preview.scaledAmount,
    senderHash,
    recipientHash: preview.recipientHash,
    memo: preview.memo,
    scriptHash: preview.scriptHash,
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
  const amount = asCleanString(input.amount);
  const scaledAmount = scaleTreasuryAmount(asset, amount);
  const recipientHash = normalizeTreasuryHash160(input.recipient, "Recipient");
  const senderInput = asCleanString(sender);
  const senderHash = senderInput
    ? normalizeTreasuryHash160(senderInput, "Connected wallet")
    : undefined;
  const memo = asCleanString(input.memo).slice(0, 120);
  const scriptHash =
    asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;

  return {
    asset,
    amount,
    scaledAmount,
    recipientHash,
    memo,
    scriptHash,
    senderHash,
  };
}
