import { z } from "zod";

// Analytics response schemas
export const usageRowSchema = z.object({
  gas_used: z.number().optional().default(0),
});

export const usageOverTimeRowSchema = z.object({
  usage_date: z.string(),
  gas_used: z.number().default(0),
});

export const usageByAppRowSchema = z.object({
  app_id: z.string(),
  gas_used: z.number().default(0),
  tx_count: z.number().optional().default(0),
});

// MiniApp config schema for create/update
export const contractEntrySchema = z.object({
  name: z.string().min(1),
  hash: z.string().min(1).regex(/^0x[0-9a-fA-F]{40}$/, "valid Neo N3 contract hash"),
});

export const operationParamSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "integer", "boolean", "address", "hash256", "amount", "select"]),
  label: z.string().optional(),
  required: z.boolean().default(true),
  default_value: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});

export const operationEntrySchema = z.object({
  name: z.string().min(1),
  method: z.string().min(1),
  description: z.string().optional(),
  gas_cost: z.string().optional(),
  button_style: z.enum(["primary", "secondary", "danger", "success"]).optional(),
  confirm_message: z.string().optional(),
  params: z.array(operationParamSchema).default([]),
});

export const componentEntrySchema = z.object({
  type: z.string().min(1),
  display: z.string().optional(),
  props: z.record(z.unknown()).default({}),
});

export const mediaVariantSchema = z.object({
  url: z.string().min(1),
  theme: z.enum(["light", "dark", "any"]).optional(),
  density: z.enum(["1x", "2x", "3x"]).optional(),
  locale: z.string().max(16).optional(),
});

export const templateBindingSchema = z.object({
  template_id: z.string().min(1),
  version: z.string().optional(),
  variant: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  init_params: z.record(z.unknown()).optional(),
  init_schema: z.record(z.unknown()).optional(),
  method_schema: z.record(z.unknown()).optional(),
  security_profile: z.record(z.unknown()).optional(),
  factory_template_ref: z.string().optional(),
  requires_host_capability: z.array(z.string()).optional(),
  min_factory_version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  max_factory_version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});

export const i18nSchema = z.object({
  name_zh: z.string().optional(),
  description_zh: z.string().optional(),
  name_en: z.string().optional(),
  description_en: z.string().optional(),
}).passthrough();

export const mediaSchema = z.object({
  icon: z.string().optional(),
  logo: z.string().optional(),
  banner: z.string().optional(),
  logo_variants: z.array(mediaVariantSchema).optional(),
  banner_variants: z.array(mediaVariantSchema).optional(),
}).passthrough();

export const contentSchema = z.object({
  description: z.string().optional(),
  icon_url: z.string().optional(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  docs_url: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
}).default({});

// Blueprint Layout Types
export const blueprintLayoutSchema = z.enum([
  "default",
  "trading",
  "voting",
  "gaming",
  "info",
]);

export const heroConfigSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  disclaimer: z.string().optional(),
  image: z.string().optional(),
}).optional();

export const operationPanelConfigSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  cta_label: z.string().optional(),
  position: z.enum(["right", "bottom"]).optional(),
  collapsible: z.boolean().optional(),
}).optional();

export const statsDisplayConfigSchema = z.object({
  items: z.array(z.object({
    key: z.string(),
    label: z.string(),
    format: z.enum(["number", "currency", "percent", "date", "duration"]).optional(),
  })),
  refresh_interval: z.number().optional(),
}).optional();

export const blueprintConfigSchema = z.object({
  layout: blueprintLayoutSchema.default("default"),
  hero: heroConfigSchema,
  tabs: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["content", "forum", "reviews", "news", "custom"]),
  })).optional(),
  operation_panel: operationPanelConfigSchema,
  stats_display: statsDisplayConfigSchema,
  left_panel: z.object({
    width: z.string().optional(),
    components: z.array(z.string()).optional(),
  }).optional(),
  right_panel: z.object({
    width: z.string().optional(),
    sticky: z.boolean().optional(),
  }).optional(),
});

export const miniAppConfigSchema = z.object({
  app_id: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/, "lowercase alphanumeric with dots/hyphens"),
  developer_user_id: z.string().uuid().optional(),
  name: z.string().min(1),
  name_zh: z.string().optional(),
  entry_url: z.string().min(1),
  version: z.string().default("1.0.0"),
  description_zh: z.string().optional(),
  i18n: i18nSchema.optional(),
  developer_pubkey: z.string().regex(/^[0-9a-fA-F]*$/, "hex").optional().default(""),
  permissions: z.record(z.boolean()).default({}),
  limits: z.object({
    max_gas_per_tx: z.string().optional(),
    daily_gas_cap_per_user: z.union([z.string(), z.number()]).optional(),
    governance_cap: z.union([z.string(), z.number()]).optional(),
  }).default({}),
  assets_allowed: z.array(z.string()).default(["GAS"]),
  governance_assets_allowed: z.array(z.string()).default(["BNEO"]),
  callback_contract: z.string().optional(),
  callback_method: z.string().optional(),
  attestation_required: z.boolean().default(false),
  contracts: z.array(contractEntrySchema).default([]),
  operations: z.array(operationEntrySchema).default([]),
  components: z.array(componentEntrySchema).default([]),
  content: contentSchema,
  media: mediaSchema.optional(),
  blueprint: blueprintLayoutSchema.optional(),
  detail_template: blueprintConfigSchema.optional(),
  template: z.object({
    template_type: z.string().optional(),
    frontend_template: templateBindingSchema.partial().optional(),
    contract_template: templateBindingSchema.partial().optional(),
  }).passthrough().optional(),
  frontend_template: templateBindingSchema.partial().optional(),
  contract_template: templateBindingSchema.partial().optional(),
  frontend_spec: z.union([
    z.string(),
    z.object({
      format: z.enum(["markdown", "yaml", "json"]).optional(),
      content: z.string().optional(),
    }).passthrough(),
    z.record(z.unknown()),
  ]).optional(),
  logic: z.record(z.unknown()).optional(),
  marketplace: z.record(z.unknown()).optional(),
});

export type MiniAppConfig = z.infer<typeof miniAppConfigSchema>;

// Services health response schema
export const healthResponseSchema = z.object({
  version: z.string().optional(),
  uptime: z.number().optional(),
}).passthrough();
