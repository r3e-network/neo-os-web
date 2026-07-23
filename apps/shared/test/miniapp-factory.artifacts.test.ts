import { afterEach, describe, expect, it, vi } from "vitest";

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const ADMIN = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function modules() {
  vi.stubEnv("VITE_MINIAPP_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
  const [plan, studio] = await Promise.all([
    import("../factory/factoryPlan"),
    import("../../miniapp-factory/src/studio-artifacts"),
  ]);
  return { ...plan, ...studio };
}

const DRAFT = {
  appId: "miniapp-sunlit-rewards",
  appName: "Sunlit Rewards",
  templateKind: "reward-vault" as const,
  admin: ADMIN,
  network: "neo-n3-testnet" as const,
  needsOracle: true,
  needsOneGate: true,
};

describe("MiniApp Studio deterministic artifacts", () => {
  it("forces restored drafts onto the only configured network and strips unsafe text", async () => {
    const { normalizeMiniAppDraft } = await modules();
    const normalized = normalizeMiniAppDraft(
      {
        ...DRAFT,
        appId: " MINIAPP-SUNLIT\u0000-REWARDS ",
        appName: " Sunlit\u0007 Rewards ",
        network: "neo-n3-mainnet",
        templateKind: "unknown-template",
      },
      DRAFT,
    );

    expect(normalized).toMatchObject({
      appId: "miniapp-sunlit-rewards",
      appName: "Sunlit Rewards",
      network: "neo-n3-testnet",
      templateKind: "reward-vault",
    });
  });

  it("fails closed when template verification is unknown without changing the digest", async () => {
    const { applyVerifiedTemplateGate, buildFactoryPlan } = await modules();
    const offline = buildFactoryPlan("miniapp", DRAFT, {
      appId: "miniapp-miniapp-factory",
    });
    const gated = applyVerifiedTemplateGate(offline, undefined);
    const verified = buildFactoryPlan("miniapp", DRAFT, {
      appId: "miniapp-miniapp-factory",
      artifactPresence: "missing",
    });

    expect(gated.publishable).toBe(true);
    expect(gated.execution).toMatchObject({
      outcome: "registry-record",
      available: false,
      blockedReasonKey: "artifactUnverified",
    });
    expect(gated.steps.find((step) => step.key === "deploy")).toMatchObject({
      status: "manual",
      detailKey: "stepDeployUnverifiedDetail",
    });
    expect(verified.execution.available).toBe(true);
    expect(verified.digest).toBe(gated.digest);
  });

  it("exports one reproducible starter bundle and never labels it as a deployed app", async () => {
    const { buildFactoryPlan, buildMiniAppStudioArtifacts } = await modules();
    const plan = buildFactoryPlan("miniapp", DRAFT, {
      appId: "miniapp-miniapp-factory",
      artifactPresence: "missing",
    });
    const artifacts = buildMiniAppStudioArtifacts(plan);
    const bundle = JSON.parse(artifacts.bundleJson) as {
      schema: string;
      appId: string;
      digest: string;
      outputs: {
        catalogPatch: Record<string, unknown>;
        manifest: { tabs: unknown[]; stats: unknown[]; permissions: Record<string, boolean> };
        factoryBinding: { digest: string; network: string };
        registrationPlan: { execution: { outcome: string } };
      };
    };

    expect(bundle.schema).toBe("neo-miniapp-factory-package:v1");
    expect(bundle.appId).toBe(DRAFT.appId);
    expect(bundle.digest).toBe(plan.digest);
    expect(bundle.outputs.catalogPatch).toMatchObject({
      id: DRAFT.appId,
      name: DRAFT.appName,
      default_network: "neo-n3-testnet",
    });
    expect(bundle.outputs.manifest.tabs).toEqual([]);
    expect(bundle.outputs.manifest.stats).toEqual([]);
    expect(bundle.outputs.manifest.permissions).toMatchObject({
      payments: true,
      storage: true,
      datafeed: true,
      oracle: true,
    });
    expect(bundle.outputs.factoryBinding).toMatchObject({
      digest: plan.digest,
      network: "neo-n3-testnet",
    });
    expect(bundle.outputs.registrationPlan.execution.outcome).toBe("registry-record");
    expect(artifacts.bundleFileName).toMatch(/^miniapp-sunlit-rewards-[0-9a-f]{8}\.json$/);
    expect(artifacts.manifestCode).toContain("operator must implement and verify");
    expect(artifacts.bundleJson.toLowerCase()).not.toContain("deployment success");
  });

  it("maps every template to a product-specific starter surface", async () => {
    const { buildFactoryPlan, buildMiniAppStudioArtifacts } = await modules();
    const cases = [
      ["reward-vault", "defi", "launcher", "finance"],
      ["ticket-pass", "social", "market", "social"],
      ["certificate", "social", "launcher", "social"],
      ["oracle-console", "oracle", "console", "default"],
    ] as const;

    for (const [templateKind, category, shell, family] of cases) {
      const plan = buildFactoryPlan("miniapp", { ...DRAFT, templateKind }, {
        appId: "miniapp-miniapp-factory",
        artifactPresence: "missing",
      });
      const { manifest } = buildMiniAppStudioArtifacts(plan);
      expect(manifest).toMatchObject({
        category,
        shell,
        theme: { family },
        tabs: [],
        stats: [],
      });
    }
  });
});
