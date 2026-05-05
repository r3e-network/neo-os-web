/**
 * RPC helpers for reading on-chain state from the host-app.
 *
 * Two modes:
 * 1. CUSTOM CONTRACT apps (9) — read directly from their deployed contract
 * 2. KERNEL-REGISTERED apps (17+) — read from Morpheus Oracle kernel state
 */

// Neo3Fura/N3Index is the platform-owned Neo N3 gateway. It provides JSON-RPC
// pass-through plus indexed read APIs behind the same Cloudflare edge.
const NEO_MAINNET_RPC = process.env.NEXT_PUBLIC_NEO_RPC_MAINNET
  || process.env.NEO_RPC_MAINNET
  || "https://api.n3index.dev/mainnet";
const NEO_TESTNET_RPC = process.env.NEXT_PUBLIC_NEO_RPC_TESTNET
  || process.env.NEO_RPC_TESTNET
  || process.env.NEO_RPC_URL
  || "https://api.n3index.dev/testnet";

const MORPHEUS_KERNEL_MAINNET = "0x5b492098fc094c760402e01f7e0b631b939d2bea";
const MORPHEUS_KERNEL_TESTNET = "0x4b882e94ed766807c4fd728768f972e13008ad52";

type NeoNetwork = "mainnet" | "testnet";

/** Apps with their own deployed smart contracts (atomic GAS handling) */
const CUSTOM_CONTRACT_HASHES: Record<NeoNetwork, Record<string, string>> = {
  mainnet: {
    "miniapp-last-survivor": "0x180a3a35c088eab4feded508c2ccb1556e07a840",
    "miniapp-gasbox": "0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c",
    "miniapp-redenvelope": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
    "miniapp-fogplay": "0xa5a4b5b82066d86eae9312f6072d1c3604882c81",
    "miniapp-self-loan": "0x942da575b31f39cbb59e64b5813b128739b44c25",
    "miniapp-neo-pay": "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
    "miniapp-dailycheckin": "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
    "miniapp-flashloan": "0xde8e595d8d3c293731db499367ee2a768e1e458b",
    "miniapp-unbreakablevault": "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
    "miniapp-profitanchor": "0xa1ca7a610105686635f31de8e174ae3ce6b61a3e",
    "miniapp-trustanchor": "0xa1ca7a610105686635f31de8e174ae3ce6b61a3e",
  },
  testnet: {
    "miniapp-last-survivor": "0x1021e9e5c17285e706c293a39c525de13100ed92",
    "miniapp-self-loan": "0xb4aa0bdbfec40b44fa1ec4461c8c347829a79ada",
    "miniapp-profitanchor": "0xa1ca7a610105686635f31de8e174ae3ce6b61a3e",
    "miniapp-trustanchor": "0xa1ca7a610105686635f31de8e174ae3ce6b61a3e",
  },
};

function getTargetNetwork(): NeoNetwork {
  const raw = String(
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK
      || process.env.NEO_TARGET_NETWORK
      || process.env.NEXT_PUBLIC_FLAGSHIP_NETWORK
      || process.env.FLAGSHIP_NETWORK
      || "",
  ).toLowerCase();
  return raw.includes("testnet") ? "testnet" : "mainnet";
}

export function getRpcNetwork(): NeoNetwork {
  return getTargetNetwork();
}

export function getMiniAppContractHash(appId: string, network: NeoNetwork = getTargetNetwork()): string | null {
  return CUSTOM_CONTRACT_HASHES[network][appId] || null;
}

export function getKernelHash(network: "mainnet" | "testnet" = "mainnet"): string {
  return network === "testnet" ? MORPHEUS_KERNEL_TESTNET : MORPHEUS_KERNEL_MAINNET;
}

export function isKernelRegisteredApp(appId: string): boolean {
  return !getMiniAppContractHash(appId);
}

export function getRpcUrl(network: NeoNetwork = getTargetNetwork()): string {
  return network === "testnet" ? NEO_TESTNET_RPC : NEO_MAINNET_RPC;
}
