import React, { useState } from "react";
import { motion } from "framer-motion";
import { Play, Download, ExternalLink, Share2, Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

interface ActionButtonsProps {
  appId: string;
  appName: string;
  isInstalled?: boolean;
  isRunning?: boolean;
  onLaunch?: () => void;
  onInstall?: () => void;
  onShare?: () => void;
  onWishlist?: () => void;
  isWishlisted?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ActionButtons({
  appId,
  appName,
  isInstalled = true,
  isRunning = false,
  onLaunch,
  onInstall,
  onShare,
  onWishlist,
  isWishlisted = false,
  className,
  size = "md",
}: ActionButtonsProps) {
  const { t } = useTranslation("host");
  const [installing, setInstalling] = useState(false);
  const [launching, setLaunching] = useState(false);

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      await onInstall?.();
    } finally {
      setTimeout(() => setInstalling(false), 1000);
    }
  };

  const handleLaunch = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      await onLaunch?.();
    } finally {
      setTimeout(() => setLaunching(false), 500);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Primary Action Button */}
      {isInstalled ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLaunch}
          disabled={launching}
          className={cn(
            "flex items-center font-bold rounded-xl transition-all",
            "bg-gradient-to-r from-erobo-purple to-erobo-purple-dark text-white",
            "hover:shadow-lg hover:shadow-erobo-purple/30",
            "disabled:opacity-70 disabled:cursor-not-allowed",
            sizeClasses[size]
          )}
        >
          {launching ? (
            <Loader2 size={iconSizes[size]} className="animate-spin" />
          ) : isRunning ? (
            <ExternalLink size={iconSizes[size]} />
          ) : (
            <Play size={iconSizes[size]} />
          )}
          {isRunning
            ? t("detail.openApp") || "Open"
            : t("detail.launchApp") || "Launch"}
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleInstall}
          disabled={installing}
          className={cn(
            "flex items-center font-bold rounded-xl transition-all",
            "bg-gradient-to-r from-neo to-emerald-500 text-white",
            "hover:shadow-lg hover:shadow-neo/30",
            "disabled:opacity-70 disabled:cursor-not-allowed",
            sizeClasses[size]
          )}
        >
          {installing ? (
            <Loader2 size={iconSizes[size]} className="animate-spin" />
          ) : (
            <Download size={iconSizes[size]} />
          )}
          {installing
            ? t("detail.installing") || "Installing..."
            : t("detail.install") || "Install"}
        </motion.button>
      )}

      {/* Secondary Actions */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onShare}
        className={cn(
          "flex items-center justify-center rounded-xl transition-all",
          "bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/10",
          "hover:bg-white dark:hover:bg-white/20 hover:border-erobo-purple/30",
          "text-erobo-ink-soft dark:text-gray-400",
          size === "sm" ? "w-8 h-8" : size === "md" ? "w-10 h-10" : "w-12 h-12"
        )}
        title={t("detail.share") || "Share"}
      >
        <Share2 size={iconSizes[size]} />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onWishlist}
        className={cn(
          "flex items-center justify-center rounded-xl transition-all",
          "border",
          isWishlisted
            ? "bg-erobo-pink/10 border-erobo-pink/30 text-erobo-pink"
            : "bg-white/70 dark:bg-white/10 border-white/60 dark:border-white/10 text-erobo-ink-soft dark:text-gray-400 hover:bg-white dark:hover:bg-white/20 hover:border-erobo-pink/30",
          size === "sm" ? "w-8 h-8" : size === "md" ? "w-10 h-10" : "w-12 h-12"
        )}
        title={t("detail.wishlist") || "Add to Wishlist"}
      >
        <Heart size={iconSizes[size]} fill={isWishlisted ? "currentColor" : "none"} />
      </motion.button>
    </div>
  );
}
