"use client";

/**
 * FeaturedHeroCarousel - Steam-style hero carousel for featured apps
 * Displays featured/promoted MiniApps in a large, visually prominent carousel
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star, Users, Zap } from "lucide-react";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import { ChainBadgeGroup } from "@/components/ui/ChainBadgeGroup";
import { useTranslation } from "@/lib/i18n/react";
import { formatNumber } from "@/lib/utils";
import { getLocalizedField } from "@neo/shared/i18n";
import type { ChainId } from "@/lib/chains/types";

export interface FeaturedApp {
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  category: "gaming" | "defi" | "social" | "nft" | "governance" | "utility";
  icon?: string;
  banner?: string;
  supportedChains?: ChainId[];
  stats?: {
    users?: number;
    transactions?: number;
    rating?: number;
    reviews?: number;
  };
  featured?: {
    tagline?: string;
    tagline_zh?: string;
    highlight?: "new" | "trending" | "popular" | "promoted";
  };
}

interface FeaturedHeroCarouselProps {
  apps: FeaturedApp[];
  autoPlayInterval?: number;
}

export function FeaturedHeroCarousel({ apps, autoPlayInterval = 5000 }: FeaturedHeroCarouselProps) {
  const { t, locale } = useTranslation("host");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % apps.length);
  }, [apps.length]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + apps.length) % apps.length);
  }, [apps.length]);

  // Auto-play
  useEffect(() => {
    if (isHovered || apps.length <= 1) return;
    const timer = setInterval(next, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isHovered, apps.length, autoPlayInterval, next]);

  if (apps.length === 0) return null;

  const currentApp = apps[currentIndex];
  const appName = getLocalizedField(currentApp, "name", locale);
  const appDesc = getLocalizedField(currentApp, "description", locale);
  const tagline = currentApp.featured ? getLocalizedField(currentApp.featured, "tagline", locale) : undefined;

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Hero Area */}
      <div className="relative h-[400px] md:h-[480px]">
        {/* Background Image/Gradient */}
        <div className="absolute inset-0">
          {currentApp.banner ? (
            <Image
              src={currentApp.banner}
              alt={appName}
              fill
              className="object-cover transition-opacity duration-500"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-erobo-purple/30 via-erobo-pink/20 to-erobo-sky/30" />
          )}
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col justify-end p-8 md:p-12">
          {/* Highlight Badge */}
          {currentApp.featured?.highlight && <HighlightBadge type={currentApp.featured.highlight} t={t} />}

          {/* App Info */}
          <div className="flex items-end gap-6 mb-6">
            <MiniAppLogo
              appId={currentApp.app_id}
              category={currentApp.category}
              size="xl"
              iconUrl={currentApp.icon}
              className="w-24 h-24 md:w-32 md:h-32 rounded-2xl shadow-2xl border-2 border-white/20"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">{appName}</h2>
              {tagline && <p className="text-lg text-white/90 font-medium mb-2">{tagline}</p>}
              <p className="text-white/70 line-clamp-2 max-w-2xl">{appDesc}</p>
            </div>
          </div>

          {/* Stats & Actions Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Rating */}
            {currentApp.stats?.rating && (
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span suppressHydrationWarning className="text-white font-semibold">{currentApp.stats.rating.toFixed(1)}</span>
                {currentApp.stats.reviews && (
                  <span suppressHydrationWarning className="text-white/60 text-sm">({formatNumber(currentApp.stats.reviews)})</span>
                )}
              </div>
            )}

            {/* Users */}
            {currentApp.stats?.users && (
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <Users className="w-4 h-4 text-erobo-purple" />
                <span suppressHydrationWarning className="text-white font-semibold">{formatNumber(currentApp.stats.users)}</span>
                <span className="text-white/60 text-sm">{t("featured.users")}</span>
              </div>
            )}

            {/* Chains */}
            {currentApp.supportedChains && currentApp.supportedChains.length > 0 && (
              <ChainBadgeGroup chainIds={currentApp.supportedChains} size="sm" />
            )}

            {/* Launch Button */}
            <Link
              href={`/miniapps/${currentApp.app_id}`}
              className="ml-auto flex items-center gap-2 bg-erobo-purple hover:bg-erobo-purple-dark text-white font-semibold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg"
            >
              <Zap className="w-5 h-5" />
              {t("featured.launch")}
            </Link>
          </div>
        </div>

        {/* Navigation Arrows */}
        {apps.length > 1 && (
          <>
            <NavArrow direction="left" onClick={prev} />
            <NavArrow direction="right" onClick={next} />
          </>
        )}
      </div>

      {/* Thumbnail Strip */}
      {apps.length > 1 && (
        <ThumbnailStrip apps={apps} currentIndex={currentIndex} onSelect={setCurrentIndex} locale={locale} />
      )}
    </div>
  );
}

function HighlightBadge({ type, t }: { type: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    new: { bg: "bg-green-500", text: "text-white", label: t("featured.new") },
    trending: { bg: "bg-orange-500", text: "text-white", label: t("featured.trending") },
    popular: { bg: "bg-erobo-purple", text: "text-white", label: t("featured.popular") },
    promoted: { bg: "bg-erobo-purple", text: "text-white", label: t("featured.promoted") },
  };
  const { bg, text, label } = config[type] || config.promoted;

  return (
    <span
      className={`inline-flex items-center gap-1 ${bg} ${text} text-xs font-bold uppercase px-3 py-1 rounded-full mb-4 w-fit`}
    >
      {label}
    </span>
  );
}

function NavArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${direction === "left" ? "left-4" : "right-4"
        } w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/60 transition-all cursor-pointer opacity-0 group-hover:opacity-100 hover:opacity-100`}
      style={{ opacity: 0.7 }}
    >
      <Icon size={24} className="text-white" />
    </button>
  );
}

function ThumbnailStrip({
  apps,
  currentIndex,
  onSelect,
  locale,
}: {
  apps: FeaturedApp[];
  currentIndex: number;
  onSelect: (index: number) => void;
  locale: string;
}) {
  return (
    <div className="flex gap-2 p-4 bg-black/40 backdrop-blur-sm overflow-x-auto">
      {apps.map((app, i) => {
        const name = getLocalizedField(app, "name", locale);
        const isActive = i === currentIndex;
        return (
          <button
            key={app.app_id}
            onClick={() => onSelect(i)}
            className={`flex-shrink-0 flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${isActive
              ? "bg-erobo-purple/30 border border-erobo-purple"
              : "bg-white/5 border border-transparent hover:bg-white/10"
              }`}
          >
            <MiniAppLogo
              appId={app.app_id}
              category={app.category}
              size="sm"
              iconUrl={app.icon}
              className="w-10 h-10 rounded-lg"
            />
            <span className={`text-sm font-medium ${isActive ? "text-white" : "text-white/70"}`}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
