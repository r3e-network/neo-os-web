"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildMiniAppLogoSources } from "@/lib/miniapp-media";

// Map app_id to professional Lucide icons
const APP_ICONS: Record<string, LucideIcon> = {
  // Gaming
  "miniapp-fogplay": Coins,
  "miniapp-dailycheckin": Award,
  "miniapp-last-survivor": Timer,
  "miniapp-gasbox": Sparkles,
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
  "miniapp-flamingo-swap": Repeat,
  "miniapp-flamingo-lend": HandCoins,
  "miniapp-flamingo-earn": Coins,
  "miniapp-flamingo-analytics": BarChart3,
  "miniapp-flamingo-action-center": ClipboardList,
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
  "miniapp-self-loan": Repeat,
  "miniapp-priceticker": LineChart,
  "miniapp-neo-pay": LineChart,

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
  "miniapp-predictionmarket": BarChart3,
  "miniapp-govbooster": Rocket,
  "miniapp-burnleague": Flame,
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
  data: BarChart3,
  other: Puzzle,
};

// Category gradient colors for logo background
const CATEGORY_GRADIENTS: Record<string, string> = {
  gaming: "from-purple-500 to-indigo-600",
  defi: "from-cyan-500 to-blue-600",
  social: "from-pink-500 to-rose-600",
  governance: "from-emerald-500 to-teal-600",
  utility: "from-gray-500 to-gray-600",
  nft: "from-teal-500 to-emerald-600",
  data: "from-cyan-500 to-sky-700",
  other: "from-gray-500 to-zinc-700",
};

interface MiniAppLogoProps {
  appId: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft" | "data" | "other";
  entryUrl?: string | null;
  logoUrl?: string | null;
  manifest?: Record<string, unknown> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MiniAppLogo({ appId, category, entryUrl, logoUrl, manifest, size = "md", className = "" }: MiniAppLogoProps) {
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

  const logoSources = useMemo(
    () =>
      buildMiniAppLogoSources({
        appID: appId,
        entryURL: entryUrl,
        logoURL: logoUrl,
        manifest: manifest || null,
      }),
    [appId, entryUrl, logoUrl, manifest],
  );

  const [logoIndex, setLogoIndex] = useState(0);

  useEffect(() => {
    setLogoIndex(0);
  }, [logoSources]);

  const logoSource = logoSources[logoIndex];
  if (logoSource) {
    return (
      <div className={`flex-shrink-0 ${sizeClasses[size]} rounded-xl overflow-hidden bg-gray-100 ${className}`}>
        <img
          src={logoSource}
          alt={appId}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => {
            setLogoIndex((prev) => (prev + 1 < logoSources.length ? prev + 1 : logoSources.length));
          }}
        />
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
