import { validateMiniAppDefinitionAgainstSchema } from "@/lib/miniapp-schema-validator";

describe("miniapp-schema-validator", () => {
  it("accepts a valid base definition", () => {
    const result = validateMiniAppDefinitionAgainstSchema({
      app_id: "miniapp-schema-ok",
      name: "Schema OK",
      template_type: "utility",
      category: "utility",
      entry_url: "https://example.com/app",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects invalid enum values", () => {
    const result = validateMiniAppDefinitionAgainstSchema({
      app_id: "miniapp-schema-bad",
      name: "Schema Bad",
      template_type: "not-a-template",
      category: "utility",
      entry_url: "https://example.com/app",
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/template_type/i);
  });

  it("rejects unexpected top-level fields", () => {
    const result = validateMiniAppDefinitionAgainstSchema({
      app_id: "miniapp-extra-field",
      name: "Extra Field",
      template_type: "utility",
      unsupported: true,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported|not allowed/i);
  });

  it("accepts extended template/i18n/media variants payload", () => {
    const result = validateMiniAppDefinitionAgainstSchema({
      app_id: "miniapp-template-rich",
      name: "Template Rich",
      name_zh: "模板应用",
      description: "Rich template payload",
      description_zh: "支持模板与多语言",
      template_type: "prediction",
      category: "governance",
      entry_url: "https://example.com/prediction",
      template: {
        template_type: "prediction",
        frontend_template: {
          template_id: "prediction",
          version: "1.0.0",
          params: { show_odds: true },
        },
        contract_template: {
          template_id: "prediction-binary",
          version: "1.0.0",
          init_params: { oracle: "0x1234567890abcdef1234567890abcdef12345678" },
        },
      },
      media: {
        logo: "https://cdn.example.com/logo.png",
        banner: "https://cdn.example.com/banner.png",
        logo_variants: [{ url: "https://cdn.example.com/logo-dark.png", theme: "dark" }],
        banner_variants: [{ url: "https://cdn.example.com/banner-2x.png", density: "2x" }],
      },
      i18n: {
        name_zh: "模板应用",
        description_zh: "支持模板与多语言",
      },
      frontend_spec: {
        layout: "prediction",
        tabs: [{ id: "overview", label: "Overview", type: "content" }],
      },
    });

    expect(result.valid).toBe(true);
  });
});
