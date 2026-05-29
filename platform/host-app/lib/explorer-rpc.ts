/**
 * Shared Neo N3 JSON-RPC helpers for the explorer API routes.
 *
 * Centralizes the RPC endpoint resolution and the JSON-RPC 2.0 POST call that
 * were previously duplicated across the explorer routes (recent, search, stats).
 */

export type Network = "mainnet" | "testnet";

/**
 * Resolve the Neo N3 JSON-RPC endpoint for a network.
 *
 * Reads NEO_RPC_MAINNET / NEO_RPC_TESTNET with the platform's n3index
 * gateway as the fallback.
 */
export function getNeoRPCURL(network: Network): string {
  if (network === "mainnet") {
    return process.env.NEO_RPC_MAINNET || "https://api.n3index.dev/mainnet";
  }
  return process.env.NEO_RPC_TESTNET || "https://api.n3index.dev/testnet";
}

export interface NeoRpcOptions {
  /** Abort timeout in milliseconds (default 10000). */
  timeoutMs?: number;
}

/**
 * Perform a JSON-RPC 2.0 call against the Neo N3 gateway for a network.
 *
 * Throws on non-2xx responses and on JSON-RPC error payloads.
 */
export async function neoRpcCall<T>(
  network: Network,
  method: string,
  params: unknown[],
  options: NeoRpcOptions = {},
): Promise<T> {
  const { timeoutMs = 10000 } = options;
  const response = await fetch(getNeoRPCURL(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`RPC error: ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(String(payload.error.message || payload.error.code || "RPC error"));
  }
  return payload?.result as T;
}
