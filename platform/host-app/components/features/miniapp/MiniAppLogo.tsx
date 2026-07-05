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
import {
  buildMiniAppLogoSources,
} from "@/lib/miniapp-media";

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
  "miniapp-profitanchor": TrendingUp,
  "miniapp-trustanchor": ShieldCheck,
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

const CATEGORY_ACCENTS: Record<string, { text: string; background: string }> = {
  gaming: { text: "text-cat-game", background: "bg-cat-game/10" },
  defi: { text: "text-cat-defi", background: "bg-cat-defi/10" },
  social: { text: "text-cat-social", background: "bg-cat-social/10" },
  governance: { text: "text-cat-governance", background: "bg-cat-governance/10" },
  utility: { text: "text-cat-tool", background: "bg-cat-tool/10" },
  nft: { text: "text-cat-nft", background: "bg-cat-nft/10" },
  data: { text: "text-info-600", background: "bg-info-50" },
  other: { text: "text-ink-muted", background: "bg-surface-secondary" },
};

interface MiniAppLogoProps {
  appId: string;
  category:
    | "gaming"
    | "defi"
    | "social"
    | "governance"
    | "utility"
    | "nft"
    | "data"
    | "other";
  entryUrl?: string | null;
  logoUrl?: string | null;
  manifest?: Record<string, unknown> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

export function MiniAppLogo({
  appId,
  category,
  entryUrl,
  logoUrl,
  manifest,
  size = "md",
  className = "",
  alt,
}: MiniAppLogoProps) {
  const Icon = APP_ICONS[appId] || CATEGORY_ICONS[category] || Puzzle;
  const accent = CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.utility;

  const sizeClasses = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-xl",
  };

  const iconSizes = {
    sm: 14,
    md: 17,
    lg: 20,
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
      <div
        className={`relative flex-shrink-0 ${sizeClasses[size]} overflow-hidden border border-border bg-surface shadow-sm ${className}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            size={iconSizes[size]}
            className={accent.text}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
        <img
          src={logoSource}
          alt={alt || appId}
          className="absolute inset-0 h-full w-full object-contain p-0.5"
          loading="lazy"
          decoding="async"
          onError={() => {
            setLogoIndex((prev) =>
              prev + 1 < logoSources.length ? prev + 1 : logoSources.length,
            );
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center border border-border shadow-sm ${sizeClasses[size]} ${accent.background} ${accent.text} ${className}`}
    >
      <Icon size={iconSizes[size]} strokeWidth={1.8} aria-hidden="true" />
    </div>
  );
}
