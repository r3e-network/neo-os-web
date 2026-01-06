"use client";

import { useMemo } from "react";
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

// Fallback solid colors if Tailwind classes miss
const SOLID_COLORS = [
  "#FFDE59", // Yellow
  "#00E599", // Neo Green
  "#FF90E8", // Pink
  "#2C3E50", // Dark Blue
  "#00D4AA", // Teal
  "#EF4444", // Red
  "#9333EA", // Purple
  "#F97316", // Orange
];

function getUniqueColor(appId: string): string {
  let hash = 0;
  for (let i = 0; i < appId.length; i++) {
    const char = appId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return SOLID_COLORS[Math.abs(hash) % SOLID_COLORS.length];
}

export function DynamicBanner({ category, appId, appName, highlights }: DynamicBannerProps) {
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.utility;
  const bgColor = categoryStyle.bg;
  const IconComponent = getAppIcon(appId);

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

      {/* Live Data Highlights Overlay - Sticker Style */}
      {highlights && highlights.length > 0 && (
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
