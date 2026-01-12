/**
 * ChainBadgeGroup Component
 *
 * Displays multiple chain badges in a compact group.
 * Used in MiniAppCard banner to show supported chains.
 */

import { cn } from "@/lib/utils";
import type { ChainId } from "@/lib/chains/types";
import { chainRegistry } from "@/lib/chains/registry";

interface ChainBadgeGroupProps {
  chainIds: ChainId[];
  maxDisplay?: number;
  size?: "sm" | "md";
  className?: string;
}

export function ChainBadgeGroup({ chainIds, maxDisplay = 3, size = "sm", className }: ChainBadgeGroupProps) {
  const displayChains = chainIds.slice(0, maxDisplay);
  const remaining = chainIds.length - maxDisplay;

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
