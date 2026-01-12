/**
 * useChains Hook
 *
 * React hook for accessing chain configurations.
 */

import { useMemo } from "react";
import { chainRegistry } from "./registry";
import type { ChainConfig, ChainId, ChainType } from "./types";

export function useChains() {
  const chains = useMemo(() => chainRegistry.getChains(), []);
  const activeChains = useMemo(() => chainRegistry.getActiveChains(), []);

  const getChain = (chainId: ChainId): ChainConfig | undefined => {
    return chainRegistry.getChain(chainId);
  };

  const getChainsByType = (type: ChainType): ChainConfig[] => {
    return chainRegistry.getChainsByType(type);
  };

  return {
    chains,
    activeChains,
    getChain,
    getChainsByType,
    mainnetChains: chainRegistry.getMainnetChains(),
    testnetChains: chainRegistry.getTestnetChains(),
  };
}
