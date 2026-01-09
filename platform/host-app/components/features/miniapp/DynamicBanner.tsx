"use client";

import { useMemo, useState, useEffect } from "react";
import { getAppIcon } from "./AppIcons";

// Highlight data structure for live stats overlay
export interface HighlightData {
  label: string;
  value: string;
  icon?: string;
  trend?: "up" | "down" | "neutral";
}

interface DynamicBannerProps {
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  icon: string;
  appId: string;
  appName?: string;
  highlights?: HighlightData[];
}

// Category-based styles matching Neo Brutalism
const CATEGORY_STYLES: Record<string, { bg: string; text: string; fontFamily: string }> = {
  gaming: {
    bg: "bg-brutal-yellow",
    text: "text-black",
    fontFamily: "'Orbitron', sans-serif",
  },
  defi: {
    bg: "bg-neo",
    text: "text-black",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  social: {
    bg: "bg-brutal-pink",
    text: "text-black",
    fontFamily: "'Poppins', sans-serif",
  },
  governance: {
    bg: "bg-brutal-blue",
    text: "text-white",
    fontFamily: "'Playfair Display', serif",
  },
  utility: {
    bg: "bg-electric-purple",
    text: "text-white",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  nft: {
    bg: "bg-brutal-lime",
    text: "text-black",
    fontFamily: "'Righteous', cursive",
  },
};

export function DynamicBanner({ category, appId, appName, highlights }: DynamicBannerProps) {
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.utility;
  const bgColor = categoryStyle.bg;
  const IconComponent = getAppIcon(appId);

  // Countdown State (Only for Daily Check-in)
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (appId !== "miniapp-dailycheckin") return;

    const updateTimer = () => {
      const now = new Date();
      // Calculate next UTC midnight
      const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diff = nextMidnight.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [appId]);

  return (
    <div className={`relative h-full overflow-hidden ${bgColor} border-b-4 border-black`}>
      {/* Decorative Pattern - Stripes or Dots */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#000_1px,transparent_0)] bg-[size:10px_10px]" />

      {/* App Name with Icons - Centered */}
      {appName && (
        <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <IconComponent className={`w-12 h-12 ${categoryStyle.text} drop-shadow-[2px_2px_0_#000]`} />
              <h2
                className={`text-2xl sm:text-3xl font-black uppercase tracking-wider text-center ${categoryStyle.text} drop-shadow-[2px_2px_0_#000]`}
                style={{ fontFamily: categoryStyle.fontFamily }}
              >
                {appName}
              </h2>
            </div>
          </div>
        </div>
      )}

      {/* Special Countdown for Daily Check-in */}
      {appId === "miniapp-dailycheckin" && timeLeft && (
        <div className="absolute bottom-4 right-4 z-20 transform rotate-[-2deg] transition-transform group-hover:rotate-0 hover:scale-110 duration-200">
          <div className="bg-black border-2 border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] p-2 min-w-[110px] text-center">
            <div className="text-xl font-black text-neo leading-none tracking-widest font-mono">{timeLeft}</div>
            <div className="text-[9px] font-bold uppercase text-white mt-1">Next Reset</div>
          </div>
        </div>
      )}

      {/* Standard Live Data Highlights Overlay - Sticker Style (Hidden if Checkin App to avoid clutter, or maybe stacked?) */}
      {/* Currently replacing highlights for checkin app to prioritize the timer */}
      {appId !== "miniapp-dailycheckin" && highlights && highlights.length > 0 && (
        <div className="absolute bottom-4 right-4 z-20 transform rotate-[-2deg] transition-transform group-hover:rotate-0 hover:scale-110 duration-200">
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 min-w-[100px] text-center">
            <div className="text-xl font-black text-black leading-none">{highlights[0].value}</div>
            <div className="text-[10px] font-bold uppercase text-gray-500 mt-1 flex items-center justify-center gap-1">
              <span>{highlights[0].label}</span>
              {highlights[0].trend && (
                <span
                  className={
                    highlights[0].trend === "up"
                      ? "text-neo"
                      : highlights[0].trend === "down"
                        ? "text-brutal-red"
                        : "text-gray-500"
                  }
                >
                  {highlights[0].trend === "up" ? "↑" : highlights[0].trend === "down" ? "↓" : "-"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
