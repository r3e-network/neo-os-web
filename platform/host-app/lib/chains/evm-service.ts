/**
 * EVM Chain Service
 */

import type { IChainService } from "./service-interface";
import type { ChainId } from "./types";
import { getRPCClient } from "./rpc-client";

export class EVMChainService implements IChainService {
  readonly chainId: ChainId;
  readonly chainType = "evm" as const;
  private rpc: ReturnType<typeof getRPCClient>;

  constructor(chainId: ChainId) {
    this.chainId = chainId;
    this.rpc = getRPCClient(chainId);
  }

  async getBlockNumber(): Promise<number> {
    const hex = await this.rpc.call<string>({ method: "eth_blockNumber" });
    return parseInt(hex, 16);
  }

  async getBalance(address: string): Promise<string> {
    return this.rpc.call<string>({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
  }

  async getTransaction(txHash: string): Promise<unknown> {
    return this.rpc.call({
      method: "eth_getTransactionByHash",
      params: [txHash],
    });
  }
}
