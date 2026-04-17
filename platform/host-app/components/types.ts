// MiniApp Platform Types

export type MiniAppCategory = "gaming" | "defi" | "governance" | "utility" | "social" | "nft" | "data" | "other";

export type MiniAppSource = "miniapp" | "community" | "verified";

export type MiniAppInfo = {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  logo_url?: string | null;
  banner_url?: string | null;
  docs_url?: string | null;
  category: MiniAppCategory;
  entry_url: string;
  contract_hash?: string | null;
  news_integration?: boolean | null;
  stats_display?: string[] | null;
  status?: "active" | "disabled" | "pending" | "beta" | null;
  source?: MiniAppSource;
  stats?: { users?: number; transactions?: number };
  operations?: OperationEntry[] | null;
  detail_template?: MiniAppDetailTemplate | null;
  manifest?: Record<string, unknown> | null;
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
    aa?: boolean;
  };
  limits?: {
    max_gas_per_tx?: string;
    daily_gas_cap_per_user?: string;
    governance_cap?: string;
  } | null;
};

export type OperationParam = {
  name: string;
  type: "string" | "integer" | "boolean" | "address" | "hash160" | "hash256" | "amount" | "select";
  label?: string;
  required?: boolean;
  default_value?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  hidden?: boolean;
};

export type OperationEntry = {
  name: string;
  method: string;
  description?: string;
  gas_cost?: string;
  button_style?: "primary" | "secondary" | "danger" | "success";
  confirm_message?: string;
  params?: OperationParam[];
};

export type MiniAppContentBlock =
  | {
      type: "markdown";
      title?: string;
      content: string;
    }
  | {
      type: "notice";
      title?: string;
      tone?: "info" | "success" | "warning";
      content: string;
    }
  | {
      type: "bullet_list";
      title?: string;
      items: string[];
    }
  | {
      type: "key_value";
      title?: string;
      items: Array<{ key: string; value: string }>;
    }
  | {
      type: "links";
      title?: string;
      items: Array<{ label: string; href: string; external?: boolean }>;
    };

export type MiniAppDetailTabType = "content" | "reviews" | "forum" | "news" | "secrets";

export type MiniAppDetailTab = {
  id: string;
  label: string;
  type: MiniAppDetailTabType;
  blocks?: MiniAppContentBlock[];
};

export type MiniAppOperationPanel = {
  title?: string;
  subtitle?: string;
  cta_label?: string;
  operations: OperationEntry[];
};

export type MiniAppDetailTemplate = {
  layout: "default" | "prediction";
  hero?: {
    eyebrow?: string;
    disclaimer?: string;
  };
  tabs: MiniAppDetailTab[];
  operation_panel?: MiniAppOperationPanel;
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
