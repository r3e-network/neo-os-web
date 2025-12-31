"use client";

import { useMemo } from "react";

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
  highlights?: HighlightData[];
}

// App-specific floating elements based on functionality
const APP_ELEMENTS: Record<string, string[]> = {
  // Gaming
  "miniapp-lottery": ["🎰", "🎫", "💰", "🍀", "7️⃣", "💎"],
  "builtin-lottery": ["🎰", "🎫", "💰", "🍀", "7️⃣", "💎"],
  "miniapp-coinflip": ["🪙", "⬆️", "⬇️", "💫", "✨", "🎯"],
  "miniapp-dicegame": ["🎲", "🎲", "⚀", "⚁", "⚂", "🎯"],
  "miniapp-scratchcard": ["🎫", "💵", "✨", "🎁", "💰", "🌟"],
  "miniapp-secretpoker": ["🃏", "♠️", "♥️", "♦️", "♣️", "🎴"],
  "miniapp-neocrash": ["📈", "🚀", "💥", "📊", "⬆️", "💹"],
  "miniapp-candlewars": ["🕯️", "📈", "📉", "🔥", "💹", "📊"],
  "miniapp-algobattle": ["🤖", "⚔️", "📊", "🧠", "💻", "🏆"],
  "miniapp-fogchess": ["♟️", "♜", "♞", "♝", "🌫️", "👑"],
  "miniapp-fogpuzzle": ["🧩", "🌫️", "🔍", "💡", "🎯", "✨"],
  "miniapp-cryptoriddle": ["❓", "🔐", "💡", "🧠", "🎁", "🔑"],
  "miniapp-worldpiano": ["🎹", "🎵", "🎶", "🎼", "🌍", "🎤"],
  "miniapp-millionpiecemap": ["🗺️", "🎨", "🖼️", "✏️", "🌈", "📍"],
  "miniapp-puzzlemining": ["⛏️", "🧩", "💎", "⚒️", "🪨", "✨"],
  "miniapp-screamtoearn": ["🗣️", "📢", "🔊", "💰", "🎤", "📣"],
  "miniapp-megamillions": ["💰", "🎰", "💎", "🏆", "💵", "🌟"],
  "miniapp-throneofgas": ["👑", "⛽", "🏰", "⚔️", "🛡️", "💎"],
  "miniapp-burnleague": ["🔥", "🏆", "📊", "💀", "⚡", "🎖️"],

  // DeFi
  "miniapp-flashloan": ["⚡", "💰", "🔄", "💵", "⏱️", "🏦"],
  "miniapp-aitrader": ["🤖", "📈", "💹", "🧠", "📊", "💰"],
  "miniapp-gridbot": ["📊", "🤖", "📈", "📉", "💹", "⚙️"],
  "miniapp-bridgeguardian": ["🌉", "🛡️", "🔗", "⛓️", "🌐", "🔒"],
  "miniapp-gascircle": ["⭕", "⛽", "💰", "🔄", "👥", "💵"],
  "miniapp-ilguard": ["🛡️", "📉", "💧", "🔒", "⚖️", "💰"],
  "miniapp-compoundcapsule": ["💊", "📈", "🔄", "💰", "⏰", "💹"],
  "miniapp-darkpool": ["🌑", "🔒", "💰", "🌊", "🤫", "💵"],
  "miniapp-dutchauction": ["🔨", "📉", "⏰", "💰", "🏷️", "⬇️"],
  "miniapp-nolosslottery": ["🎯", "💰", "🔄", "🎰", "📈", "🍀"],
  "miniapp-quantumswap": ["⚛️", "🔄", "💫", "🔒", "⚡", "💱"],
  "miniapp-selfloan": ["🏦", "💰", "🔄", "📝", "🔐", "💵"],
  "miniapp-priceticker": ["📊", "💹", "📈", "📉", "⏰", "💰"],
  "builtin-prediction-market": ["🔮", "📊", "💰", "📈", "🎯", "🤔"],

  // Social
  "miniapp-redenvelope": ["🧧", "💰", "🎁", "✨", "🎊", "💵"],
  "miniapp-secretvote": ["🗳️", "🔒", "✅", "❌", "🤫", "📊"],
  "builtin-secret-vote": ["🗳️", "🔒", "✅", "❌", "🤫", "📊"],
  "miniapp-devtipping": ["💸", "👨‍💻", "❤️", "🙏", "💰", "⭐"],
  "miniapp-aisoulmate": ["💕", "🤖", "💬", "❤️", "🧠", "✨"],
  "miniapp-darkradio": ["📻", "🌑", "🎵", "🔊", "🎶", "🤫"],
  "miniapp-deadswitch": ["💀", "⏰", "🔐", "📨", "⚠️", "🔑"],
  "miniapp-doomsdayclock": ["⏰", "💀", "🌍", "⚠️", "🔔", "☢️"],
  "miniapp-heritagetrust": ["🏛️", "📜", "💰", "👨‍👩‍👧", "🔐", "⏳"],
  "miniapp-timecapsule": ["⏳", "📦", "🔐", "📝", "🎁", "⏰"],
  "miniapp-paytovew": ["👁️", "💰", "🔐", "📄", "🎬", "💵"],

  // NFT
  "miniapp-nftevolve": ["🎨", "🔄", "✨", "🖼️", "⬆️", "💎"],
  "miniapp-canvas": ["🎨", "🖌️", "🖼️", "🌈", "✏️", "👨‍🎨"],
  "miniapp-schrodingernft": ["🐱", "📦", "❓", "✨", "🔮", "💫"],
  "miniapp-gardenofneo": ["🌱", "🌸", "🌳", "💧", "☀️", "🦋"],
  "miniapp-graveyard": ["⚰️", "💀", "🪦", "👻", "🌙", "🕯️"],
  "miniapp-parasite": ["🦠", "🔗", "💎", "🧬", "✨", "🔄"],

  // Governance
  "miniapp-govbooster": ["🗳️", "📈", "💪", "🏛️", "⚡", "🎯"],
  "miniapp-guardianpolicy": ["🛡️", "📜", "🔐", "⚖️", "🏛️", "✅"],
  "miniapp-govmerc": ["🏛️", "💰", "🤝", "📊", "⚖️", "🎖️"],
  "miniapp-predictionmarket": ["🔮", "📊", "💰", "📈", "🎯", "🤔"],

  // Utility
  "miniapp-zkbadge": ["🏅", "🔐", "✅", "🛡️", "✨", "🎖️"],
  "miniapp-serviceconsumer": ["⚙️", "🔌", "📡", "🔗", "💻", "🛠️"],
};

// Category fallback elements
const CATEGORY_ELEMENTS: Record<string, string[]> = {
  gaming: ["🎮", "🎲", "🏆", "⭐", "💎", "🎯", "🪙", "🎰"],
  defi: ["💰", "📈", "💹", "🔄", "⚡", "🏦", "💵", "📊"],
  social: ["💬", "❤️", "👥", "🔗", "🎁", "✨", "🤝", "💕"],
  governance: ["🗳️", "⚖️", "🏛️", "📜", "🛡️", "✅", "📊", "🎯"],
  utility: ["⚙️", "🔧", "🛠️", "📊", "🔌", "💻", "🔗", "⚡"],
  nft: ["🎨", "🖼️", "✨", "💎", "🌈", "🖌️", "🔮", "⭐"],
};

// Category gradient colors (Neo Green palette - avoiding Claude orange)
const CATEGORY_GRADIENTS: Record<string, string> = {
  gaming: "from-purple-600 via-indigo-600 to-purple-800",
  defi: "from-blue-600 via-cyan-600 to-blue-800",
  social: "from-pink-500 via-rose-500 to-pink-700",
  governance: "from-emerald-600 via-teal-500 to-emerald-700",
  utility: "from-slate-500 via-gray-500 to-slate-700",
  nft: "from-emerald-500 via-teal-500 to-emerald-700",
};

// Unique gradient palette - 60+ distinct gradients for unique card backgrounds
const UNIQUE_GRADIENTS = [
  // Purple/Violet family
  "from-purple-500 via-violet-600 to-purple-800",
  "from-violet-600 via-purple-500 to-indigo-700",
  "from-fuchsia-500 via-purple-600 to-violet-800",
  "from-purple-700 via-fuchsia-500 to-pink-600",
  // Blue family
  "from-blue-500 via-indigo-600 to-blue-800",
  "from-sky-500 via-blue-600 to-indigo-700",
  "from-cyan-500 via-blue-500 to-blue-800",
  "from-indigo-500 via-blue-600 to-sky-700",
  "from-blue-600 via-sky-500 to-cyan-600",
  // Teal/Cyan family
  "from-teal-500 via-cyan-600 to-teal-800",
  "from-cyan-600 via-teal-500 to-emerald-700",
  "from-teal-600 via-emerald-500 to-cyan-700",
  // Green family
  "from-emerald-500 via-green-600 to-teal-700",
  "from-green-500 via-emerald-600 to-green-800",
  "from-lime-500 via-green-600 to-emerald-700",
  // Pink/Rose family
  "from-pink-500 via-rose-600 to-pink-800",
  "from-rose-500 via-pink-600 to-fuchsia-700",
  "from-fuchsia-600 via-pink-500 to-rose-700",
  // Red/Orange family (avoiding Claude orange)
  "from-red-500 via-rose-600 to-red-800",
  "from-rose-600 via-red-500 to-pink-700",
  // Amber/Yellow family
  "from-amber-500 via-yellow-600 to-amber-700",
  "from-yellow-500 via-amber-600 to-orange-600",
  // Slate/Gray family
  "from-slate-500 via-gray-600 to-slate-800",
  "from-gray-500 via-slate-600 to-zinc-700",
  "from-zinc-500 via-gray-600 to-slate-700",
  // Mixed gradients
  "from-purple-600 via-pink-500 to-red-600",
  "from-blue-600 via-purple-500 to-pink-600",
  "from-cyan-500 via-blue-600 to-purple-700",
  "from-emerald-500 via-cyan-600 to-blue-700",
  "from-teal-500 via-green-600 to-lime-600",
  "from-pink-600 via-purple-500 to-indigo-700",
  "from-rose-500 via-fuchsia-600 to-purple-700",
  "from-indigo-600 via-violet-500 to-purple-700",
  "from-sky-600 via-cyan-500 to-teal-700",
  "from-green-600 via-teal-500 to-cyan-700",
  "from-amber-600 via-yellow-500 to-lime-600",
  "from-red-600 via-pink-500 to-fuchsia-700",
  "from-violet-500 via-indigo-600 to-blue-700",
  "from-fuchsia-500 via-rose-600 to-red-700",
  "from-lime-600 via-emerald-500 to-teal-700",
  // More unique combinations
  "from-purple-500 via-blue-600 to-cyan-700",
  "from-pink-600 via-red-500 to-amber-600",
  "from-indigo-500 via-purple-600 to-fuchsia-700",
  "from-teal-600 via-blue-500 to-indigo-700",
  "from-emerald-600 via-lime-500 to-yellow-600",
  "from-rose-600 via-purple-500 to-violet-700",
  "from-cyan-600 via-sky-500 to-blue-700",
  "from-violet-600 via-fuchsia-500 to-pink-700",
  "from-blue-500 via-teal-600 to-emerald-700",
  "from-purple-600 via-rose-500 to-pink-700",
  "from-sky-500 via-indigo-600 to-violet-700",
  "from-green-500 via-cyan-600 to-blue-700",
  "from-fuchsia-600 via-violet-500 to-indigo-700",
  "from-amber-500 via-red-600 to-rose-700",
  "from-teal-500 via-emerald-600 to-green-700",
  "from-pink-500 via-fuchsia-600 to-violet-700",
  "from-indigo-600 via-sky-500 to-cyan-700",
  "from-red-500 via-amber-600 to-yellow-600",
  "from-violet-500 via-blue-600 to-sky-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
];

// Get unique gradient based on appId hash
function getUniqueGradient(appId: string): string {
  let hash = 0;
  for (let i = 0; i < appId.length; i++) {
    const char = appId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % UNIQUE_GRADIENTS.length;
  return UNIQUE_GRADIENTS[index];
}

// Category glow colors (Neo Green palette - avoiding Claude orange)
const CATEGORY_GLOWS: Record<string, string> = {
  gaming: "bg-purple-400/30",
  defi: "bg-cyan-400/30",
  social: "bg-rose-400/30",
  governance: "bg-emerald-400/30",
  utility: "bg-slate-400/30",
  nft: "bg-teal-400/30",
};

// Seeded random number generator for consistent randomness per appId
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return function () {
    hash = Math.sin(hash) * 10000;
    return hash - Math.floor(hash);
  };
}

// Animation classes with different speeds
const FLOAT_ANIMATIONS = ["animate-float-slow", "animate-float-medium", "animate-float-fast"];

const SIZES = ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"];

export function DynamicBanner({ category, icon, appId, highlights }: DynamicBannerProps) {
  const { elements, positions, gradient, glow } = useMemo(() => {
    const random = seededRandom(appId);

    // Get app-specific elements or fall back to category
    const appElements = APP_ELEMENTS[appId] || CATEGORY_ELEMENTS[category] || CATEGORY_ELEMENTS.gaming;

    // Select 5-7 random elements
    const numElements = 5 + Math.floor(random() * 3);
    const selectedElements: string[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < numElements && i < appElements.length; i++) {
      let idx = Math.floor(random() * appElements.length);
      while (usedIndices.has(idx) && usedIndices.size < appElements.length) {
        idx = (idx + 1) % appElements.length;
      }
      usedIndices.add(idx);
      selectedElements.push(appElements[idx]);
    }

    // Generate random positions for each element
    const positions = selectedElements.map(() => ({
      top: 5 + random() * 75,
      left: 5 + random() * 85,
      animation: FLOAT_ANIMATIONS[Math.floor(random() * FLOAT_ANIMATIONS.length)],
      size: SIZES[Math.floor(random() * SIZES.length)],
      delay: Math.floor(random() * 3),
      opacity: 0.7 + random() * 0.3,
    }));

    return {
      elements: selectedElements,
      positions,
      gradient: getUniqueGradient(appId),
      glow: CATEGORY_GLOWS[category] || CATEGORY_GLOWS.gaming,
    };
  }, [appId, category]);

  // Generate glow orb positions
  const glowPositions = useMemo(() => {
    const random = seededRandom(appId + "-glow");
    return [
      { top: -20 + random() * 10, right: -10 + random() * 20, size: 28 + random() * 16 },
      { bottom: -15 + random() * 10, left: -5 + random() * 20, size: 20 + random() * 12 },
    ];
  }, [appId]);

  return (
    <div className={`relative h-full bg-gradient-to-br ${gradient} overflow-hidden`}>
      {/* Animated floating elements */}
      <div className="absolute inset-0">
        {elements.map((emoji, idx) => (
          <span
            key={idx}
            className={`absolute ${positions[idx].size} ${positions[idx].animation}`}
            style={{
              top: `${positions[idx].top}%`,
              left: `${positions[idx].left}%`,
              animationDelay: `${positions[idx].delay}s`,
              opacity: positions[idx].opacity,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* Glowing orbs */}
      <div
        className={`absolute rounded-full blur-3xl animate-pulse ${glow}`}
        style={{
          top: `${glowPositions[0].top}%`,
          right: `${glowPositions[0].right}%`,
          width: `${glowPositions[0].size}%`,
          height: `${glowPositions[0].size}%`,
        }}
      />
      <div
        className={`absolute rounded-full blur-2xl animate-pulse ${glow}`}
        style={{
          bottom: `${glowPositions[1].bottom}%`,
          left: `${glowPositions[1].left}%`,
          width: `${glowPositions[1].size}%`,
          height: `${glowPositions[1].size}%`,
          animationDelay: "1s",
        }}
      />

      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl drop-shadow-2xl animate-bounce-slow">{icon}</span>
      </div>

      {/* Live Data Highlights Overlay - Large & Beautiful */}
      {highlights && highlights.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {/* Primary highlight - Large centered */}
          <div className="text-center mb-2">
            <div className="text-3xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] tracking-tight">
              {highlights[0].value}
            </div>
            <div className="text-sm font-semibold text-white/90 drop-shadow-md flex items-center justify-center gap-1">
              {highlights[0].icon && <span>{highlights[0].icon}</span>}
              <span>{highlights[0].label}</span>
              {highlights[0].trend && (
                <span
                  className={
                    highlights[0].trend === "up"
                      ? "text-emerald-300"
                      : highlights[0].trend === "down"
                        ? "text-red-300"
                        : ""
                  }
                >
                  {highlights[0].trend === "up" ? "↑" : highlights[0].trend === "down" ? "↓" : ""}
                </span>
              )}
            </div>
          </div>
          {/* Secondary highlights - Bottom row */}
          {highlights.length > 1 && (
            <div className="flex gap-3 mt-1">
              {highlights.slice(1, 3).map((h, idx) => (
                <div key={idx} className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/20">
                  <span className="text-xs text-white/80">
                    {h.icon} {h.label}:{" "}
                  </span>
                  <span className="text-sm font-bold text-white">{h.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
