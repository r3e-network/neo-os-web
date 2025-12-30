/**
 * Neo N3 RPC Client
 * Direct communication with Neo blockchain nodes
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

const RPC_ENDPOINTS = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
} as const;

export type Network = keyof typeof RPC_ENDPOINTS;

let requestId = 0;

export async function rpcCall<T>(method: string, params: unknown[], network: Network = "testnet"): Promise<T> {
  const endpoint = RPC_ENDPOINTS[network];
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
