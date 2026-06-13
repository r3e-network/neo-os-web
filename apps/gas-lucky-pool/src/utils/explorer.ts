/**
 * explorer.ts — build a Neo N3 block-explorer transaction URL for the active
 * network so a reward recipient can independently verify the on-chain GAS
 * payout this app reports (the amount is decided + paid by the campaign's
 * reward server, so an explorer link is the recipient's verification path).
 *
 * The network is read read-only from the OneGate launch context when available
 * (a claim QR carries its target network), falling back to the shared
 * `getNetwork()` helper (URL `?network=` param, defaulting to mainnet) — the
 * same source the wallet SDK uses to target a chain. The explorer base mirrors
 * the platform host-app's canonical Dora URL
 * (https://dora.coz.io/transaction/neo3/{network}/{txid}).
 */

import { getNetwork } from "@shared/constants/rpc";

const DORA_TX_BASE = "https://dora.coz.io/transaction/neo3";

/**
 * Build the explorer tx URL for `txid`. `network` is the launch-context network
 * ("testnet" | "mainnet"); when omitted it falls back to the shared getNetwork().
 */
export function explorerTxUrl(
  txid: string,
  network?: string | null,
): string {
  const id = String(txid || "").trim();
  if (!id) return "";
  const net = network || getNetwork();
  const segment = net === "testnet" ? "testnet" : "mainnet";
  return `${DORA_TX_BASE}/${segment}/${encodeURIComponent(id)}`;
}
