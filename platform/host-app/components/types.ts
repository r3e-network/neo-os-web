// MiniApp Platform Types

import type { HighlightData } from "./features/miniapp/DynamicBanner";
import type { AnyCardData } from "@/types/card-display";
import type { ChainId } from "@/lib/chains/types";

export type MiniAppCategory = "gaming" | "defi" | "governance" | "utility" | "social" | "nft";

// ============================================================================
// Multi-Chain MiniApp Types
// ============================================================================

/**
 * Per-chain contract configuration for a MiniApp
 */
export type MiniAppChainContract = {
  /** Contract address/hash on this chain */
  address: string | null;
  /** Whether this chain deployment is active */
  active?: boolean;
  /** Chain-specific entry URL override */
  entryUrl?: string;
};

/**
 * Multi-chain contract mapping
 */
export type MiniAppChainContracts = Record<ChainId, MiniAppChainContract>;

export type MiniAppSource = "builtin" | "community" | "verified";

export type MiniAppInfo = {
  app_id: string;
  name: string;
  description: string;
  // Self-contained i18n: each MiniApp provides its own translations
  name_zh?: string;
  description_zh?: string;
  icon: string;
  category: MiniAppCategory;
  entry_url: string;

  // ========== Multi-Chain Support ==========
  /** Supported chain IDs - required for multi-chain apps */
  supportedChains: ChainId[];
  /** Per-chain contract configurations */
  chainContracts?: MiniAppChainContracts;

  // ========== Steam-style Featured Display ==========
  /** Banner image URL for featured carousel */
  banner?: string;
  /** Short tagline for featured display */
  tagline?: string;
  tagline_zh?: string;

  news_integration?: boolean | null;
  stats_display?: string[] | null;
  status?: "active" | "disabled" | "pending" | null;
  source?: MiniAppSource;
  stats?: { users?: number; transactions?: number; views?: number };
  highlights?: HighlightData[];
  cardData?: AnyCardData;
  developer?: {
    name: string;
    address: string;
    verified?: boolean;
  };
  permissions: {
    payments?: boolean;
    governance?: boolean;
    rng?: boolean;
    datafeed?: boolean;
    confidential?: boolean;
    automation?: boolean;
  };
  limits?: {
    max_gas_per_tx?: string;
    daily_gas_cap_per_user?: string;
    governance_cap?: string;
  } | null;
  features?: string[];
  created_at?: string;
};

export type MiniAppStats = {
  app_id: string;
  /** Chain ID for chain-specific stats, or undefined/null for aggregated stats */
  chain_id?: ChainId | null;
  total_transactions: number;
  total_users: number;
  total_gas_used: string;
  total_gas_earned?: string;
  daily_active_users: number;
  weekly_active_users: number;
  view_count: number;
  last_activity_at: string | null;
};

export type MiniAppNotification = {
  id: string;
  app_id: string;
  /** Chain ID where the notification originated */
  chain_id: ChainId;
  title: string;
  content: string;
  notification_type: string;
  source: string;
  tx_hash?: string;
  created_at: string;
};

export type WalletState = {
  connected: boolean;
  address: string;
  provider: "neoline" | "o3" | "onegate" | "auth0" | "metamask" | "walletconnect" | null;
  /** Active chain ID - null if app has no chain support or wallet not connected */
  chainId: ChainId | null;
  /** Balance on active chain */
  balance?: { native: string; tokens?: Record<string, string> };
};

// =============================================================================
// Community System Types
// =============================================================================

export type SocialComment = {
  id: string;
  app_id: string;
  author_user_id: string;
  parent_id: string | null;
  content: string;
  is_developer_reply: boolean;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
};

export type SocialRating = {
  app_id: string;
  avg_rating: number;
  weighted_score: number;
  total_ratings: number;
  distribution: Record<string, number>;
  user_rating?: {
    rating_value: number;
    review_text: string | null;
  };
};

export type ProofOfInteraction = {
  verified: boolean;
  interaction_count: number;
  first_interaction_at?: string;
  can_rate: boolean;
  can_comment: boolean;
  reason?: string;
};

export type VoteType = "upvote" | "downvote";

// =============================================================================
// On-Chain Activity Types
// =============================================================================

export type ActivityType = "transaction" | "event" | "notification";

export type OnChainActivity = {
  id: string;
  type: ActivityType;
  app_id: string | null;
  app_name?: string;
  app_icon?: string;
  /** Chain ID where the activity occurred - null if unknown */
  chain_id: ChainId | null;
  title: string;
  description: string;
  tx_hash?: string;
  timestamp: string;
  status?: "pending" | "confirmed" | "failed";
};
