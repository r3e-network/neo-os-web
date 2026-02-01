"use client";

/**
 * DiscoveryCarousel - Personalized app recommendations
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import { useWalletStore } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";

interface DiscoveryItem {
  app_id: string;
  reason?: string;
  score: number;
}

interface DiscoveryCarouselProps {
  apps: Array<{
    app_id: string;
    name: string;
    description: string;
    category: string;
    icon?: string;
  }>;
}

export function DiscoveryCarousel({ apps }: DiscoveryCarouselProps) {
  const { t } = useTranslation("host");
  const { address } = useWalletStore();
  const [queue, setQueue] = useState<DiscoveryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!address) return;
      try {
        const res = await fetch("/api/user/discovery-queue", {
          headers: { "x-wallet-address": address },
        });
        const data = await res.json();
        setQueue(data.queue || []);
      } catch (err) {
        console.error("Failed to fetch discovery queue:", err);
      }
    };
    fetchQueue();
  }, [address]);

  // Filter apps based on queue or show random if no queue
  const displayApps =
    queue.length > 0 ? queue.map((q) => apps.find((a) => a.app_id === q.app_id)).filter(Boolean) : apps.slice(0, 6);

  const next = () => {
    setCurrentIndex((i) => (i + 1) % displayApps.length);
  };

  const prev = () => {
    setCurrentIndex((i) => (i - 1 + displayApps.length) % displayApps.length);
  };

  if (displayApps.length === 0) return null;

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-erobo-purple" size={20} />
        <h3 className="font-bold text-erobo-ink dark:text-white">{t("discovery.title")}</h3>
      </div>

      {/* Carousel */}
      <div className="relative overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-300"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {displayApps.map((app) => app && <DiscoveryCard key={app.app_id} app={app} />)}
        </div>

        {/* Navigation */}
        {displayApps.length > 1 && (
          <>
            <NavButton direction="left" onClick={prev} />
            <NavButton direction="right" onClick={next} />
          </>
        )}
      </div>

      {/* Dots */}
      {displayApps.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {displayApps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? "bg-erobo-purple w-6" : "bg-gray-300 dark:bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveryCard({ app }: { app: NonNullable<DiscoveryCarouselProps["apps"][0]> }) {
  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className="min-w-full p-6 bg-gradient-to-br from-erobo-purple/10 to-erobo-pink/10 border border-erobo-purple/20 rounded-2xl cursor-pointer hover:border-erobo-purple/40 transition-all"
    >
      <div className="flex items-center gap-4">
        <MiniAppLogo
          appId={app.app_id}
          category={app.category as "gaming" | "defi" | "social" | "nft" | "governance" | "utility"}
          size="lg"
          iconUrl={app.icon}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-erobo-ink dark:text-white truncate">{app.name}</h4>
          <p className="text-sm text-erobo-ink-soft/70 dark:text-white/60 line-clamp-2">{app.description}</p>
        </div>
      </div>
    </Link>
  );
}

function NavButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${
        direction === "left" ? "left-2" : "right-2"
      } w-10 h-10 rounded-full bg-white/90 dark:bg-white/10 border border-white/60 dark:border-white/10 flex items-center justify-center hover:bg-white dark:hover:bg-white/20 transition-all shadow-lg cursor-pointer backdrop-blur-sm`}
    >
      <Icon size={20} className="text-erobo-ink dark:text-white" />
    </button>
  );
}
