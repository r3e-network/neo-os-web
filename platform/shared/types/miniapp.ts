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

export type MiniAppSource = "builtin" | "community" | "verified";

export interface MiniAppPermissions {
  payments?: boolean;
  governance?: boolean;
  randomness?: boolean;
  datafeed?: boolean;
  confidential?: boolean;
}

export interface MiniAppLimits {
  max_gas_per_tx?: string;
  daily_gas_cap_per_user?: string;
  governance_cap?: string;
}

export interface MiniAppInfo {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: MiniAppCategory;
  entry_url: string;
  contract_hash?: string | null;
  status?: "active" | "disabled" | "pending" | null;
  source?: MiniAppSource;
  permissions: MiniAppPermissions;
  limits?: MiniAppLimits | null;
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
