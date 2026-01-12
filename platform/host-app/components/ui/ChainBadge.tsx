/**
 * ChainBadge Component
 *
 * Displays chain logo badges for miniapps.
 */

import { cn } from "@/lib/utils";
import type { ChainId } from "@/lib/chains/types";
import { chainRegistry } from "@/lib/chains/registry";

interface ChainBadgeProps {
  chainId: ChainId;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export function ChainBadge({ chainId, size = "sm", showName = false, className }: ChainBadgeProps) {
  const chain = chainRegistry.getChain(chainId);
  if (!chain) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <img
        src={chain.icon}
        alt={chain.name}
        className={cn(sizeClasses[size], "rounded-full")}
        style={{ backgroundColor: chain.color + "20" }}
      />
      {showName && <span className="text-xs font-medium text-muted-foreground">{chain.name}</span>}
    </div>
  );
}
