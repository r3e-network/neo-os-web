// MiniApp Platform Types

export type MiniAppCategory = "gaming" | "defi" | "governance" | "utility" | "social" | "nft";

export type MiniAppSource = "builtin" | "community" | "verified";

export type MiniAppInfo = {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: MiniAppCategory;
  entry_url: string;
  contract_hash?: string | null;
  news_integration?: boolean | null;
  stats_display?: string[] | null;
  status?: "active" | "disabled" | "pending" | null;
  source?: MiniAppSource;
  stats?: { users?: number; transactions?: number };
  developer?: {
    name: string;
    address: string;
    verified?: boolean;
  };
  permissions: {
    payments?: boolean;
    governance?: boolean;
    randomness?: boolean;
    datafeed?: boolean;
    confidential?: boolean;
  };
  limits?: {
    max_gas_per_tx?: string;
    daily_gas_cap_per_user?: string;
    governance_cap?: string;
  } | null;
};

export type MiniAppStats = {
  app_id: string;
  total_transactions: number;
  total_users: number;
  total_gas_used: string;
  total_gas_earned?: string;
  daily_active_users: number;
  weekly_active_users: number;
  last_activity_at: string | null;
};

export type MiniAppNotification = {
  id: string;
  app_id: string;
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
  provider: "neoline" | "o3" | "onegate" | null;
  balance?: { neo: string; gas: string };
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
  title: string;
  description: string;
  tx_hash?: string;
  timestamp: string;
  status?: "pending" | "confirmed" | "failed";
};
