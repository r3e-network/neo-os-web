"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dice5,
  TrendingUp,
  Puzzle,
  Heart,
  Palette,
  Vote,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import {
  buildMiniAppLogoSources,
} from "@/lib/miniapp-media";

// Map app_id to professional Lucide icons
// No per-app icon table. An app declares its own artwork in its manifest and
// the platform renders whatever that resolves to; when it resolves to nothing,
// the fallback is by category, which is part of the manifest protocol. A table
// keyed by app id would mean the platform has to learn about every app that
// ships, which is exactly what the manifest exists to avoid.

// Category fallback icons
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  gaming: Dice5,
  defi: TrendingUp,
  social: Heart,
  nft: Palette,
  governance: Vote,
  utility: ClipboardList,
  data: BarChart3,
  other: Puzzle,
};

const CATEGORY_ACCENTS: Record<string, { text: string; background: string }> = {
  gaming: { text: "text-cat-game", background: "bg-cat-game/10" },
  defi: { text: "text-cat-defi", background: "bg-cat-defi/10" },
  social: { text: "text-cat-social", background: "bg-cat-social/10" },
  governance: { text: "text-cat-governance", background: "bg-cat-governance/10" },
  utility: { text: "text-cat-tool", background: "bg-cat-tool/10" },
  nft: { text: "text-cat-nft", background: "bg-cat-nft/10" },
  data: { text: "text-info-600", background: "bg-info-50" },
  other: { text: "text-ink-muted", background: "bg-surface-secondary" },
};

interface MiniAppLogoProps {
  appId: string;
  category:
    | "gaming"
    | "defi"
    | "social"
    | "governance"
    | "utility"
    | "nft"
    | "data"
    | "other";
  entryUrl?: string | null;
  logoUrl?: string | null;
  manifest?: Record<string, unknown> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

export function MiniAppLogo({
  appId,
  category,
  entryUrl,
  logoUrl,
  manifest,
  size = "md",
  className = "",
  alt,
}: MiniAppLogoProps) {
  const Icon = CATEGORY_ICONS[category] || Puzzle;
  const accent = CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.utility;

  const sizeClasses = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-xl",
  };

  const iconSizes = {
    sm: 14,
    md: 17,
    lg: 20,
  };

  const logoSources = useMemo(
    () =>
      buildMiniAppLogoSources({
        appID: appId,
        entryURL: entryUrl,
        logoURL: logoUrl,
        manifest: manifest || null,
      }),
    [appId, entryUrl, logoUrl, manifest],
  );

  const [logoIndex, setLogoIndex] = useState(0);

  useEffect(() => {
    setLogoIndex(0);
  }, [logoSources]);

  const logoSource = logoSources[logoIndex];
  if (logoSource) {
    return (
      <div
        className={`relative flex-shrink-0 ${sizeClasses[size]} overflow-hidden border border-border bg-surface shadow-sm ${className}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            size={iconSizes[size]}
            className={accent.text}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
        <img
          src={logoSource}
          alt={alt || appId}
          className="absolute inset-0 h-full w-full object-contain p-0.5"
          loading="lazy"
          decoding="async"
          onError={() => {
            setLogoIndex((prev) =>
              prev + 1 < logoSources.length ? prev + 1 : logoSources.length,
            );
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center border border-border shadow-sm ${sizeClasses[size]} ${accent.background} ${accent.text} ${className}`}
    >
      <Icon size={iconSizes[size]} strokeWidth={1.8} aria-hidden="true" />
    </div>
  );
}
