"use client";

/**
 * WishlistButton - Add/Remove app from wishlist
 */

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { logger } from "@/lib/logger";

interface WishlistButtonProps {
  appId: string;
  initialWishlisted?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  onToggle?: (wishlisted: boolean) => void;
}

export function WishlistButton({
  appId,
  initialWishlisted = false,
  size = "md",
  className,
  onToggle,
}: WishlistButtonProps) {
  const { t } = useTranslation("host");
  const { address } = useWalletStore();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizes = { sm: 16, md: 20, lg: 24 };

  const handleToggle = async () => {
    if (!address || loading) return;

    setLoading(true);
    try {
      const method = wishlisted ? "DELETE" : "POST";
      const res = await fetch("/api/user/wishlist", {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({ app_id: appId }),
      });

      if (res.ok) {
        const newState = !wishlisted;
        setWishlisted(newState);
        onToggle?.(newState);
      }
    } catch (err) {
      logger.error("Wishlist toggle failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={!address || loading}
      className={cn(
        "rounded-full flex items-center justify-center transition-all",
        "border hover:scale-105 active:scale-95",
        wishlisted
          ? "bg-red-500/10 border-red-500/30 text-red-500"
          : "bg-white/80 dark:bg-white/5 border-erobo-purple/10 dark:border-white/10 text-erobo-ink-soft/60 hover:text-red-500",
        !address && "opacity-50 cursor-not-allowed",
        sizeClasses[size],
        className,
      )}
      title={wishlisted ? t("wishlist.removeFromWishlist") : t("wishlist.addToWishlist")}
    >
      <Heart size={iconSizes[size]} className={cn(wishlisted && "fill-current")} />
    </button>
  );
}
