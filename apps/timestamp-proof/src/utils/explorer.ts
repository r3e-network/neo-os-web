/**
 * explorer.ts — build a Neo N3 block-explorer transaction URL for the active
 * network so an anchored timestamp proof can be verified by anyone, on any
 * device, not just the local journal.
 *
 * The active network is read read-only from the shared `getNetwork()` helper
 * (URL `?network=` param, defaulting to mainnet) — the same source the wallet
 * SDK uses to target a chain. The explorer base mirrors the platform host-app's
 * canonical Dora URL (https://dora.coz.io/transaction/neo3/{network}/{txid}).
 */

import { getNetwork } from "@shared/constants/rpc";
import { normalizeTimestampProofNetwork } from "../timestamp-proof-rpc";

const DORA_TX_BASE = "https://dora.coz.io/transaction/neo3";

/** Build the explorer tx URL for `txid` on the active Neo N3 network. */
export function explorerTxUrl(txid: string, network?: string): string {
  const id = String(txid || "").trim();
  if (!id) return "";
  const resolved = normalizeTimestampProofNetwork(network);
  const segment = resolved
    ? resolved === "neo-n3-testnet" ? "testnet" : "mainnet"
    : getNetwork() === "testnet" ? "testnet" : "mainnet";
  return `${DORA_TX_BASE}/${segment}/${encodeURIComponent(id)}`;
}
