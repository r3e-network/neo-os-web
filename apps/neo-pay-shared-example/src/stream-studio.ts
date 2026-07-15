import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";

export type StudioAsset = "GAS" | "NEO";
export type StudioNetwork = "mainnet" | "testnet";
export type StudioServiceState = "disconnected" | "loading" | "live" | "partial" | "pending" | "unavailable";

export const NEOPAY_CONTRACTS: Readonly<Record<StudioNetwork, string>> = {
  mainnet: "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
  testnet: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
};

export interface StreamDraft {
  recipient: string;
  amount: string;
  duration: string;
  asset: StudioAsset;
}

export interface StreamDraftValidation {
  valid: boolean;
  recipientValid: boolean;
  amountValid: boolean;
  durationValid: boolean;
  recipientIssue: "" | "invalidAddress";
  amountIssue: "" | "neoWholeAmountRequired" | "gasFixed8Required";
  durationIssue: "" | "durationRangeRequired";
}

/**
 * Validate a human-entered payment amount without rewriting it.
 *
 * NEO is indivisible, while GAS uses at most eight decimal places. The UI keeps
 * the exact draft text so switching 12.9 GAS to NEO produces an explicit error
 * instead of silently changing the economic intent to 12 NEO.
 */
export function validAmountForAsset(value: string, asset: StudioAsset): boolean {
  const amount = String(value ?? "").trim();
  if (asset === "NEO") return /^[1-9]\d*$/.test(amount);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amount)) return false;
  const [whole = "0", fraction = ""] = amount.split(".");
  try {
    return BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0") > 0n;
  } catch {
    return false;
  }
}

export function validDuration(value: string): boolean {
  const duration = String(value ?? "").trim();
  if (!/^[1-9]\d{0,2}$/.test(duration)) return false;
  const days = Number(duration);
  return days >= 1 && days <= 365;
}

export function validateStreamDraft(draft: StreamDraft): StreamDraftValidation {
  const recipientValid = Boolean(addressToScriptHash(draft.recipient.trim()));
  const amountValid = validAmountForAsset(draft.amount, draft.asset);
  const durationValid = validDuration(draft.duration);
  return {
    valid: recipientValid && amountValid && durationValid,
    recipientValid,
    amountValid,
    durationValid,
    recipientIssue: recipientValid ? "" : "invalidAddress",
    amountIssue: amountValid
      ? ""
      : draft.asset === "NEO"
        ? "neoWholeAmountRequired"
        : "gasFixed8Required",
    durationIssue: durationValid ? "" : "durationRangeRequired",
  };
}

export function normalizeStudioNetwork(value: unknown): StudioNetwork | null {
  const network = String(value ?? "").trim().toLowerCase();
  if (network === "mainnet" || network === "neo-n3-mainnet") return "mainnet";
  if (network === "testnet" || network === "neo-n3-testnet") return "testnet";
  return null;
}

/** Display classification of the contract binding. See {@link classifyNeoPayBinding}. */
export type NeoPayBindingState = "verified" | "mismatch" | "awaiting-context";

/**
 * Classify the NeoPay binding for DISPLAY. hasCanonicalNeoPayBinding below stays
 * the wallet-action gate and still refuses everything that is not "verified".
 *
 * The boolean alone could not distinguish "the host told us a network and the
 * contract genuinely disagrees" (a real fault worth an alarm) from "no network
 * or contract has been handed to us yet" (the normal pre-wallet first paint).
 * Collapsing the second into the first is what made a fresh visitor read
 * "contract does not match this network. Wallet actions are locked."
 */
export function classifyNeoPayBinding(
  network: unknown,
  contractHash: unknown,
): NeoPayBindingState {
  const normalizedNetwork = normalizeStudioNetwork(network);
  if (!normalizedNetwork) return "awaiting-context";
  const rawContract = String(contractHash ?? "").trim();
  if (!rawContract) return "awaiting-context";
  return hasCanonicalNeoPayBinding(network, contractHash) ? "verified" : "mismatch";
}

export function hasCanonicalNeoPayBinding(network: unknown, contractHash: unknown): boolean {
  const normalizedNetwork = normalizeStudioNetwork(network);
  if (!normalizedNetwork) return false;
  try {
    return normalizeScriptHash(String(contractHash ?? ""))
      === normalizeScriptHash(NEOPAY_CONTRACTS[normalizedNetwork]);
  } catch {
    return false;
  }
}
