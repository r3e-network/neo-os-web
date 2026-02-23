export interface ContractEntry {
  name: string;
  hash: string;
}

export interface OperationParam {
  name: string;
  type: string;
  label: string;
  required: boolean;
  default_value: string;
  placeholder: string;
  options: string;
}

export interface OperationEntry {
  name: string;
  method: string;
  description: string;
  gas_cost: string;
  button_style: string;
  confirm_message: string;
  params: OperationParam[];
}

export interface ComponentEntry {
  type: string;
  display: string;
  props: string;
}

export interface ContentBlock {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  tone?: string;
  entries?: Array<{ key: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
}

export interface DetailTemplate {
  layout?: string;
  hero?: Record<string, string>;
  tabs?: Array<{ id: string; label: string; type: string; blocks?: ContentBlock[] }>;
  operation_panel?: Record<string, string>;
}

export type FrontendSpecFormat = "markdown" | "yaml" | "json";

export const EMPTY_FORM = {
  app_id: "",
  name: "",
  entry_url: "",
  version: "1.0.0",
  name_zh: "",
  description_zh: "",
  developer_user_id: "",
  developer_pubkey: "",
  callback_contract: "",
  callback_method: "",
  blueprint: "default" as string,
  detail_template: null as DetailTemplate | null,
  frontend_template_id: "",
  frontend_template_version: "1.0.0",
  frontend_template_variant: "",
  frontend_template_params_json: "{}",
  contract_template_id: "",
  contract_template_version: "1.0.0",
  contract_template_variant: "",
  contract_template_factory_ref: "",
  contract_template_init_params_json: "{}",
  contract_template_init_schema_json: "{}",
  contract_template_method_schema_json: "{}",
  contract_template_security_profile_json: "{}",
  contract_template_requires_capabilities: "",
  contract_template_min_factory_version: "",
  contract_template_max_factory_version: "",
  contract_template_audit_provider: "",
  contract_template_audit_hash: "",
  contract_template_audit_date: "",
  logic_json: "{}",
  marketplace_json: "{}",
  assets_allowed: "GAS",
  governance_assets_allowed: "BNEO",
  daily_gas_cap_per_user: "",
  governance_cap: "",
  max_gas_per_tx: "",
  attestation_required: false,
  permissions: {} as Record<string, boolean>,
  contracts: [] as ContractEntry[],
  operations: [] as OperationEntry[],
  components: [] as ComponentEntry[],
  frontend_spec_format: "markdown" as FrontendSpecFormat,
  frontend_spec_content: "",
  content_logo_variants_json: "[]",
  content_banner_variants_json: "[]",
  content_description: "",
  content_icon_url: "",
  content_logo_url: "",
  content_banner_url: "",
  content_docs_url: "",
  content_category: "",
  content_tags: "",
};

export const PERMISSION_KEYS = [
  "rng",
  "oracle",
  "compute",
  "datafeed",
  "automation",
  "gasbank",
  "wallet",
  "payments",
  "governance",
  "storage",
  "secrets",
];

export const CATEGORIES = ["gaming", "defi", "social", "utility", "nft", "governance", "data", "other"];

export const BLUEPRINTS: Record<string, { label: string; desc: string; overrides: Partial<typeof EMPTY_FORM> }> = {
  default: {
    label: "Default",
    desc: "General miniapp with overview/reviews/forum/news",
    overrides: {
      blueprint: "default",
      permissions: { payments: true },
      daily_gas_cap_per_user: "100",
      max_gas_per_tx: "10",
      assets_allowed: "GAS",
    },
  },
  prediction: {
    label: "Prediction",
    desc: "Polymarket-style with market info + trade panel",
    overrides: {
      blueprint: "prediction",
      permissions: { payments: true, datafeed: true },
      daily_gas_cap_per_user: "100",
      max_gas_per_tx: "10",
      assets_allowed: "GAS",
      contract_template_id: "prediction-binary",
      frontend_template_id: "prediction",
    },
  },
  lottery: {
    label: "Lottery",
    desc: "No-Code Lottery and Giveaway template",
    overrides: {
      blueprint: "lottery",
      permissions: { rng: true, payments: true },
      daily_gas_cap_per_user: "50",
      max_gas_per_tx: "10",
      assets_allowed: "GAS",
      content_category: "gaming",
      contract_template_id: "lottery-v1",
      frontend_template_id: "lottery",
    },
  },
  "template-market": {
    label: "Marketplace Demo",
    desc: "Demonstrates frontend + contract template binding",
    overrides: {
      blueprint: "template-market",
      permissions: { payments: true, datafeed: true },
      content_category: "governance",
      assets_allowed: "GAS",
      contract_template_id: "prediction-binary",
      frontend_template_id: "prediction",
    },
  },
  gaming: {
    label: "Gaming",
    desc: "RNG, compute, gasbank pre-configured",
    overrides: {
      blueprint: "gaming",
      permissions: { rng: true, compute: true, gasbank: true },
      content_category: "gaming",
      daily_gas_cap_per_user: "50",
      max_gas_per_tx: "10",
      assets_allowed: "GAS",
    },
  },
  defi: {
    label: "DeFi",
    desc: "Oracle, datafeed, wallet, gasbank",
    overrides: {
      blueprint: "defi",
      permissions: { oracle: true, datafeed: true, wallet: true, gasbank: true },
      content_category: "defi",
      daily_gas_cap_per_user: "100",
      max_gas_per_tx: "20",
      assets_allowed: "GAS",
      governance_assets_allowed: "BNEO",
    },
  },
};

export const CREATE_TABS = [
  { label: "Basic Info", value: "basic" },
  { label: "Content", value: "content" },
  { label: "Page Layout", value: "layout" },
  { label: "Contracts & Ops", value: "contracts" },
  { label: "Permissions & Limits", value: "perms" },
  { label: "JSON", value: "json" },
];

export const BLUEPRINT_TEMPLATES: Record<string, DetailTemplate> = {
  default: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" },
      { id: "forum", label: "Forum", type: "forum" },
      { id: "news", label: "News", type: "news" },
    ],
    operation_panel: { title: "Operations", subtitle: "Configure parameters and submit.", cta_label: "Launch App" },
  },
  prediction: {
    layout: "prediction",
    hero: { eyebrow: "Prediction Market", disclaimer: "Probabilities are market-implied." },
    tabs: [
      { id: "market-info", label: "Market Info", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" },
      { id: "forum", label: "Comments", type: "forum" },
      { id: "news", label: "Activity", type: "news" },
    ],
    operation_panel: {
      title: "Trade Position",
      subtitle: "Choose side, set amount, submit on-chain.",
      cta_label: "Open Full Experience",
    },
  },
  lottery: {
    layout: "lottery",
    hero: { eyebrow: "Giveaway & Lottery", disclaimer: "Provably fair on-chain draws." },
    tabs: [
      { id: "overview", label: "Overview", type: "content" },
      { id: "participants", label: "Participants", type: "participants" },
      { id: "draw-history", label: "Draw History", type: "draw-history" },
    ],
    operation_panel: {
      title: "Buy Ticket",
      subtitle: "Enter the draw.",
      cta_label: "Participate Now",
    },
  },
  "template-market": {
    layout: "prediction",
    hero: { eyebrow: "Template Market", disclaimer: "Powered by reusable templates and schema-driven UI." },
    tabs: [
      { id: "overview", label: "Overview", type: "content" },
    ],
    operation_panel: {
      title: "Template Actions",
      subtitle: "Interact with the instantiated template.",
      cta_label: "Interact",
    },
  },
  gaming: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content" },
      { id: "leaderboard", label: "Leaderboard", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" },
      { id: "news", label: "News", type: "news" },
    ],
    operation_panel: { title: "Play", subtitle: "Configure game parameters and start playing.", cta_label: "Launch Game" },
  },
  defi: {
    layout: "default",
    tabs: [
      { id: "pool-info", label: "Pool Info", type: "content" },
      { id: "positions", label: "Positions", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" },
      { id: "news", label: "Activity", type: "news" },
    ],
    operation_panel: {
      title: "Manage Position",
      subtitle: "Deposit, withdraw, or claim rewards.",
      cta_label: "Open DeFi App",
    },
  },
};

export const SOFT_DELETE_WARNING = "Delete now means disabling the MiniApp (soft delete).";
