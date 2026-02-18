/**
 * MiniApp Types for Mobile Wallet
 * Aligned with host-app types for full compatibility
 */

import type { MiniAppDisplayConfig, MiniAppRuntimeConfig } from "@neo/shared/types/miniapp-runtime";

export type MiniAppCategory = "gaming" | "defi" | "governance" | "utility" | "social" | "nft";

export type ChainId = string;

export type MiniAppSource = "builtin" | "community" | "verified";

export type MiniAppPermissions = {
  payments?: boolean;
  governance?: boolean;
  rng?: boolean;
  datafeed?: boolean;
  confidential?: boolean;
  automation?: boolean;
};

export type MiniAppLimits = {
  max_gas_per_tx?: string;
  daily_gas_cap_per_user?: string;
  governance_cap?: string;
};

export type MiniAppChainContract = {
  address: string | null;
  active?: boolean;
  entryUrl?: string;
};

export type MiniAppChainContracts = Record<ChainId, MiniAppChainContract>;

export type MiniAppDeveloper = {
  name: string;
  address: string;
  verified?: boolean;
};

export type MiniAppStats = {
  users?: number;
  transactions?: number;
  users_24h?: number;
  txs_24h?: number;
  volume_24h?: string;
  growth?: number;
};

export type MiniAppInfo = {
  app_id: string;
  name: string;
  description: string;
  // Self-contained i18n: each MiniApp provides its own translations
  name_zh?: string;
  description_zh?: string;
  icon: string;
  banner?: string;
  category: MiniAppCategory;
  entry_url: string;
  supportedChains: ChainId[];
  chainContracts?: MiniAppChainContracts;
  status?: "active" | "disabled" | "pending" | null;
  source?: MiniAppSource;
  stats?: MiniAppStats;
  developer?: MiniAppDeveloper;
  permissions: MiniAppPermissions;
  limits?: MiniAppLimits | null;
  news_integration?: boolean | null;
  stats_display?: string[] | null;
  features?: string[];
  created_at?: string;
  ui_config?: MiniAppRuntimeConfig | null;
  display?: MiniAppDisplayConfig | null;
};

export const CATEGORY_LABELS: Record<MiniAppCategory, string> = {
  gaming: "Gaming",
  defi: "DeFi",
  governance: "Governance",
  utility: "Utility",
  social: "Social",
  nft: "NFT",
};

export const CATEGORY_ICONS: Record<MiniAppCategory, string> = {
  gaming: "game-controller",
  defi: "trending-up",
  governance: "people",
  utility: "construct",
  social: "chatbubbles",
  nft: "images",
};

export const ALL_CATEGORIES: MiniAppCategory[] = [
  "gaming",
  "defi",
  "governance",
  "utility",
  "social",
  "nft",
];
