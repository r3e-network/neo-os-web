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
  gaming: "bg-gradient-to-br from-erobo-peach/90 to-erobo-pink/80 text-erobo-ink",
  defi: "bg-gradient-to-br from-erobo-mint/90 to-neo/80 text-erobo-ink",
  social: "bg-gradient-to-br from-erobo-pink/85 to-erobo-purple/80 text-white",
  governance: "bg-gradient-to-br from-erobo-sky/90 to-erobo-purple/80 text-erobo-ink",
  utility: "bg-gradient-to-br from-erobo-sky/80 to-erobo-mint/80 text-erobo-ink",
  nft: "bg-gradient-to-br from-erobo-purple/80 to-erobo-pink/80 text-white",
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
  const containerClasses = `flex-shrink-0 ${sizeClasses[size]} rounded-full border border-white/60 dark:border-erobo-purple/20 shadow-[0_0_18px_rgba(159,157,243,0.18)] flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(159,157,243,0.35)] ${className}`;

  if (iconUrl && !imageError) {
    // SVG icons have circular content in square viewBox.
    // Use clip-path: circle() to ensure perfect circular clipping without visible margins
    return (
      <div
        className={`flex-shrink-0 ${sizeClasses[size]} rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110 ${className}`}
        style={{
          boxShadow: "0 0 18px rgba(159, 157, 243, 0.18)",
          clipPath: "circle(50%)",
        }}
      >
        <img
          src={iconUrl}
          alt={appId}
          className="w-full h-full object-cover"
          style={{
            display: "block",
            borderRadius: "50%",
          }}
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${containerClasses} bg-gradient-to-br ${bgColor}`}>
      <Icon size={iconSizes[size]} className="text-current drop-shadow-sm" strokeWidth={2.5} />
    </div>
  );
}
