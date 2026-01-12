/**
 * Chain Service Interface
 *
 * Abstract interface for chain-specific operations.
 */

import type { ChainId, ChainType } from "./types";

export interface IChainService {
  readonly chainId: ChainId;
  readonly chainType: ChainType;

  getBlockNumber(): Promise<number>;
  getBalance(address: string): Promise<string>;
  getTransaction(txHash: string): Promise<unknown>;
}
