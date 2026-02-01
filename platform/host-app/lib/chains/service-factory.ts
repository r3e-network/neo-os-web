/**
 * Chain Service Factory
 *
 * Creates appropriate chain service based on chain type.
 * Follows Factory Pattern for extensibility.
 */

import type { IChainService } from "./service-interface";
import type { ChainId } from "./types";
import { getChainRegistry } from "./registry";
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

  const service: IChainService = new NeoN3ChainService(chainId);

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
