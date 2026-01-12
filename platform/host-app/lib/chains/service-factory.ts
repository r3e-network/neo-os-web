/**
 * Chain Service Factory
 *
 * Creates appropriate chain service based on chain type.
 * Follows Factory Pattern for extensibility.
 */

import type { IChainService } from "./service-interface";
import type { ChainId } from "./types";
import { getChainRegistry } from "./registry";
import { EVMChainService } from "./evm-service";
import { NeoN3ChainService } from "./neo-service";

const serviceCache = new Map<ChainId, IChainService>();

export function createChainService(chainId: ChainId): IChainService {
  // Check cache first
  const cached = serviceCache.get(chainId);
  if (cached) return cached;

  // Get chain config to determine type
  const chain = getChainRegistry().getChain(chainId);
  if (!chain) {
    throw new Error(`Unknown chain: ${chainId}`);
  }

  let service: IChainService;

  switch (chain.type) {
    case "evm":
      service = new EVMChainService(chainId);
      break;
    case "neo-n3":
      service = new NeoN3ChainService(chainId);
      break;
    default: {
      // Exhaustive check - this should never be reached
      const _exhaustive: never = chain;
      throw new Error(`Unsupported chain type: ${(_exhaustive as { type: string }).type}`);
    }
  }

  // Cache and return
  serviceCache.set(chainId, service);
  return service;
}

export function clearServiceCache(): void {
  serviceCache.clear();
}

export function getServiceForChain(chainId: ChainId): IChainService {
  return createChainService(chainId);
}
