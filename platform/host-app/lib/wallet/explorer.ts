/**
 * Block-explorer deep links for the connected wallet.
 *
 * Dora (COZ) serves both Neo N3 networks under explicit
 * `/address/neo3/<network>/<address>` paths, so links stay truthful when the
 * wallet is on testnet.
 */

import type { NeoNetwork } from "@/lib/neo-network";

const DORA_ADDRESS_BASE = "https://dora.coz.io/address/neo3";

/**
 * Build the explorer URL for a Neo N3 address. Falls back to mainnet when the
 * wallet has not reported a network yet (the explorer still resolves the
 * address and shows its own network switcher).
 */
export function getAddressExplorerUrl(
  network: NeoNetwork | null,
  address: string,
): string {
  const segment = network === "testnet" ? "testnet" : "mainnet";
  return `${DORA_ADDRESS_BASE}/${segment}/${encodeURIComponent(address)}`;
}
