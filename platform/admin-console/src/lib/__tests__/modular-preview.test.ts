import { describe, expect, it } from "vitest";
import {
  buildModularPlanFilename,
  buildModularPlanPathHint,
  buildModularPreview,
  buildModularRegistrationDraft,
  buildModularValidateOnlyCommand,
} from "@/app/miniapps/lib/modular-preview";
import { EMPTY_FORM } from "@/app/miniapps/lib/page-config";
import { formToConfig } from "@/app/miniapps/lib/form-converters";

describe("buildModularPreview", () => {
  it("stays hidden when no modular fields are present", () => {
    const result = buildModularPreview(EMPTY_FORM, formToConfig);
    expect(result.visible).toBe(false);
  });

  it("shows invalid state for incomplete shared mode config", () => {
    const result = buildModularPreview(
      {
        ...EMPTY_FORM,
        app_id: "miniapp-preview",
        name: "Preview",
        entry_url: "https://example.com",
        blueprint: "default",
        contract_composition_mode: "shared",
        contract_modules_json: '[{"module_id":"module.stream_vesting"}]',
      },
      formToConfig,
    );

    expect(result.visible).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("shared mode requires a recipe reference");
  });

  it("shows valid preview for shared mode config", () => {
    const result = buildModularPreview(
      {
        ...EMPTY_FORM,
        app_id: "miniapp-preview",
        name: "Preview",
        entry_url: "https://example.com",
        blueprint: "default",
        contract_composition_mode: "shared",
        contract_instance_id: "neopay:testnet:default",
        contract_recipe_id: "recipe.payment_streams.v1",
        contract_recipe_version: "1.0.0",
        contract_registries_json: '{"module_registry":"0x7666a46644dca58e8c3b308b34e83db440e04991"}',
        contract_modules_json: '[{"module_id":"module.funding_vault","binding":"vault"},{"module_id":"module.stream_vesting","binding":"stream","depends_on":["vault"]}]',
        contract_module_bindings_json: '{"vault":{"module_id":"module.funding_vault"},"stream":{"module_id":"module.stream_vesting"}}',
      },
      formToConfig,
    );

    expect(result.visible).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.preview).toContain('"instance_id": "neopay:testnet:default"');
    expect(result.preview).toContain('"recipe_id": "recipe.payment_streams.v1"');
  });

  it("builds stable modular thin plan usage hints", () => {
    const draft = buildModularRegistrationDraft(
      {
        ...EMPTY_FORM,
        app_id: "miniapp-preview",
        name: "Preview",
        entry_url: "https://example.com",
        blueprint: "default",
        contract_composition_mode: "shared",
        contract_instance_id: "neopay:testnet:default",
        contract_recipe_id: "recipe.payment_streams.v1",
        contract_recipe_version: "1.0.0",
        contract_modules_json: '[{"module_id":"module.funding_vault","binding":"vault"}]',
      },
      formToConfig,
    );

    expect(draft).not.toBeNull();
    expect(buildModularPlanFilename("miniapp-preview")).toBe("miniapp-preview.modular-plan.json");
    expect(buildModularPlanPathHint(draft!)).toBe("deploy/config/miniapp-preview.modular-plan.json");
    expect(buildModularValidateOnlyCommand(draft!)).toContain(
      "go run -tags=scripts deploy/scripts/register_modular_instance.go --plan deploy/config/miniapp-preview.modular-plan.json --validate-only",
    );
  });
});
