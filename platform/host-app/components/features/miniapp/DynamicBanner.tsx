"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import * as Animations from "./animations";

// Dynamic import for particles (client-side only)
const ParticleBanner = dynamic(() => import("./particles").then((mod) => mod.ParticleBanner), { ssr: false });

// Highlight data structure for live stats overlay
export interface HighlightData {
  label: string;
  value: string;
  icon?: string;
  trend?: "up" | "down" | "neutral";
}

// Custom Swap Animation for Neo Swap
function SwapAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Swap container */}
      <div className="relative w-32 h-32">
        {/* NEO token - moves right then left */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 animate-swap-left">
          <div className="w-14 h-14 rounded-full bg-[#00e599] flex items-center justify-center shadow-lg shadow-[#00e599]/50">
            <span className="text-white font-bold text-sm">NEO</span>
          </div>
        </div>

        {/* Swap arrows in center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="animate-spin-slow">
            <span className="text-3xl">🔄</span>
          </div>
        </div>

        {/* GAS token - moves left then right */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 animate-swap-right">
          <div className="w-14 h-14 rounded-full bg-[#58bf00] flex items-center justify-center shadow-lg shadow-[#58bf00]/50">
            <span className="text-white font-bold text-sm">GAS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// App ID to Animation Component mapping
const APP_ANIMATIONS: Record<string, React.ComponentType> = {
  // Gaming
  "miniapp-lottery": Animations.LotteryAnimation,
  "miniapp-coinflip": Animations.CoinFlipAnimation,
  "miniapp-dicegame": Animations.DiceAnimation,
  "miniapp-scratchcard": Animations.ScratchCardAnimation,
  "miniapp-secretpoker": Animations.PokerAnimation,
  "miniapp-neocrash": Animations.CrashAnimation,
  "miniapp-candlewars": Animations.CandleWarsAnimation,
  "miniapp-algobattle": Animations.AlgoBattleAnimation,
  "miniapp-fogchess": Animations.FogChessAnimation,
  "miniapp-fogpuzzle": Animations.FogPuzzleAnimation,
  "miniapp-cryptoriddle": Animations.CryptoRiddleAnimation,
  "miniapp-worldpiano": Animations.WorldPianoAnimation,
  "miniapp-millionpiecemap": Animations.MillionPieceMapAnimation,
  "miniapp-puzzlemining": Animations.PuzzleMiningAnimation,
  "miniapp-screamtoearn": Animations.ScreamToEarnAnimation,
  // DeFi
  "miniapp-neo-swap": SwapAnimation,
  "miniapp-flashloan": Animations.FlashLoanAnimation,
  "miniapp-aitrader": Animations.AITraderAnimation,
  "miniapp-gridbot": Animations.GridBotAnimation,
  "miniapp-bridgeguardian": Animations.BridgeGuardianAnimation,
  "miniapp-gascircle": Animations.GasCircleAnimation,
  "miniapp-ilguard": Animations.ILGuardAnimation,
  "miniapp-compoundcapsule": Animations.CompoundCapsuleAnimation,
  "miniapp-darkpool": Animations.DarkPoolAnimation,
  "miniapp-dutchauction": Animations.DutchAuctionAnimation,
  "miniapp-nolosslottery": Animations.NoLossLotteryAnimation,
  "miniapp-quantumswap": Animations.QuantumSwapAnimation,
  "miniapp-selfloan": Animations.SelfLoanAnimation,
  "miniapp-neoburger": Animations.NeoBurgerAnimation,
  "miniapp-priceticker": Animations.PriceTickerAnimation,
  // Social
  "miniapp-aisoulmate": Animations.AISoulmateAnimation,
  "miniapp-redenvelope": Animations.RedEnvelopeAnimation,
  "miniapp-darkradio": Animations.DarkRadioAnimation,
  "miniapp-devtipping": Animations.DevTippingAnimation,
  "miniapp-bountyhunter": Animations.BountyHunterAnimation,
  "miniapp-breakupcontract": Animations.BreakupContractAnimation,
  "miniapp-exfiles": Animations.ExFilesAnimation,
  "miniapp-geospotlight": Animations.GeoSpotlightAnimation,
  "miniapp-whisperchain": Animations.WhisperChainAnimation,
  "miniapp-paytoview": Animations.PayToViewAnimation,
  "miniapp-deadswitch": Animations.DeadSwitchAnimation,
  "miniapp-timecapsule": Animations.TimeCapsuleAnimation,
  // NFT
  "miniapp-canvas": Animations.CanvasAnimation,
  "miniapp-nftevolve": Animations.NFTEvolveAnimation,
  "miniapp-nftchimera": Animations.NFTChimeraAnimation,
  "miniapp-schrodingernft": Animations.SchrodingerNFTAnimation,
  "miniapp-meltingasset": Animations.MeltingAssetAnimation,
  "miniapp-onchaintarot": Animations.OnChainTarotAnimation,
  "miniapp-gardenofneo": Animations.GardenOfNeoAnimation,
  "miniapp-graveyard": Animations.GraveyardAnimation,
  "miniapp-parasite": Animations.ParasiteAnimation,
  // Governance
  "miniapp-secretvote": Animations.SecretVoteAnimation,
  "miniapp-govbooster": Animations.GovBoosterAnimation,
  "miniapp-predictionmarket": Animations.PredictionMarketAnimation,
  "miniapp-burnleague": Animations.BurnLeagueAnimation,
  "miniapp-doomsdayclock": Animations.DoomsdayClockAnimation,
  "miniapp-masqueradedao": Animations.MasqueradeDAOAnimation,
  "miniapp-govmerc": Animations.GovMercAnimation,
  // Utility
  "miniapp-candidate-vote": Animations.CandidateVoteAnimation,
  "miniapp-explorer": Animations.ExplorerAnimation,
  "miniapp-guardianpolicy": Animations.GuardianPolicyAnimation,
  "miniapp-unbreakablevault": Animations.UnbreakableVaultAnimation,
  "miniapp-zkbadge": Animations.ZKBadgeAnimation,
  "miniapp-heritagetrust": Animations.HeritageTrustAnimation,
};

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
  "miniapp-neo-swap": ["swap"], // Special swap animation
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
      {/* Professional Particle System Layer */}
      <ParticleBanner category={category} appId={appId} className="absolute inset-0 z-0" />

      {/* Animated floating elements */}
      <div className="absolute inset-0 z-10">
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

      {/* Center icon or custom animation */}
      {(() => {
        const AnimationComponent = APP_ANIMATIONS[appId];
        if (AnimationComponent) {
          return <AnimationComponent />;
        }
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl drop-shadow-2xl animate-bounce-slow">{icon}</span>
          </div>
        );
      })()}

      {/* Live Data Highlights Overlay - High Contrast */}
      {highlights && highlights.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {/* Primary highlight - Dark background for contrast */}
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
          {/* Secondary highlights - Bottom row */}
          {highlights.length > 1 && (
            <div className="flex gap-2 mt-2">
              {highlights.slice(1, 3).map((h, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 rounded-lg bg-gray-900/70 backdrop-blur-sm border border-gray-600/50"
                >
                  <span className="text-xs text-gray-300">
                    {h.icon} {h.label}:{" "}
                  </span>
                  <span className="text-xs font-bold text-cyan-300">{h.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
