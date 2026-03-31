import { miniAppConfigSchema } from "@/lib/schemas";
import type { MiniAppFormState } from "./form-types";

export type ModularPreviewState = {
  visible: boolean;
  valid: boolean;
  mode: string;
  message: string;
  preview: string;
};

export type ModularRegistrationDraft = {
  name: string;
  definition_path: string;
  rpc_url: string;
  module_registry_hash: string;
  recipe_registry_hash: string;
  instance_registry_hash: string;
  app_registry_hash: string;
  link_registries: boolean;
  modules: Array<Record<string, unknown>>;
  recipe: Record<string, unknown>;
  instance: Record<string, unknown>;
};

export function buildModularPlanFilename(appIdLike: unknown): string {
  const appId = asString(appIdLike) || "miniapp";
  return `${appId}.modular-plan.json`;
}

export function buildModularPlanPathHint(
  draft: Pick<ModularRegistrationDraft, "instance">,
  filename = buildModularPlanFilename(asObject(draft.instance).app_id),
): string {
  return `deploy/config/${filename}`;
}

export function buildModularValidateOnlyCommand(
  draft: Pick<ModularRegistrationDraft, "instance">,
  planPath = buildModularPlanPathHint(draft),
): string {
  return `go run -tags=scripts deploy/scripts/register_modular_instance.go --plan ${planPath} --validate-only`;
}

function stringifyPreview(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function hasMeaningfulText(value: unknown, emptyJSON: string): boolean {
  const text = String(value ?? "").trim();
  return !!text && text !== emptyJSON;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function guessDefinitionPath(payload: Record<string, unknown>): string {
  const appId = asString(payload.app_id);
  const entryUrl = asString(payload.entry_url);
  const entryMatch = entryUrl.match(/\/miniapps\/([^/]+)\//);
  const slug =
    (entryMatch?.[1] || "")
    || (appId.startsWith("miniapp-") ? appId.slice("miniapp-".length) : appId.replace(/^miniapp[._-]?/i, ""));
  if (!slug) return "";
  return `platform/host-app/public/miniapp-definitions/${slug}.json`;
}

export function buildModularRegistrationDraft(
  form: MiniAppFormState,
  toConfig: (form: MiniAppFormState) => Record<string, unknown>,
): ModularRegistrationDraft | null {
  let payload: Record<string, unknown>;
  try {
    payload = toConfig(form);
  } catch {
    return null;
  }

  const parsed = miniAppConfigSchema.safeParse(payload);
  if (!parsed.success) return null;

  const contractComposition = asObject(payload.contract_composition);
  const frontendComposition = asObject(payload.frontend_composition);
  const recipe = asObject(contractComposition.recipe);
  const modules = asArray(contractComposition.modules).map((item) => asObject(item));
  if (modules.length === 0 || !recipe.recipe_id) return null;

  const mode = asString(contractComposition.mode) || "shared";
  const moduleBindings = asObject(contractComposition.module_bindings);
  const instancePermissions = asObject(contractComposition.instance_permissions);
  const operationRecipes = asArray(frontendComposition.operation_recipes).map((item) => asObject(item));

  const derivedBindings: Array<[string, { module_id: string; version: string }]> = modules.reduce((acc, module) => {
    const binding = asString(module.binding);
    const moduleId = asString(module.module_id);
    const version = asString(module.version) || "1.0.0";
    if (!binding || !moduleId) return acc;
    acc.push([binding, { module_id: moduleId, version }]);
    return acc;
  }, [] as Array<[string, { module_id: string; version: string }]>);

  const normalizedBindings = Object.keys(moduleBindings).length > 0
    ? moduleBindings
    : Object.fromEntries(derivedBindings);

  return {
    name: asString(payload.name) || asString(payload.app_id) || "MiniApp Modular Draft",
    definition_path: guessDefinitionPath(payload),
    rpc_url: "",
    module_registry_hash: "",
    recipe_registry_hash: "",
    instance_registry_hash: "",
    app_registry_hash: "",
    link_registries: true,
    modules: modules.map((module) => ({
      module_id: asString(module.module_id),
      version: asString(module.version) || "1.0.0",
      binding: asString(module.binding),
      contract_hash: asString(module.contract_hash),
      config: asObject(module.config),
      risk_profile: asString(module.risk_profile),
      compatibility_metadata: {
        capabilities: asArray(module.capabilities),
        depends_on: asArray(module.depends_on),
      },
      active: true,
    })),
    recipe: {
      recipe_id: asString(recipe.recipe_id),
      version: asString(recipe.version) || "1.0.0",
      module_refs: modules.map((module) => ({
        module_id: asString(module.module_id),
        version: asString(module.version) || "1.0.0",
        binding: asString(module.binding),
      })),
      required_fields: {
        instance_permissions: Object.keys(instancePermissions),
        module_bindings: Object.keys(normalizedBindings),
      },
      operation_schema: {
        actions: operationRecipes
          .map((entry) => asString(entry.method) || asString(entry.id))
          .filter(Boolean),
      },
      allowed_runtime_mode: mode,
      router_template_id: asString(contractComposition.router_template_ref),
      compatibility_metadata: {
        app_id: asString(payload.app_id),
      },
      active: true,
    },
    instance: {
      instance_id: asString(contractComposition.instance_id),
      app_id: asString(payload.app_id),
      recipe_id: asString(recipe.recipe_id),
      recipe_version: asString(recipe.version) || "1.0.0",
      runtime_mode: mode,
      owner: "",
      operator: "",
      developer: "",
      router_contract: "",
      module_bindings: normalizedBindings,
      config_hash: "",
      frontend_ref: `${asString(payload.app_id)}@${asString(payload.version) || "1.0.0"}`,
    },
  };
}

export function buildModularPreview(
  form: MiniAppFormState,
  toConfig: (form: MiniAppFormState) => Record<string, unknown>,
): ModularPreviewState {
  const mode = String(form.contract_composition_mode || "").trim().toLowerCase();
  const hasModularHints =
    !!mode ||
    hasMeaningfulText(form.contract_instance_id, "") ||
    hasMeaningfulText(form.contract_recipe_id, "") ||
    hasMeaningfulText(form.contract_router_template_ref, "") ||
    hasMeaningfulText(form.contract_modules_json, "[]") ||
    hasMeaningfulText(form.contract_module_bindings_json, "{}") ||
    hasMeaningfulText(form.contract_instance_permissions_json, "{}") ||
    hasMeaningfulText(form.contract_registries_json, "{}");

  if (!hasModularHints) {
    return {
      visible: false,
      valid: true,
      mode: "",
      message: "",
      preview: "",
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = toConfig(form);
  } catch (error) {
    return {
      visible: true,
      valid: false,
      mode,
      message: error instanceof Error ? error.message : "Unable to build modular preview from current form state",
      preview: "",
    };
  }

  const parsed = miniAppConfigSchema.safeParse(payload);
  const contractComposition = (payload.contract_composition && typeof payload.contract_composition === "object")
    ? payload.contract_composition as Record<string, unknown>
    : {};
  const frontendComposition = (payload.frontend_composition && typeof payload.frontend_composition === "object")
    ? payload.frontend_composition as Record<string, unknown>
    : {};

  const preview = {
    app_id: payload.app_id,
    template_type: payload.template_type,
    contract_composition: contractComposition,
    frontend_composition: frontendComposition,
    generated_modular_plan: {
      mode: contractComposition.mode || null,
      instance_id: contractComposition.instance_id || null,
      recipe: contractComposition.recipe || null,
      router_template_ref: contractComposition.router_template_ref || null,
      registries: contractComposition.registries || null,
      modules: Array.isArray(contractComposition.modules) ? contractComposition.modules : [],
      module_bindings: contractComposition.module_bindings || null,
      instance_permissions: contractComposition.instance_permissions || null,
    },
  };

  if (parsed.success) {
    return {
      visible: true,
      valid: true,
      mode,
      message: "Modular configuration is structurally valid and ready for save/import.",
      preview: stringifyPreview(preview),
    };
  }

  const messages = Array.from(
    new Set(
      parsed.error.errors
        .map((issue) => {
          const path = issue.path.filter(Boolean).join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .filter(Boolean),
    ),
  );

  return {
    visible: true,
    valid: false,
    mode,
    message: messages.join("; ") || "Modular configuration is invalid.",
    preview: stringifyPreview(preview),
  };
}
