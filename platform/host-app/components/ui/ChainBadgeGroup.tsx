/**
 * ChainBadgeGroup Component
 *
 * Displays multiple chain badges in a compact group.
 * Used in MiniAppCard banner to show supported chains.
 *
 * Deduplicates chains by base chain (e.g., neo-n3-mainnet and neo-n3-testnet
 * will only show one Neo logo).
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ChainId } from "@/lib/chains/types";
import { chainRegistry } from "@/lib/chains/registry";

interface ChainBadgeGroupProps {
  chainIds: ChainId[];
  maxDisplay?: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Extract base chain identifier from a chainId
 * e.g., "neo-n3-mainnet" -> "neo-n3"
 *       "neox-testnet" -> "neox"
 *       "ethereum-sepolia" -> "ethereum"
 */
function getBaseChain(chainId: ChainId): string {
  // Remove common network suffixes
  return chainId
    .replace(/-mainnet$/, "")
    .replace(/-testnet$/, "")
    .replace(/-sepolia$/, "")
    .replace(/-goerli$/, "")
    .replace(/-holesky$/, "");
}

/**
 * Deduplicate chains by base chain, preferring mainnet chains for display
 */
function deduplicateChains(chainIds: ChainId[]): ChainId[] {
  const baseChainMap = new Map<string, ChainId>();

  for (const chainId of chainIds) {
    const baseChain = getBaseChain(chainId);
    const existing = baseChainMap.get(baseChain);

    if (!existing) {
      // First occurrence of this base chain
      baseChainMap.set(baseChain, chainId);
    } else {
      // Prefer mainnet over testnet
      const isMainnet = chainId.includes("-mainnet") || chainId === "ethereum-mainnet";
      const existingIsMainnet = existing.includes("-mainnet") || existing === "ethereum-mainnet";

      if (isMainnet && !existingIsMainnet) {
        baseChainMap.set(baseChain, chainId);
      }
    }
  }

  return Array.from(baseChainMap.values());
}

export function ChainBadgeGroup({ chainIds, maxDisplay = 3, size = "sm", className }: ChainBadgeGroupProps) {
  // Deduplicate chains by base chain (one logo per chain family)
  const uniqueChains = useMemo(() => deduplicateChains(chainIds), [chainIds]);

  const displayChains = uniqueChains.slice(0, maxDisplay);
  const remaining = uniqueChains.length - maxDisplay;

  const sizeClass = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  const overlapClass = size === "sm" ? "-ml-1.5" : "-ml-2";

  return (
    <div className={cn("flex items-center", className)}>
      {displayChains.map((chainId, index) => {
        const chain = chainRegistry.getChain(chainId);
        if (!chain) return null;

        return (
          <div
            key={chainId}
            className={cn(
              sizeClass,
              "rounded-full border-2 border-white/20 bg-black/40",
              "backdrop-blur-sm shadow-sm",
              index > 0 && overlapClass,
            )}
            title={chain.name}
          >
            <img src={chain.icon} alt={chain.name} className="w-full h-full rounded-full object-contain p-0.5" />
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={cn(
            sizeClass,
            overlapClass,
            "rounded-full border-2 border-white/20 bg-black/60",
            "backdrop-blur-sm flex items-center justify-center",
            "text-[10px] font-bold text-white",
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
