"use client";

import {
  Ticket,
  Coins,
  Dice5,
  CreditCard,
  Spade,
  TrendingUp,
  CandlestickChart,
  Bot,
  Castle,
  Puzzle,
  HelpCircle,
  Piano,
  Map,
  Pickaxe,
  Mic,
  Zap,
  Brain,
  Grid3X3,
  Shield,
  CircleDot,
  ShieldCheck,
  Pill,
  Moon,
  Gavel,
  Target,
  Repeat,
  Heart,
  Gift,
  Radio,
  HandCoins,
  Crosshair,
  HeartCrack,
  FolderHeart,
  MapPin,
  MessageCircle,
  Palette,
  Sparkles,
  Dna,
  Cat,
  Snowflake,
  Eye,
  Clock,
  ScrollText,
  Flower2,
  Skull,
  Bug,
  Vote,
  Rocket,
  BarChart3,
  Flame,
  Timer,
  Drama,
  Swords,
  LineChart,
  ClipboardList,
  Lock,
  Award,
  type LucideIcon,
} from "lucide-react";

// Map app_id to professional Lucide icons
const APP_ICONS: Record<string, LucideIcon> = {
  // Gaming
  "miniapp-lottery": Ticket,
  "miniapp-coinflip": Coins,
  "miniapp-dicegame": Dice5,
  "miniapp-scratchcard": CreditCard,
  "miniapp-secretpoker": Spade,
  "miniapp-neocrash": TrendingUp,
  "miniapp-fogpuzzle": Puzzle,
  "miniapp-cryptoriddle": HelpCircle,
  "miniapp-millionpiecemap": Map,
  "miniapp-puzzlemining": Pickaxe,
  "miniapp-megamillions": Ticket,
  "miniapp-throneofgas": Castle,

  // DeFi
  "miniapp-flashloan": Zap,
  "miniapp-gascircle": CircleDot,
  "miniapp-compoundcapsule": Pill,
  "miniapp-selfloan": Repeat,

  // Social
  "miniapp-redenvelope": Gift,
  "miniapp-devtipping": HandCoins,
  "miniapp-breakupcontract": HeartCrack,
  "miniapp-exfiles": FolderHeart,

  // NFT
  "miniapp-canvas": Palette,
  "miniapp-onchaintarot": Eye,
  "miniapp-timecapsule": Clock,
  "miniapp-heritagetrust": ScrollText,
  "miniapp-gardenofneo": Flower2,
  "miniapp-graveyard": Skull,

  // Governance
  "miniapp-govbooster": Rocket,
  "miniapp-burnleague": Flame,
  "miniapp-doomsdayclock": Timer,
  "miniapp-masqueradedao": Drama,
  "miniapp-govmerc": Swords,

  // Utility
  "miniapp-guardianpolicy": ClipboardList,
  "miniapp-unbreakablevault": Lock,
};

// Category fallback icons
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  gaming: Dice5,
  defi: TrendingUp,
  social: Heart,
  nft: Palette,
  governance: Vote,
  utility: ClipboardList,
};

// Category gradient colors for logo background
const CATEGORY_GRADIENTS: Record<string, string> = {
  gaming: "from-purple-500 to-indigo-600",
  defi: "from-cyan-500 to-blue-600",
  social: "from-pink-500 to-rose-600",
  governance: "from-emerald-500 to-teal-600",
  utility: "from-slate-500 to-gray-600",
  nft: "from-teal-500 to-emerald-600",
};

interface MiniAppLogoProps {
  appId: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  size?: "sm" | "md" | "lg";
  className?: string;
  iconUrl?: string;
}

export function MiniAppLogo({ appId, category, size = "md", className = "", iconUrl }: MiniAppLogoProps) {
  const Icon = APP_ICONS[appId] || CATEGORY_ICONS[category] || Puzzle;
  const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.utility;

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  if (iconUrl) {
    // If it's a relative path from manifest (starts with /static), resolve it relative to the app base
    // However, the caller usually passes the full valid public URL.
    // If we assume the host app handles the path logic, we just use it.
    // NOTE: If the manifest says "/static/icon.png", the actual URL in the host app
    // depends on where the miniapp is served. Usually /miniapps/<app-id>/static/icon.png

    // Check if we need to fix the path or if it's already fully resolved
    // For now, assume the caller passes a usable path, or we might need to handle it.
    // But since MiniAppCard receives `app.icon`, we'll check that next.

    return (
      <div
        className={`flex-shrink-0 ${sizeClasses[size]} rounded-xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800 ${className}`}
      >
        <img
          src={iconUrl}
          alt={appId}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to default if image load fails
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add(
              "bg-gradient-to-br",
              gradient.split(" ")[0],
              gradient.split(" ")[1],
            );
          }}
        />
        {/* Fallback hidden by default, visible if img fails and we toggle classes? 
            actually simpler: just return the Lucide icon if we want a robust fallback, 
            but for now let's trust the customized iconUrl
        */}
      </div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 ${sizeClasses[size]} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${className}`}
    >
      <Icon size={iconSizes[size]} className="text-white" strokeWidth={2} />
    </div>
  );
}
