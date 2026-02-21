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

export const contentSchema = z.object({
  description: z.string().optional(),
  icon_url: z.string().optional(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  docs_url: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
}).default({});

export const miniAppConfigSchema = z.object({
  app_id: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/, "lowercase alphanumeric with dots/hyphens"),
  developer_user_id: z.string().uuid().optional(),
  name: z.string().min(1),
  entry_url: z.string().min(1),
  version: z.string().default("1.0.0"),
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
  blueprint: z.string().optional(),
  detail_template: z.unknown().optional(),
});

export type MiniAppConfig = z.infer<typeof miniAppConfigSchema>;

// Services health response schema
export const healthResponseSchema = z.object({
  version: z.string().optional(),
  uptime: z.number().optional(),
}).passthrough();
