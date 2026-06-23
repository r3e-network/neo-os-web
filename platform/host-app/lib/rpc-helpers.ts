/**
 * RPC helpers for reading on-chain state from the host-app.
 *
 * Two modes:
 * 1. CUSTOM CONTRACT apps — read directly from their deployed contract
 *    (resolved from the shared MINIAPP_CONTRACTS registry)
 * 2. KERNEL-REGISTERED apps — read from Morpheus Oracle kernel state
 */
import { getMiniAppContractHash as resolveSharedMiniAppContractHash } from "../../../apps/shared/constants/rpc";

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

function getNetworkFromBrowserUrl(): NeoNetwork | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URL(window.location.href).searchParams
      .get("network")
      ?.trim()
      .toLowerCase();
    if (raw === "main" || raw === "mainnet" || raw === "neo-n3-mainnet") {
      return "mainnet";
    }
    if (raw === "test" || raw === "testnet" || raw === "neo-n3-testnet") {
      return "testnet";
    }
  } catch (_e: unknown) {
    return null;
  }
  return null;
}

export function getActiveRpcNetwork(): NeoNetwork {
  return getNetworkFromBrowserUrl() ?? getTargetNetwork();
}

// Apps with their own deployed smart contracts (atomic GAS handling) resolve
// straight from the shared, drift-guarded registry (generated from each app's
// neo-manifest.json) via the shared resolver. Sourcing from the same resolver
// the miniapp runtimes use guarantees the host can never drift from the
// deployed contracts. The shared resolver returns an empty-string sentinel
// for apps with no standalone contract; normalize that to `null` here so
// callers can keep using the kernel fallback path.
export function getMiniAppContractHash(appId: string, network: NeoNetwork = getTargetNetwork()): string | null {
  return resolveSharedMiniAppContractHash(appId, network) || null;
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
