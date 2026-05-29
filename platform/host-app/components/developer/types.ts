export const categories = [
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
  "utility",
] as const;

export const templateTypes = [
  "default",
  "prediction",
  "gaming",
  "defi",
  "nft",
] as const;

export type FormData = {
  app_id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  category: (typeof categories)[number];
  template_type: (typeof templateTypes)[number];
  frontend_template_id: string;
  contract_template_id: string;
  contract_hash: string;
  entry_url: string;
  logo_url: string;
  banner_url: string;
  docs_url: string;
  developer_name: string;
  developer_user_id: string;
  developer_pubkey: string;
};

export type AdminTemplateCatalog = {
  frontend_templates?: Array<{ template_id: string; name: string }>;
  contract_templates?: Array<{ template_id: string; name: string }>;
};

export type MarketTemplateKind = "frontend" | "contract";
export type MarketTemplateSource = "miniapp" | "community" | "verified";
export type MarketTemplateItem = {
  template_kind: MarketTemplateKind;
  template_id: string;
  version: string;
  name: string;
  description: string;
  category: string;
  source_type: MarketTemplateSource;
  tags: string[];
  is_verified: boolean;
  usage_count: number;
  rating_avg: number | null;
  rating_count: number;
  schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
  manifest: Record<string, unknown>;
  factory_template_ref: string | null;
  updated_at: string;
};
