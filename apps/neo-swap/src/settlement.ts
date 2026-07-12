import { normalizeScriptHash } from "@shared/utils/neo";

export type SwapNetwork = "mainnet" | "testnet";

export interface SwapConfirmationIntent {
  txid: string;
  wallet: string;
  fromHash: string;
  toHash: string;
  amountIn: string;
  minOutput: string;
}

/**
 * A production settlement route is a complete product capability, not merely a
 * contract address. The event validator is deliberately part of the binding:
 * an event name alone cannot prove that the confirmed swap matches the user's
 * wallet, pair and exact amount intent.
 */
export interface ApprovedSwapRouterBinding {
  network: SwapNetwork;
  scriptHash: string;
  operation: "swapTokenInForTokenOut";
  confirmationEvent: "SwapExecuted";
  abiVersion: string;
  validateConfirmation: (event: unknown, intent: SwapConfirmationIntent) => boolean;
}

/**
 * No router has completed the production gate for either Neo N3 network.
 * Enabling settlement requires replacing this null with a reviewed binding,
 * adding the matching manifest permission, and passing the testnet matrix.
 */
export const ACTIVE_SWAP_ROUTER_BINDING: ApprovedSwapRouterBinding | null = null;

export function normalizeSwapNetwork(value: unknown): SwapNetwork | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

function isHash160(value: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(normalizeScriptHash(value));
}

export function isApprovedSwapRouter(
  binding: ApprovedSwapRouterBinding | null | undefined,
  quoteNetwork: SwapNetwork,
  configuredAddress: string | null | undefined,
): binding is ApprovedSwapRouterBinding {
  if (!binding || binding.network !== quoteNetwork || !configuredAddress) return false;
  if (
    !binding.abiVersion.trim()
    || !isHash160(binding.scriptHash)
    || typeof binding.validateConfirmation !== "function"
  ) return false;
  return normalizeScriptHash(binding.scriptHash) === normalizeScriptHash(configuredAddress);
}
