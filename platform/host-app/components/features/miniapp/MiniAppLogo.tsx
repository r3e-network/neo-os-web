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
  Landmark,
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
  CalendarCheck,
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
  "miniapp-neo-crash": TrendingUp,
  "miniapp-fogpuzzle": Puzzle,
  "miniapp-cryptoriddle": HelpCircle,
  "miniapp-millionpiecemap": Map,
  "miniapp-puzzlemining": Pickaxe,
  "miniapp-megamillions": Ticket,
  "miniapp-throneofgas": Castle,

  // DeFi
  "miniapp-flashloan": Zap,
  "miniapp-gascircle": CircleDot,
  "miniapp-compound-capsule": Pill,
  "miniapp-self-loan": Repeat,
  "miniapp-neo-treasury": Landmark,

  // Social
  "miniapp-redenvelope": Gift,
  "miniapp-dev-tipping": HandCoins,
  "miniapp-breakupcontract": HeartCrack,
  "miniapp-exfiles": FolderHeart,

  // NFT
  "miniapp-canvas": Palette,
  "miniapp-onchaintarot": Eye,
  "miniapp-time-capsule": Clock,
  "miniapp-heritage-trust": ScrollText,
  "miniapp-garden-of-neo": Flower2,
  "miniapp-graveyard": Skull,

  // Governance
  "miniapp-govbooster": Rocket,
  "miniapp-burn-league": Flame,
  "miniapp-doomsday-clock": Timer,
  "miniapp-masqueradedao": Drama,
  "miniapp-gov-merc": Swords,

  // Utility
  "miniapp-guardianpolicy": ClipboardList,
  "miniapp-unbreakablevault": Lock,
  "miniapp-dailycheckin": CalendarCheck,
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

// Category solid colors for logo background
const CATEGORY_COLORS: Record<string, string> = {
  gaming: "bg-brutal-yellow text-black",
  defi: "bg-neo text-black",
  social: "bg-brutal-pink text-black",
  governance: "bg-brutal-blue text-white",
  utility: "bg-electric-purple text-white",
  nft: "bg-brutal-lime text-black",
};

interface MiniAppLogoProps {
  appId: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  size?: "sm" | "md" | "lg";
  className?: string;
  iconUrl?: string;
}

import { useState } from "react";

export function MiniAppLogo({ appId, category, size = "md", className = "", iconUrl }: MiniAppLogoProps) {
  const [imageError, setImageError] = useState(false);
  const Icon = APP_ICONS[appId] || CATEGORY_ICONS[category] || Puzzle;
  const bgColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.utility;

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-11 h-11",
    lg: "w-14 h-14",
  };

  const iconSizes = {
    sm: 18,
    md: 24,
    lg: 32,
  };

  // E-Robo style: Use rounded-full for circular icons with gradient background
  const containerClasses = `flex-shrink-0 ${sizeClasses[size]} rounded-full border-2 border-erobo-purple/30 dark:border-erobo-purple/20 shadow-[0_0_15px_rgba(159,157,243,0.2)] flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(159,157,243,0.4)] ${className}`;

  if (iconUrl && !imageError) {
    return (
      <div
        className={`${containerClasses} bg-gradient-to-br from-erobo-purple/10 to-erobo-purple-dark/10 dark:from-erobo-purple/20 dark:to-erobo-purple-dark/20`}
      >
        <img src={iconUrl} alt={appId} className="w-[70%] h-[70%] object-contain" onError={() => setImageError(true)} />
      </div>
    );
  }

  return (
    <div className={`${containerClasses} bg-gradient-to-br ${bgColor}`}>
      <Icon size={iconSizes[size]} className="text-current drop-shadow-sm" strokeWidth={2.5} />
    </div>
  );
}
