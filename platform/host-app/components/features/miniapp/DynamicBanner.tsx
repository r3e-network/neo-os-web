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

// Category-based font styles using Google Fonts
const CATEGORY_FONTS: Record<string, { className: string; style: React.CSSProperties }> = {
  gaming: {
    className: "font-black uppercase tracking-wider",
    style: {
      fontFamily: "'Orbitron', sans-serif",
      background: "linear-gradient(135deg, #ffd700 0%, #ff6b6b 50%, #ffd700 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    },
  },
  defi: {
    className: "font-bold tracking-tight",
    style: {
      fontFamily: "'Space Grotesk', sans-serif",
      background: "linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    },
  },
  social: {
    className: "font-semibold tracking-normal",
    style: {
      fontFamily: "'Poppins', sans-serif",
      background: "linear-gradient(135deg, #ff6b9d 0%, #ffc3a0 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    },
  },
  governance: {
    className: "font-bold tracking-wide",
    style: {
      fontFamily: "'Playfair Display', serif",
      background: "linear-gradient(135deg, #ffd700 0%, #ffffff 50%, #ffd700 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    },
  },
  utility: {
    className: "font-semibold tracking-normal",
    style: {
      fontFamily: "'Space Grotesk', sans-serif",
      background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    },
  },
  nft: {
    className: "font-bold tracking-tight",
    style: {
      fontFamily: "'Righteous', cursive",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    },
  },
};

// Gradient backgrounds
const UNIQUE_GRADIENTS = [
  "from-purple-500 via-violet-600 to-purple-800",
  "from-violet-600 via-purple-500 to-indigo-700",
  "from-blue-500 via-indigo-600 to-blue-800",
  "from-sky-500 via-blue-600 to-indigo-700",
  "from-cyan-500 via-blue-500 to-blue-800",
  "from-teal-500 via-cyan-600 to-teal-800",
  "from-emerald-500 via-green-600 to-teal-700",
  "from-pink-500 via-rose-600 to-pink-800",
  "from-rose-500 via-pink-600 to-fuchsia-700",
  "from-amber-500 via-yellow-600 to-amber-700",
  "from-purple-600 via-pink-500 to-red-600",
  "from-blue-600 via-purple-500 to-pink-600",
  "from-cyan-500 via-blue-600 to-purple-700",
  "from-emerald-500 via-cyan-600 to-blue-700",
  "from-indigo-600 via-violet-500 to-purple-700",
];

function getUniqueGradient(appId: string): string {
  let hash = 0;
  for (let i = 0; i < appId.length; i++) {
    const char = appId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return UNIQUE_GRADIENTS[Math.abs(hash) % UNIQUE_GRADIENTS.length];
}

export function DynamicBanner({ category, appId, appName, highlights }: DynamicBannerProps) {
  const gradient = useMemo(() => getUniqueGradient(appId), [appId]);
  const fontStyle = CATEGORY_FONTS[category] || CATEGORY_FONTS.utility;
  const IconComponent = getAppIcon(appId);

  return (
    <div className="relative h-full overflow-hidden">
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* App Name with Icons - Centered */}
      {appName && (
        <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
          <div className="flex items-center gap-3">
            {/* Left Icon */}
            <IconComponent className="w-10 h-10 text-white/90 drop-shadow-lg" />

            {/* App Name with Category Font */}
            <h2 className={`text-2xl sm:text-3xl text-center ${fontStyle.className}`} style={fontStyle.style}>
              {appName}
            </h2>

            {/* Right Icon */}
            <IconComponent className="w-10 h-10 text-white/90 drop-shadow-lg" />
          </div>
        </div>
      )}

      {/* Live Data Highlights Overlay */}
      {highlights && highlights.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="text-center px-4 py-2 rounded-xl bg-gray-900/80 backdrop-blur-md border border-gray-700/50 shadow-2xl">
            <div className="text-2xl font-black text-yellow-300 tracking-tight">{highlights[0].value}</div>
            <div className="text-xs font-semibold text-gray-200 flex items-center justify-center gap-1 mt-0.5">
              {highlights[0].icon && <span>{highlights[0].icon}</span>}
              <span>{highlights[0].label}</span>
              {highlights[0].trend && (
                <span
                  className={
                    highlights[0].trend === "up"
                      ? "text-green-400 font-bold"
                      : highlights[0].trend === "down"
                        ? "text-red-400 font-bold"
                        : ""
                  }
                >
                  {highlights[0].trend === "up" ? " ↑" : highlights[0].trend === "down" ? " ↓" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
