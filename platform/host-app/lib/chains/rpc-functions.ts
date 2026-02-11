/**
 * Neo N3 RPC Functions
 * Functional API for direct communication with Neo N3 nodes.
 * Migrated from lib/chain/rpc-client.ts into lib/chains/ for consolidation.
 */

import type { ChainId } from "./types";
import { chainRegistry } from "./registry";

export interface RpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

export interface RpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

export interface InvokeResult {
  script: string;
  state: "HALT" | "FAULT";
  gasconsumed: string;
  stack: StackItem[];
}

export type StackItem =
  | { type: "Integer"; value: string }
  | { type: "ByteString"; value: string }
  | { type: "Boolean"; value: boolean }
  | { type: "Array"; value: StackItem[] }
  | { type: "Map"; value: { key: StackItem; value: StackItem }[] }
  | { type: "Any"; value: null };

// ============================================================================
// Multi-Chain RPC Configuration
// ============================================================================

/** Multi-chain RPC endpoints (fallback if registry unavailable) */
export const CHAIN_RPC_ENDPOINTS: Record<ChainId, string[]> = {
  "neo-n3-mainnet": ["https://mainnet1.neo.coz.io:443", "https://mainnet2.neo.coz.io:443"],
  "neo-n3-testnet": ["https://testnet1.neo.coz.io:443", "https://testnet2.neo.coz.io:443"],
};

let requestId = 0;

/** Custom RPC URL overrides per chain */
const customRpcOverrides: Partial<Record<ChainId, string>> = {};

/** Set custom RPC URL for a specific chain */
export function setChainRpcUrl(chainId: ChainId, url: string | null): void {
  if (url) {
    customRpcOverrides[chainId] = url;
  } else {
    delete customRpcOverrides[chainId];
  }
}

/** Get RPC URL for a specific chain */
export function getChainRpcUrl(chainId: ChainId): string {
  if (customRpcOverrides[chainId]) {
    return customRpcOverrides[chainId]!;
  }
  const chain = chainRegistry.getChain(chainId);
  if (chain && "rpcUrls" in chain && chain.rpcUrls.length > 0) {
    return chain.rpcUrls[0];
  }
  const endpoints = CHAIN_RPC_ENDPOINTS[chainId];
  if (endpoints && endpoints.length > 0) {
    return endpoints[0];
  }
  throw new Error(`No RPC endpoint for chain: ${chainId}`);
}

/** RPC call using ChainId */
export async function rpcCall<T>(method: string, params: unknown[], chainId: ChainId): Promise<T> {
  const endpoint = getChainRpcUrl(chainId);
  const request: RpcRequest = {
    jsonrpc: "2.0",
    id: ++requestId,
    method,
    params,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }

  const data: RpcResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result as T;
}

export async function invokeRead(
  contractAddress: string,
  method: string,
  args: unknown[],
  chainId: ChainId,
): Promise<InvokeResult> {
  return rpcCall<InvokeResult>("invokefunction", [contractAddress, method, args], chainId);
}

export async function getBlockCount(chainId: ChainId): Promise<number> {
  return rpcCall<number>("getblockcount", [], chainId);
}

export async function getApplicationLog(txHash: string, chainId: ChainId): Promise<unknown> {
  return rpcCall("getapplicationlog", [txHash], chainId);
}

// ============================================================================
// Chain Type Detection
// ============================================================================

/** Get chain type from chain ID */
export function getChainTypeFromId(chainId: ChainId): "neo-n3" {
  const chain = chainRegistry.getChain(chainId);
  if (chain) {
    return chain.type;
  }
  return "neo-n3";
}

/** Check if chain is Neo N3 */
export function isNeoN3ChainId(chainId: ChainId): boolean {
  return getChainTypeFromId(chainId) === "neo-n3";
}

// Re-exports for unified chain access
export {
  rpcCall as chainRpcCall,
  getBlockCount as getBlockCountMultiChain,
  getApplicationLog as getTransactionLogMultiChain,
};
