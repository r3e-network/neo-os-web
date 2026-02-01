/**
 * Multi-Chain RPC Client
 *
 * Unified RPC client with automatic failover.
 */

import { getChainRegistry } from "./registry";
import type { ChainId } from "./types";

interface RPCRequest {
  method: string;
  params?: unknown[];
}

interface RPCResponse<T = unknown> {
  result?: T;
  error?: { code: number; message: string };
}

export class ChainRPCClient {
  private chainId: ChainId;

  constructor(chainId: ChainId) {
    this.chainId = chainId;
  }

  async call<T>(request: RPCRequest): Promise<T> {
    const chain = getChainRegistry().getChain(this.chainId);
    if (!chain) throw new Error(`Chain ${this.chainId} not found`);

    const urls = chain.rpcUrls || [];
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        return await this.sendRequest<T>(url, request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error("No RPC URLs available");
  }

  private async sendRequest<T>(url: string, request: RPCRequest): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        ...request,
      }),
    });

    const data: RPCResponse<T> = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result as T;
  }
}

export function getRPCClient(chainId: ChainId): ChainRPCClient {
  return new ChainRPCClient(chainId);
}
