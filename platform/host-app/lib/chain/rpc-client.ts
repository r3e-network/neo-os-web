/**
 * Neo N3 RPC Client
 * Direct communication with Neo blockchain nodes
 * Supports custom RPC URLs for social account users
 */

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

export const DEFAULT_RPC_ENDPOINTS = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
} as const;

export type Network = keyof typeof DEFAULT_RPC_ENDPOINTS;

let requestId = 0;

/** Custom RPC URL override (set by wallet store) */
let customRpcUrlOverride: string | null = null;

/** Set custom RPC URL override */
export function setRpcUrlOverride(url: string | null): void {
  customRpcUrlOverride = url;
}

/** Get current RPC URL override */
export function getRpcUrlOverride(): string | null {
  return customRpcUrlOverride;
}

/** Get effective RPC endpoint */
export function getEffectiveRpcUrl(network: Network): string {
  return customRpcUrlOverride || DEFAULT_RPC_ENDPOINTS[network];
}

export async function rpcCall<T>(method: string, params: unknown[], network: Network = "testnet"): Promise<T> {
  const endpoint = getEffectiveRpcUrl(network);
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
  contractHash: string,
  method: string,
  args: unknown[] = [],
  network: Network = "testnet",
): Promise<InvokeResult> {
  return rpcCall<InvokeResult>("invokefunction", [contractHash, method, args], network);
}

export async function getBlockCount(network: Network = "testnet"): Promise<number> {
  return rpcCall<number>("getblockcount", [], network);
}

export async function getApplicationLog(txHash: string, network: Network = "testnet"): Promise<unknown> {
  return rpcCall("getapplicationlog", [txHash], network);
}
