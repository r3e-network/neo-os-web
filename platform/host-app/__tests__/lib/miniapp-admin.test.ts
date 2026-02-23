import { normalizeMiniAppAdminPayload } from "@/lib/miniapp-admin";

describe("miniapp-admin normalization", () => {
  it("rejects invalid app ids", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "Bad App Id",
      name: "Bad",
      entry_url: "https://example.com/app",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/app_id/i);
    }
  });

  it("builds prediction blueprint payloads with template + operations", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "miniapp-prediction-sample",
      name: "Prediction Sample",
      entry_url: "https://example.com/predict",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      blueprint: "prediction",
      operations: [{ name: "Buy", method: "buyPosition" }],
      permissions: { payments: true, datafeed: true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.blueprint).toBe("prediction");
    expect(result.action).toBe("save_draft");
    expect(result.row.status).toBe("pending");
    expect(result.row.manifest.page_template).toEqual(
      expect.objectContaining({
        layout: "prediction",
      }),
    );
    expect(result.row.manifest.operations).toEqual([
      expect.objectContaining({ method: "buyPosition" }),
    ]);
  });

  it("maps publish action to active status", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "miniapp-active-market",
      name: "Active Market",
      entry_url: "https://example.com/active",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      action: "publish",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe("publish");
    expect(result.row.status).toBe("active");
  });

  it("rejects non-GAS and non-BNEO allowlists", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "miniapp-bad-assets",
      name: "Bad Assets",
      entry_url: "https://example.com/assets",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      assets_allowed: ["NEO"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/assets_allowed/i);
    }
  });

  it("uses existing developer metadata when omitted in update payload", () => {
    const result = normalizeMiniAppAdminPayload(
      {
        app_id: "miniapp-existing",
        name: "Existing App",
        entry_url: "https://example.com/existing",
      },
      {
        existing: {
          app_id: "miniapp-existing",
          developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
          developer_pubkey: "03ab",
          assets_allowed: ["GAS"],
          governance_assets_allowed: ["BNEO"],
          manifest: {
            permissions: {
              payments: true,
            },
          },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.developer_user_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.row.developer_pubkey).toBe("03ab");
  });

  it("accepts frontend_spec markdown and stores it in canonical manifest fields", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "miniapp-frontend-spec",
      name: "Frontend Spec App",
      entry_url: "https://example.com/spec",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      frontend_spec: "## Intro\nConfig-driven content only.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.row.manifest.frontend_spec).toBe("## Intro\nConfig-driven content only.");
    expect(result.row.manifest.page_template).toEqual(
      expect.objectContaining({
        layout: "default",
      }),
    );
  });

  it("preserves contract template metadata from contract object", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "miniapp-factory-template",
      name: "Factory Template App",
      entry_url: "https://example.com/factory-template",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      contract: {
        template_id: "prediction-binary",
        init_params: {
          question: "Will BTC close above 100k this week?",
          end_time: 1735689600,
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.row.manifest.template_id).toBe("prediction-binary");
    expect(result.row.manifest.init_params).toEqual(
      expect.objectContaining({
        question: "Will BTC close above 100k this week?",
      }),
    );
    expect(result.row.manifest.contract).toEqual(
      expect.objectContaining({
        template_id: "prediction-binary",
      }),
    );
  });

  it("keeps contract template compatibility and audit metadata", () => {
    const result = normalizeMiniAppAdminPayload({
      app_id: "miniapp-contract-compat",
      name: "Contract Compat",
      entry_url: "https://example.com/contract-compat",
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      contract_template: {
        template_id: "prediction-binary",
        min_factory_version: "1.2.0",
        max_factory_version: "2.0.0",
        requires_host_capability: ["oracle", "attestation"],
        security_profile: {
          audited: true,
          audit_provider: "BlockSec",
          audit_hash: "sha256:abc123",
          audit_date: "2026-02-22",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.row.manifest.contract_template).toEqual(
      expect.objectContaining({
        template_id: "prediction-binary",
        min_factory_version: "1.2.0",
        max_factory_version: "2.0.0",
        requires_host_capability: ["oracle", "attestation"],
        security_profile: expect.objectContaining({
          audited: true,
          audit_provider: "BlockSec",
          audit_hash: "sha256:abc123",
          audit_date: "2026-02-22",
        }),
      }),
    );
  });
});
