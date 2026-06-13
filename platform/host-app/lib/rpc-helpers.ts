/**
 * RPC helpers for reading on-chain state from the host-app.
 *
 * Two modes:
 * 1. CUSTOM CONTRACT apps — read directly from their deployed contract
 *    (resolved from the shared MINIAPP_CONTRACTS registry)
 * 2. KERNEL-REGISTERED apps — read from Morpheus Oracle kernel state
 */
import { MINIAPP_CONTRACTS } from "../../../apps/shared/constants/rpc";

// Neo3Fura/N3Index is the platform-owned Neo N3 gateway. It provides JSON-RPC
// pass-through plus indexed read APIs behind the same Cloudflare edge.
const NEO_MAINNET_RPC = process.env.NEXT_PUBLIC_NEO_RPC_MAINNET
  || process.env.NEO_RPC_MAINNET
  || "https://api.n3index.dev/mainnet";
const NEO_TESTNET_RPC = process.env.NEXT_PUBLIC_NEO_RPC_TESTNET
  || process.env.NEO_RPC_TESTNET
  || process.env.NEO_RPC_URL
  || "https://api.n3index.dev/testnet";

const MORPHEUS_KERNEL_MAINNET = "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";
const MORPHEUS_KERNEL_TESTNET = "0x4b882e94ed766807c4fd728768f972e13008ad52";

type NeoNetwork = "mainnet" | "testnet";

// Apps with their own deployed smart contracts (atomic GAS handling) resolve
// straight from the shared, drift-guarded registry (generated from each app's
// neo-manifest.json). Sourcing from MINIAPP_CONTRACTS — the same map the
// miniapp runtimes use — guarantees the host can never drift from the deployed
// contracts (a hand-maintained copy here had gone stale across the OS-path
// standalone-contract migrations). Apps absent from the registry have no
// standalone contract and read from the Morpheus kernel.
const CUSTOM_CONTRACT_HASHES = MINIAPP_CONTRACTS;

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
