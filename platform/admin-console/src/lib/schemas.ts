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

export const contractModuleConfigSchema = z.object({
  module_id: z.string().min(1),
  version: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  binding: z.string().min(1).optional(),
  depends_on: z.array(z.string().min(1)).optional(),
  contract_hash: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "valid Neo N3 contract hash").optional(),
  capabilities: z.array(z.string()).optional(),
});

export const contractRecipeRefSchema = z.object({
  recipe_id: z.string().min(1),
  version: z.string().optional(),
});

export const contractCompositionSchema = z.object({
  mode: z.enum(["template", "shared", "router", "custom"]).optional(),
  instance_id: z.string().min(1).optional(),
  recipe: contractRecipeRefSchema.optional(),
  modules: z.array(contractModuleConfigSchema).optional(),
  router_template_ref: z.string().optional(),
  registries: z.object({
    module_registry: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "valid Neo N3 contract hash").optional(),
    recipe_registry: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "valid Neo N3 contract hash").optional(),
    instance_registry: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "valid Neo N3 contract hash").optional(),
  }).partial().optional(),
  module_bindings: z.record(z.unknown()).optional(),
  instance_permissions: z.record(z.unknown()).optional(),
});

export const frontendCompositionSchema = z.object({
  shell_recipe: z.string().optional(),
  shell_version: z.string().optional(),
  surface_slots: z.record(z.unknown()).optional(),
  data_sources: z.array(z.record(z.unknown())).optional(),
  operation_recipes: z.array(z.record(z.unknown())).optional(),
  style_profile: z.record(z.unknown()).optional(),
  capability_bindings: z.record(z.unknown()).optional(),
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

export const miniAppConfigBaseSchema = z.object({
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
    frontend_composition: frontendCompositionSchema.optional(),
    contract_template: templateBindingSchema.partial().optional(),
    contract_composition: contractCompositionSchema.optional(),
  }).passthrough().optional(),
  frontend_template: templateBindingSchema.partial().optional(),
  contract_template: templateBindingSchema.partial().optional(),
  frontend_composition: frontendCompositionSchema.optional(),
  contract_composition: contractCompositionSchema.optional(),
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

export const miniAppConfigSchema = miniAppConfigBaseSchema.superRefine((value, ctx) => {
  const contractComposition = value.contract_composition;
  const frontendComposition = value.frontend_composition;
  if (!contractComposition) return;

  const mode = contractComposition.mode;
  const modules = Array.isArray(contractComposition.modules) ? contractComposition.modules : [];
  const moduleBindings = contractComposition.module_bindings && typeof contractComposition.module_bindings === "object"
    ? contractComposition.module_bindings
    : {};
  const recipe = contractComposition.recipe;
  const routerTemplateRef = String(contractComposition.router_template_ref || "").trim();
  const instanceId = String(contractComposition.instance_id || "").trim();
  const hasModularFields =
    !!recipe?.recipe_id ||
    modules.length > 0 ||
    !!routerTemplateRef ||
    !!instanceId ||
    Object.keys(moduleBindings).length > 0 ||
    !!contractComposition.registries;

  if (!mode && hasModularFields) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contract_composition", "mode"],
      message: "contract_composition.mode is required when recipe, instance, router, or module settings are provided",
    });
  }

  if (mode === "template" && hasModularFields) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contract_composition", "mode"],
      message: "template mode cannot include shared/router recipe or module settings",
    });
  }

  const bindingIds = modules.map((module) => String(module.binding || "").trim()).filter(Boolean);
  const uniqueBindingIds = new Set(bindingIds);

  if (mode === "shared" || mode === "router") {
    if (!recipe?.recipe_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contract_composition", "recipe"],
        message: `${mode} mode requires a recipe reference`,
      });
    }
    if (modules.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contract_composition", "modules"],
        message: `${mode} mode requires at least one module`,
      });
    }
    if (bindingIds.length !== modules.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contract_composition", "modules"],
        message: `${mode} mode requires every module to define a unique binding`,
      });
    } else if (uniqueBindingIds.size !== bindingIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contract_composition", "modules"],
        message: "Module bindings must be unique",
      });
    }
  }

  if (mode === "shared" && !instanceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contract_composition", "instance_id"],
      message: "shared mode requires instance_id",
    });
  }

  if (mode === "router" && !routerTemplateRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contract_composition", "router_template_ref"],
      message: "router mode requires router_template_ref",
    });
  }

  for (const key of Object.keys(moduleBindings)) {
    if (!uniqueBindingIds.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contract_composition", "module_bindings", key],
        message: `Unknown module binding "${key}"`,
      });
    }
  }

  for (const module of modules) {
    const dependencies = Array.isArray(module.depends_on) ? module.depends_on : [];
    for (const dependency of dependencies) {
      const dependencyKey = String(dependency || "").trim();
      if (dependencyKey && !uniqueBindingIds.has(dependencyKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contract_composition", "modules"],
          message: `Module "${module.module_id}" depends on missing binding "${dependencyKey}"`,
        });
      }
    }
  }

  const operationRecipes = Array.isArray(frontendComposition?.operation_recipes)
    ? frontendComposition.operation_recipes
    : [];
  for (const [index, recipeEntry] of operationRecipes.entries()) {
    const binding = String((recipeEntry as Record<string, unknown>)?.binding || "").trim();
    if ((mode === "shared" || mode === "router") && !binding) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frontend_composition", "operation_recipes", index, "binding"],
        message: "Operation recipe binding is required for modular contract composition",
      });
      continue;
    }
    if (binding && !uniqueBindingIds.has(binding)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frontend_composition", "operation_recipes", index, "binding"],
        message: `Operation recipe references unknown binding "${binding}"`,
      });
    }
  }

  const dataSources = Array.isArray(frontendComposition?.data_sources)
    ? frontendComposition.data_sources
    : [];
  for (const [index, entry] of dataSources.entries()) {
    const source = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const sourceType = String(source.type || "").trim();
    if (sourceType !== "shared_mode_runtime") continue;
    const sourceInstanceId = String(source.instance_id || "").trim();
    if (mode !== "shared") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frontend_composition", "data_sources", index, "type"],
        message: "shared_mode_runtime data sources require contract_composition.mode = shared",
      });
    }
    if (!sourceInstanceId && !instanceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frontend_composition", "data_sources", index, "instance_id"],
        message: "shared_mode_runtime data sources require instance_id",
      });
    }
  }
});

export type MiniAppConfig = z.infer<typeof miniAppConfigSchema>;

// Services health response schema
export const healthResponseSchema = z.object({
  version: z.string().optional(),
  uptime: z.number().optional(),
}).passthrough();
