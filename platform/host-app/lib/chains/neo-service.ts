/**
 * Neo N3 Chain Service
 */

import type { IChainService } from "./service-interface";
import type { ChainId } from "./types";
import { getRPCClient } from "./rpc-client";

export class NeoN3ChainService implements IChainService {
  readonly chainId: ChainId;
  readonly chainType = "neo-n3" as const;
  private rpc: ReturnType<typeof getRPCClient>;

  constructor(chainId: ChainId) {
    this.chainId = chainId;
    this.rpc = getRPCClient(chainId);
  }

  async getBlockNumber(): Promise<number> {
    return this.rpc.call<number>({ method: "getblockcount" });
  }

  async getBalance(address: string): Promise<string> {
    const result = await this.rpc.call<{ balance: unknown[] }>({
      method: "getnep17balances",
      params: [address],
    });
    return JSON.stringify(result.balance || []);
  }

  async getTransaction(txHash: string): Promise<unknown> {
    return this.rpc.call({
      method: "getrawtransaction",
      params: [txHash, true],
    });
  }
}
