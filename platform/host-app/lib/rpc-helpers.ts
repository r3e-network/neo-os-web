/**
 * RPC helpers for reading on-chain state from the host-app.
 *
 * Two modes:
 * 1. CUSTOM CONTRACT apps (9) — read directly from their deployed contract
 * 2. KERNEL-REGISTERED apps (17+) — read from Morpheus Oracle kernel state
 */

// mainnet1.neo.coz.io has been returning HTTP 502 since the 2026-04-19
// validation run; default to mainnet2 and let ops override via env if a
// different healthy endpoint is preferred.
const NEO_MAINNET_RPC = process.env.NEXT_PUBLIC_NEO_RPC_MAINNET
  || process.env.NEO_RPC_MAINNET
  || "https://mainnet2.neo.coz.io:443";

const MORPHEUS_KERNEL_MAINNET = "0x017520f068fd602082fe5572596185e62a4ad991";
const MORPHEUS_KERNEL_TESTNET = "0x4b882e94ed766807c4fd728768f972e13008ad52";

/** Apps with their own deployed smart contracts (atomic GAS handling) */
const CUSTOM_CONTRACT_HASHES: Record<string, string> = {
  "miniapp-last-survivor": "0x180a3a35c088eab4feded508c2ccb1556e07a840",
  "miniapp-gasbox": "0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c",
  "miniapp-redenvelope": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
  "miniapp-fogplay": "0xa5a4b5b82066d86eae9312f6072d1c3604882c81",
  "miniapp-self-loan": "0x942da575b31f39cbb59e64b5813b128739b44c25",
  "miniapp-neo-pay": "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
  "miniapp-dailycheckin": "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
  "miniapp-flashloan": "0xde8e595d8d3c293731db499367ee2a768e1e458b",
  "miniapp-unbreakablevault": "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
};

export function getMiniAppContractHash(appId: string): string | null {
  return CUSTOM_CONTRACT_HASHES[appId] || null;
}

export function getKernelHash(network: "mainnet" | "testnet" = "mainnet"): string {
  return network === "testnet" ? MORPHEUS_KERNEL_TESTNET : MORPHEUS_KERNEL_MAINNET;
}

export function isKernelRegisteredApp(appId: string): boolean {
  return !CUSTOM_CONTRACT_HASHES[appId];
}

export function getRpcUrl(): string {
  return NEO_MAINNET_RPC;
}
