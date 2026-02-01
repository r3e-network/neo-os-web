// Shared MiniApp Types
// Used by both host-app and mobile-wallet

export type MiniAppCategory =
  | "gaming"
  | "defi"
  | "governance"
  | "utility"
  | "social"
  | "nft"
  | "creative"
  | "security"
  | "tools";

export type ChainId = string;

export type MiniAppSource = "builtin" | "community" | "verified";

export interface MiniAppPermissions {
  payments?: boolean;
  governance?: boolean;
  rng?: boolean;
  datafeed?: boolean;
  confidential?: boolean;
  automation?: boolean;
}

export interface MiniAppLimits {
  max_gas_per_tx?: string;
  daily_gas_cap_per_user?: string;
  governance_cap?: string;
}

export interface MiniAppChainContract {
  address: string | null;
  active?: boolean;
  entryUrl?: string;
}

export type MiniAppChainContracts = Record<ChainId, MiniAppChainContract>;

export interface MiniAppInfo {
  app_id: string;
  name: string;
  description: string;
  name_zh?: string;
  description_zh?: string;
  icon: string;
  category: MiniAppCategory;
  entry_url: string;
  supportedChains: ChainId[];
  chainContracts?: MiniAppChainContracts;
  status?: "active" | "disabled" | "pending" | null;
  source?: MiniAppSource;
  permissions: MiniAppPermissions;
  limits?: MiniAppLimits | null;
  news_integration?: boolean | null;
  stats_display?: string[] | null;
}

export const CATEGORY_LABELS: Record<MiniAppCategory, string> = {
  gaming: "Gaming",
  defi: "DeFi",
  governance: "Governance",
  utility: "Utility",
  social: "Social",
  nft: "NFT",
  creative: "Creative",
  security: "Security",
  tools: "Tools",
};
