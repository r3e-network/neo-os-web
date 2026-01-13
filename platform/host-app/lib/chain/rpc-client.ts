/**
 * Multi-Chain RPC Client
 * Direct communication with blockchain nodes
 * Supports Neo N3, NeoX, Ethereum and other EVM chains
 */

import type { ChainId } from "../chains/types";
import { chainRegistry } from "../chains/registry";

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
  "neox-mainnet": ["https://mainnet-1.rpc.banelabs.org"],
  "neox-testnet": ["https://neoxt4seed1.ngd.network"],
  "ethereum-mainnet": ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
  "ethereum-sepolia": ["https://rpc.sepolia.org", "https://rpc2.sepolia.org"],
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
  // Check custom override first
  if (customRpcOverrides[chainId]) {
    return customRpcOverrides[chainId]!;
  }
  // Try chain registry
  const chain = chainRegistry.getChain(chainId);
  if (chain && "rpcUrls" in chain && chain.rpcUrls.length > 0) {
    return chain.rpcUrls[0];
  }
  // Fall back to hardcoded endpoints
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

/** Alias for rpcCall */
export const chainRpcCall = rpcCall;

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
export function getChainTypeFromId(chainId: ChainId): "neo-n3" | "evm" {
  const chain = chainRegistry.getChain(chainId);
  if (chain) {
    return chain.type;
  }
  // Fallback based on chain ID prefix
  if (chainId.startsWith("neo-n3")) return "neo-n3";
  return "evm";
}

/** Check if chain is Neo N3 */
export function isNeoN3ChainId(chainId: ChainId): boolean {
  return getChainTypeFromId(chainId) === "neo-n3";
}

/** Check if chain is EVM */
export function isEVMChainId(chainId: ChainId): boolean {
  return getChainTypeFromId(chainId) === "evm";
}

// ============================================================================
// EVM-Specific RPC Methods
// ============================================================================

/** EVM eth_call result */
export interface EVMCallResult {
  result: string;
}

/** Call EVM contract (read-only) */
export async function evmCall(to: string, data: string, chainId: ChainId): Promise<string> {
  return rpcCall<string>("eth_call", [{ to, data }, "latest"], chainId);
}

/** Get EVM block number */
export async function evmGetBlockNumber(chainId: ChainId): Promise<number> {
  const hex = await rpcCall<string>("eth_blockNumber", [], chainId);
  return parseInt(hex, 16);
}

/** Get EVM transaction receipt */
export async function evmGetTransactionReceipt(txHash: string, chainId: ChainId): Promise<unknown> {
  return rpcCall("eth_getTransactionReceipt", [txHash], chainId);
}

/** Get EVM balance */
export async function evmGetBalance(address: string, chainId: ChainId): Promise<string> {
  const hex = await rpcCall<string>("eth_getBalance", [address, "latest"], chainId);
  // Convert from wei to ether (18 decimals)
  const wei = BigInt(hex);
  return (Number(wei) / 1e18).toString();
}

// ============================================================================
// Multi-Chain Unified Methods
// ============================================================================

/** Get block count/number for any chain */
export async function getBlockCountMultiChain(chainId: ChainId): Promise<number> {
  if (isNeoN3ChainId(chainId)) {
    return getBlockCount(chainId);
  }
  return evmGetBlockNumber(chainId);
}

/** Get transaction log/receipt for any chain */
export async function getTransactionLogMultiChain(txHash: string, chainId: ChainId): Promise<unknown> {
  if (isNeoN3ChainId(chainId)) {
    return getApplicationLog(txHash, chainId);
  }
  return evmGetTransactionReceipt(txHash, chainId);
}
