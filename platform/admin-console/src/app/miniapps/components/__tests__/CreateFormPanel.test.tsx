import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { CreateFormPanel } from "../CreateFormPanel";
import type { MiniAppFormState } from "../../lib/form-types";

const baseForm: MiniAppFormState = {
  app_id: "",
  name: "",
  name_zh: "",
  entry_url: "",
  version: "1.0.0",
  developer_user_id: "",
  developer_pubkey: "",
  attestation_required: false,
  frontend_template_id: "",
  frontend_template_version: "",
  frontend_template_variant: "",
  frontend_template_params_json: "{}",
  contract_template_id: "",
  contract_template_version: "",
  contract_template_variant: "",
  contract_template_factory_ref: "",
  contract_template_requires_capabilities: "",
  contract_template_min_factory_version: "",
  contract_template_max_factory_version: "",
  contract_template_init_params_json: "{}",
  contract_template_init_schema_json: "",
  contract_template_method_schema_json: "{}",
  contract_template_security_profile_json: "{}",
  contract_template_audit_provider: "",
  contract_template_audit_hash: "",
  contract_template_audit_date: "",
  contract_composition_mode: "",
  contract_instance_id: "",
  contract_recipe_id: "",
  contract_router_template_ref: "",
  contract_modules_json: "[]",
  contract_module_bindings_json: "{}",
  contract_instance_permissions_json: "{}",
  contract_registries_json: "{}",
  detail_template: null,
  content_description: "",
  description_zh: "",
  content_icon_url: "",
  content_logo_url: "",
  content_banner_url: "",
  content_docs_url: "",
  content_category: "",
  content_tags: "",
  content_logo_variants_json: "[]",
  content_banner_variants_json: "[]",
  frontend_spec_format: "markdown",
  frontend_spec_content: "",
  logic_json: "{}",
  marketplace_json: "{}",
  permissions: { wallet: true, oracle: false },
  contracts: [],
  operations: [],
  components: [],
  callback_contract: "",
  callback_method: "",
  daily_gas_cap_per_user: "",
  governance_cap: "",
  max_gas_per_tx: "",
  assets_allowed: "",
  governance_assets_allowed: "",
};

function renderPanel() {
  const props = {
    form: baseForm,
    setForm: vi.fn(),
    formError: "",
    loading: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    jsonText: "",
    setJsonText: vi.fn(),
    onImportJson: vi.fn(),
    onFileUpload: vi.fn(),
    onUploadMediaAsset: vi.fn().mockResolvedValue(undefined),
    mediaUploadPending: false,
    mediaUploadError: "",
    mediaUploadInfo: "",
    mode: "create" as const,
    createTabs: [
      { label: "Basic", value: "basic" },
      { label: "Content", value: "content" },
      { label: "Contracts", value: "contracts" },
      { label: "Permissions", value: "perms" },
      { label: "JSON", value: "json" },
    ],
    permissionKeys: ["wallet", "oracle"],
    categories: ["DeFi", "Gaming"],
    blueprints: {
      market: {
        label: "Prediction Market",
        desc: "Market-ready MiniApp shell",
        overrides: { permissions: { wallet: true, oracle: true } },
      },
      wallet: {
        label: "Wallet Utility",
        desc: "Asset and account utility",
        overrides: { permissions: { wallet: true, oracle: false } },
      },
    },
    blueprintTemplates: {},
    emptyForm: baseForm,
    toConfig: vi.fn(() => ({ app_id: "miniapp-test" })),
    parseJSONObjectText: vi.fn((input: string) =>
      input.trim() ? JSON.parse(input) : {},
    ),
  };

  const renderResult = render(<CreateFormPanel {...props} />);
  return { ...props, ...renderResult };
}

describe("CreateFormPanel", () => {
  it("renders template shortcuts and the basic editor", () => {
    renderPanel();

    expect(screen.getByText("Template Marketplace")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Prediction Market/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("App ID *")).toBeInTheDocument();
  });

  it("keeps the template marketplace compact and aligned with admin chrome", () => {
    const { container } = renderPanel();
    const panel = container.querySelector(".miniapps-create-form-panel");
    const marketplace = container.querySelector(".miniapps-template-marketplace");
    const templateCards = container.querySelectorAll(".miniapps-template-card");
    const workflow = screen.getByLabelText("MiniApp builder workflow");

    expect(panel).toBeInstanceOf(HTMLElement);
    expect(marketplace).toBeInstanceOf(HTMLElement);
    expect(templateCards).toHaveLength(2);

    expect((panel as HTMLElement).className).toContain("rounded-xl");
    expect((panel as HTMLElement).className).toContain(
      "miniapps-create-form-shell",
    );
    expect((panel as HTMLElement).className).not.toContain("glass-card");
    expect((marketplace as HTMLElement).className).toContain("rounded-xl");
    expect((marketplace as HTMLElement).className).not.toContain("relative");
    expect((marketplace as HTMLElement).innerHTML).not.toContain("blur-");
    expect(workflow).toHaveTextContent("Template");
    expect(workflow).toHaveTextContent("Configure");
    expect(workflow).toHaveTextContent("Validate");
    expect(container.innerHTML).not.toContain("dark:");
    expect(container.innerHTML).not.toContain("hover:-translate-y-1");
    expect(container.innerHTML).not.toContain("hover:shadow-lg");
    expect(container.innerHTML).not.toContain("shadow-primary");
    expect(container.innerHTML).not.toContain("🏪");
  });

  it("keeps every create/edit tab on the light operator-console surface", () => {
    const { container } = renderPanel();
    const panel = container.querySelector(".miniapps-create-form-panel");
    expect(panel).toBeInstanceOf(HTMLElement);

    for (const tabName of [
      "Basic",
      "Content",
      "Contracts",
      "Permissions",
      "JSON",
    ]) {
      fireEvent.click(screen.getByRole("tab", { name: tabName }));
      const html = (panel as HTMLElement).innerHTML;

      expect(html, `${tabName} tab should not include local dark classes`).not.toContain(
        "dark:",
      );
      expect(html, `${tabName} tab should not include old rounded inputs`).not.toContain(
        "rounded-md",
      );
      expect(html, `${tabName} tab should not include dim disabled controls`).not.toContain(
        "disabled:opacity-50",
      );
      expect(html, `${tabName} tab should not use decorative blur`).not.toContain(
        "blur-",
      );
    }
  });

  it("marks the chosen template card as selected for operator feedback", async () => {
    const user = userEvent.setup();
    renderPanel();

    const prediction = screen.getByRole("button", {
      name: /Prediction Market/i,
    });
    await user.click(prediction);

    expect(prediction).toHaveAttribute("aria-pressed", "true");
    expect(prediction.className).toContain("border-primary-300");
    expect(prediction.className).toContain("bg-primary-50");
  });

  it("keeps the source free of deprecated glass panel styling", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../CreateFormPanel.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/variant="glass"|glass-card|backdrop-blur/);
  });
});
