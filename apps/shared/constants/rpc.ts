/**
 * Neo N3 Network Configuration
 *
 * RPC endpoints for direct contract invocations (write operations).
 * For read operations, prefer the N3Index API at api.n3index.dev.
 *
 * @see https://n3index.dev — Indexer + REST data API
 */

/** N3Index API — primary data source for reads */
export const N3INDEX_API = "https://api.n3index.dev";

/** Neo N3 Mainnet RPC (for wallet invocations only) */
export const NEO_MAINNET_RPC = "https://mainnet1.neo.coz.io:443";

/** Neo N3 Testnet RPC (for wallet invocations only) */
export const NEO_TESTNET_RPC = "https://testnet1.neo.coz.io:443";

/** Network magic numbers */
export const MAINNET_MAGIC = 860833102;
export const TESTNET_MAGIC = 894710606;

/** Core contract hashes (same on all Neo N3 networks) */
export const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
export const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
export const CONTRACT_MANAGEMENT = "0xfffdc93764dbaddd97c48f252a53ea4643faa3fd";

/** Platform contract hashes */
export const AA_CONTRACT = "0x0466fa7e8fe548480d7978d2652625d4a22589a6";
export const ORACLE_CONTRACT_MAINNET = "0x017520f068fd602082fe5572596185e62a4ad991";
export const ORACLE_CONTRACT_TESTNET = "0x4b882e94ed766807c4fd728768f972e13008ad52";
export const DATA_FEED_CONTRACT = "0x03013f49c42a14546c8bbe58f9d434c3517fccab";

/** Determine network from environment or default */
export function getNetwork(): "mainnet" | "testnet" {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("network") === "testnet") return "testnet";
  }
  return "mainnet";
}

/** Get RPC URL for current network */
export function getRpcUrl(network?: "mainnet" | "testnet"): string {
  return (network ?? getNetwork()) === "testnet" ? NEO_TESTNET_RPC : NEO_MAINNET_RPC;
}
