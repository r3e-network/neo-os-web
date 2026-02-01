/**
 * CollectionStar - Star button for collecting/favoriting MiniApps
 */

"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";
import { cn } from "@/lib/utils";

interface CollectionStarProps {
  appId: string;
  className?: string;
}

export function CollectionStar({ appId, className }: CollectionStarProps) {
  const { collectionsSet, toggleCollection, isWalletConnected } = useCollections();
  const [isAnimating, setIsAnimating] = useState(false);
  // Use collectionsSet directly for reactive updates
  const collected = collectionsSet.has(appId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isWalletConnected) {
      // Could trigger wallet connect modal here
      alert("Please connect your wallet to collect MiniApps");
      return;
    }

    setIsAnimating(true);
    await toggleCollection(appId);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "p-1.5 rounded-full transition-all duration-200",
        "hover:scale-110 active:scale-95",
        collected
          ? "bg-yellow-400/90 text-yellow-900 shadow-lg shadow-yellow-400/30"
          : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white",
        isAnimating && "animate-bounce",
        className,
      )}
      title={collected ? "Remove from collection" : "Add to collection"}
    >
      <Star size={16} className={cn("transition-all duration-200", collected && "fill-yellow-900")} />
    </button>
  );
}
