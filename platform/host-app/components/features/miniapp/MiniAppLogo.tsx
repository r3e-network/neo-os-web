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
  "miniapp-candlewars": CandlestickChart,
  "miniapp-algobattle": Bot,
  "miniapp-fogchess": Castle,
  "miniapp-fogpuzzle": Puzzle,
  "miniapp-cryptoriddle": HelpCircle,
  "miniapp-worldpiano": Piano,
  "miniapp-millionpiecemap": Map,
  "miniapp-puzzlemining": Pickaxe,
  "miniapp-screamtoearn": Mic,
  "miniapp-megamillions": Ticket,
  "miniapp-throneofgas": Castle,

  // DeFi
  "miniapp-flashloan": Zap,
  "miniapp-aitrader": Brain,
  "miniapp-gridbot": Grid3X3,
  "miniapp-bridgeguardian": Shield,
  "miniapp-gascircle": CircleDot,
  "miniapp-ilguard": ShieldCheck,
  "miniapp-compoundcapsule": Pill,
  "miniapp-darkpool": Moon,
  "miniapp-dutchauction": Gavel,
  "miniapp-nolosslottery": Target,
  "miniapp-quantumswap": Repeat,
  "miniapp-selfloan": Repeat,
  "miniapp-priceticker": LineChart,

  // Social
  "miniapp-aisoulmate": Heart,
  "miniapp-redenvelope": Gift,
  "miniapp-darkradio": Radio,
  "miniapp-devtipping": HandCoins,
  "miniapp-bountyhunter": Crosshair,
  "miniapp-breakupcontract": HeartCrack,
  "miniapp-exfiles": FolderHeart,
  "miniapp-geospotlight": MapPin,
  "miniapp-whisperchain": MessageCircle,

  // NFT
  "miniapp-canvas": Palette,
  "miniapp-nftevolve": Sparkles,
  "miniapp-nftchimera": Dna,
  "miniapp-schrodingernft": Cat,
  "miniapp-meltingasset": Snowflake,
  "miniapp-onchaintarot": Eye,
  "miniapp-timecapsule": Clock,
  "miniapp-heritagetrust": ScrollText,
  "miniapp-gardenofneo": Flower2,
  "miniapp-graveyard": Skull,
  "miniapp-parasite": Bug,
  "miniapp-paytoview": Eye,
  "miniapp-deadswitch": Skull,

  // Governance
  "miniapp-secretvote": Vote,
  "miniapp-govbooster": Rocket,
  "miniapp-predictionmarket": BarChart3,
  "miniapp-burnleague": Flame,
  "miniapp-doomsdayclock": Timer,
  "miniapp-masqueradedao": Drama,
  "miniapp-govmerc": Swords,

  // Utility
  "miniapp-guardianpolicy": ClipboardList,
  "miniapp-unbreakablevault": Lock,
  "miniapp-zkbadge": Award,
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
}

export function MiniAppLogo({ appId, category, size = "md", className = "" }: MiniAppLogoProps) {
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

  return (
    <div
      className={`flex-shrink-0 ${sizeClasses[size]} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${className}`}
    >
      <Icon size={iconSizes[size]} className="text-white" strokeWidth={2} />
    </div>
  );
}
