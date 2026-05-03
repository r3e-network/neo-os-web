import { describe, expect, it } from "vitest";
import { miniAppConfigSchema } from "@/lib/schemas";
import { appToForm, formToConfig } from "@/app/miniapps/lib/form-converters";

const basePayload = {
  app_id: "miniapp-shared-streams",
  name: "Shared Streams",
  entry_url: "https://example.com/shared-streams",
  template_type: "defi",
};

describe("miniAppConfigSchema modular constraints", () => {
  it("rejects shared mode without required recipe, bindings, and instance id", () => {
    const result = miniAppConfigSchema.safeParse({
      ...basePayload,
      contract_composition: {
        mode: "shared",
        modules: [{ module_id: "module.stream_vesting" }],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.errors.map((entry) => entry.message);
    expect(messages).toContain("shared mode requires a recipe reference");
    expect(messages).toContain("shared mode requires instance_id");
    expect(messages).toContain("shared mode requires every module to define a unique binding");
  });

  it("rejects router mode without router template ref", () => {
    const result = miniAppConfigSchema.safeParse({
      ...basePayload,
      contract_composition: {
        mode: "router",
        recipe: { recipe_id: "recipe.gacha.v1", version: "1.0.0" },
        modules: [{ module_id: "module.oracle_rng", binding: "rng" }],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.errors.map((entry) => entry.message)).toContain("router mode requires router_template_ref");
  });

  it("rejects modular fields when mode is omitted or left as template", () => {
    const missingMode = miniAppConfigSchema.safeParse({
      ...basePayload,
      contract_composition: {
        recipe: { recipe_id: "recipe.payment_streams.v1", version: "1.0.0" },
      },
    });
    expect(missingMode.success).toBe(false);
    if (!missingMode.success) {
      expect(missingMode.error.errors.map((entry) => entry.message)).toContain(
        "contract_composition.mode is required when recipe, instance, router, or module settings are provided",
      );
    }

    const templateMode = miniAppConfigSchema.safeParse({
      ...basePayload,
      contract_composition: {
        mode: "template",
        recipe: { recipe_id: "recipe.payment_streams.v1", version: "1.0.0" },
      },
    });
    expect(templateMode.success).toBe(false);
    if (!templateMode.success) {
      expect(templateMode.error.errors.map((entry) => entry.message)).toContain(
        "template mode cannot include shared/router recipe or module settings",
      );
    }
  });

  it("rejects operation recipes that reference unknown bindings", () => {
    const result = miniAppConfigSchema.safeParse({
      ...basePayload,
      contract_composition: {
        mode: "shared",
        instance_id: "neopay:testnet:default",
        recipe: { recipe_id: "recipe.payment_streams.v1", version: "1.0.0" },
        modules: [{ module_id: "module.stream_vesting", binding: "stream" }],
      },
      frontend_composition: {
        operation_recipes: [
          {
            operation: "createSharedStream",
            binding: "vault",
            method: "createStream",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.errors.map((entry) => entry.message)).toContain(
      'Operation recipe references unknown binding "vault"',
    );
  });

  it("round-trips shared-mode instance id and registry hashes through form converters", () => {
    const form = {
      app_id: "miniapp-neo-pay-shared-example",
      name: "NeoPay Modular Fixture",
      entry_url: "mf://manifest?app=miniapp-neo-pay",
      blueprint: "defi",
      version: "1.0.0",
      developer_pubkey: "",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      permissions: {},
      contracts: [],
      operations: [],
      components: [],
      attestation_required: false,
      assets_allowed: "GAS",
      governance_assets_allowed: "BNEO",
      frontend_template_id: "",
      frontend_template_version: "1.0.0",
      frontend_template_variant: "",
      frontend_template_params_json: "{}",
      frontend_composition_json: "{}",
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
      contract_composition_mode: "shared",
      contract_instance_id: "neopay:testnet:default",
      contract_recipe_id: "recipe.payment_streams.v1",
      contract_recipe_version: "1.0.0",
      contract_router_template_ref: "",
      contract_registries_json: JSON.stringify({
        module_registry: "0x7666a46644dca58e8c3b308b34e83db440e04991",
        recipe_registry: "0xe22bc8072f616974a64c0da1dfda845945d4215f",
        instance_registry: "0x5b9a6d1ca5fdbc95d4307990551682a3b7a1d5d6",
      }),
      contract_modules_json: JSON.stringify([
        { module_id: "module.funding_vault", binding: "vault", version: "1.0.0" },
        { module_id: "module.stream_vesting", binding: "stream", version: "1.0.0", depends_on: ["vault"] },
      ]),
      contract_module_bindings_json: JSON.stringify({
        vault: { module_id: "module.funding_vault", version: "1.0.0" },
        stream: { module_id: "module.stream_vesting", version: "1.0.0" },
      }),
      contract_instance_permissions_json: "{}",
      logic_json: "{}",
      marketplace_json: "{}",
      frontend_spec_format: "markdown",
      frontend_spec_content: "",
      content_description: "",
      content_icon_url: "",
      content_logo_url: "",
      content_banner_url: "",
      content_logo_variants_json: "[]",
      content_banner_variants_json: "[]",
      content_docs_url: "",
      content_category: "",
      content_tags: "",
      max_gas_per_tx: "",
      daily_gas_cap_per_user: "",
      governance_cap: "",
      callback_contract: "",
      callback_method: "",
      detail_template: undefined,
      name_zh: "",
      description_zh: "",
    };

    const config = formToConfig(form);
    expect(config.contract_composition).toEqual(
      expect.objectContaining({
        mode: "shared",
        instance_id: "neopay:testnet:default",
        registries: expect.objectContaining({
          module_registry: "0x7666a46644dca58e8c3b308b34e83db440e04991",
        }),
      }),
    );

    const nextForm = appToForm({
      app_id: "miniapp-neo-pay-shared-example",
      entry_url: "mf://manifest?app=miniapp-neo-pay",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      developer_pubkey: "",
      assets_allowed: ["GAS"],
      governance_assets_allowed: ["BNEO"],
      permissions: {},
      limits: {},
      manifest: config,
    } as any);

    expect(nextForm.contract_instance_id).toBe("neopay:testnet:default");
    expect(nextForm.contract_registries_json).toContain("module_registry");
  });
});
