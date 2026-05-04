import fs from "fs";
import os from "os";
import path from "path";
import { loadBundledMiniAppById, loadMiniAppDefinitions } from "@/lib/miniapp-definitions";

describe("miniapp-definitions loader", () => {
  const prevDir = process.env.MINIAPP_DEFINITIONS_DIR;
  const prevTargetNetwork = process.env.NEO_TARGET_NETWORK;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-defs-"));

  afterAll(() => {
    process.env.MINIAPP_DEFINITIONS_DIR = prevDir;
    process.env.NEO_TARGET_NETWORK = prevTargetNetwork;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function getApp(apps: Awaited<ReturnType<typeof loadMiniAppDefinitions>>, appId: string) {
    return apps.find((app) => app.app_id === appId);
  }

  it("loads and normalizes json definitions", async () => {
    const definitionsDir = path.join(tempRoot, "defs");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "neo-swap.json"),
      JSON.stringify(
        {
          app_id: "miniapp-neo-swap",
          name: "Neo Swap",
          entry_url: "mf://manifest?app=miniapp-neo-swap",
          content: {
            category: "defi",
            logo_url: "/miniapp-assets/neo-swap/logo.jpg",
            banner_url: "/miniapp-assets/neo-swap/banner.jpg",
          },
          frontend_spec: {
            format: "markdown",
            content: "# Neo Swap\n\nThis app is fully template-driven.",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(apps.length).toBeGreaterThan(0);
    expect(getApp(apps, "miniapp-neo-swap")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-neo-swap",
        name: "Neo Swap",
        category: "defi",
        logo_url: "/miniapp-assets/neo-swap/logo.jpg",
        banner_url: "/miniapp-assets/neo-swap/banner.jpg",
      }),
    );
    expect(getApp(apps, "miniapp-neo-swap")?.detail_template?.tabs?.[0]).toEqual(
      expect.objectContaining({
        id: "overview",
      }),
    );
  });

  it("maps contract/media/integration fields into canonical payload", async () => {
    const definitionsDir = path.join(tempRoot, "defs-contract");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "market-factory.json"),
      JSON.stringify(
        {
          app_id: "miniapp-market-factory",
          name: "Market Factory",
          entry_url: "mf://manifest?app=miniapp-market-factory",
          contract: {
            template_id: "prediction-binary",
            init_params: {
              question: "Will ETH break ATH this month?",
            },
            contract_hash: "0x6b589e1bc92f5a13c677898cf26c1dfdd8ee7b59",
          },
          media: {
            icon: "/miniapp-assets/market-factory/icon.png",
            banner: "/miniapp-assets/market-factory/banner.png",
          },
          integration: {
            news_integration: true,
            stats_display: ["tx_count", "daily_active_users"],
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(apps.length).toBeGreaterThan(0);
    expect(getApp(apps, "miniapp-market-factory")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-market-factory",
        contract_hash: "0x6b589e1bc92f5a13c677898cf26c1dfdd8ee7b59",
        logo_url: "/miniapp-assets/market-factory/icon.png",
        banner_url: "/miniapp-assets/market-factory/banner.png",
        news_integration: true,
      }),
    );
    expect(getApp(apps, "miniapp-market-factory")?.manifest).toEqual(
      expect.objectContaining({
        template_id: "prediction-binary",
        contract: expect.objectContaining({
          template_id: "prediction-binary",
        }),
      }),
    );
  });

  it("keeps bundled manifest urls.entry behind the native manifest runtime", async () => {
    const definitionsDir = path.join(tempRoot, "defs-urls-entry");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "tarot.json"),
      JSON.stringify(
        {
          app_id: "miniapp-onchaintarot",
          name: "On-chain Tarot",
          urls: {
            entry: "/miniapps/on-chain-tarot/index.html",
            icon: "/miniapps/on-chain-tarot/logo.jpg",
            banner: "/miniapps/on-chain-tarot/banner.jpg",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(getApp(apps, "miniapp-onchaintarot")).toEqual(
      expect.objectContaining({
        entry_url: "mf://manifest?app=miniapp-onchaintarot",
        logo_url: "/miniapp-assets/on-chain-tarot/logo.jpg",
        banner_url: "/miniapp-assets/on-chain-tarot/banner.jpg",
      }),
    );
  });

  it("preserves modular contract composition metadata in bundled definitions", async () => {
    const definitionsDir = path.join(tempRoot, "defs-composition");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "shared-streams.json"),
      JSON.stringify(
        {
          app_id: "miniapp-shared-streams",
          name: "Shared Streams",
          entry_url: "mf://manifest?app=miniapp-shared-streams",
          contract_composition: {
            mode: "shared",
            recipe: {
              recipe_id: "recipe.payment_streams.v1",
              version: "1.0.0",
            },
            modules: [
              {
                module_id: "module.funding_vault",
                version: "1.0.0",
                binding: "vault",
              },
              {
                module_id: "module.stream_vesting",
                version: "1.0.0",
                binding: "stream",
              },
            ],
            instance_permissions: {
              oracle: false,
              escrow_assets: ["GAS"],
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    const app = getApp(apps, "miniapp-shared-streams");
    expect(app).toEqual(
      expect.objectContaining({
        app_id: "miniapp-shared-streams",
      }),
    );
    expect(app?.manifest).toEqual(
      expect.objectContaining({
        contract_composition: expect.objectContaining({
          mode: "shared",
          recipe: expect.objectContaining({
            recipe_id: "recipe.payment_streams.v1",
          }),
          modules: expect.arrayContaining([
            expect.objectContaining({
              module_id: "module.funding_vault",
            }),
          ]),
        }),
      }),
    );
  });

  it("preserves template-container modular composition metadata", async () => {
    const definitionsDir = path.join(tempRoot, "defs-template-composition");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "templated-shared.json"),
      JSON.stringify(
        {
          app_id: "miniapp-templated-shared",
          name: "Templated Shared",
          entry_url: "mf://manifest?app=miniapp-templated-shared",
          template: {
            template_type: "defi",
            contract_composition: {
              mode: "shared",
              instance_id: "templated:testnet:default",
              recipe: {
                recipe_id: "recipe.payment_streams.v1",
                version: "1.0.0",
              },
              modules: [
                {
                  module_id: "module.stream_vesting",
                  binding: "stream",
                  version: "1.0.0",
                },
              ],
            },
            frontend_composition: {
              shell_recipe: "shell.launcher.v1",
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    const app = getApp(apps, "miniapp-templated-shared");
    expect(app?.manifest).toEqual(
      expect.objectContaining({
        template: expect.objectContaining({
          contract_composition: expect.objectContaining({
            mode: "shared",
            instance_id: "templated:testnet:default",
          }),
          frontend_composition: expect.objectContaining({
            shell_recipe: "shell.launcher.v1",
          }),
        }),
      }),
    );
  });

  it("loads bundled shared-mode examples by app id from definition files", async () => {
    const definitionsDir = path.join(tempRoot, "defs-bundled-shared");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "neo-pay.modular-fixture.json"),
      JSON.stringify(
        {
          app_id: "miniapp-neo-pay-shared-example",
          name: "NeoPay Modular Fixture",
          entry_url: "mf://manifest?app=miniapp-neo-pay",
          contract_composition: {
            mode: "shared",
            instance_id: "neopay:testnet:default",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const app = await loadBundledMiniAppById("miniapp-neo-pay-shared-example");
    expect(app).toEqual(
      expect.objectContaining({
        app_id: "miniapp-neo-pay-shared-example",
      }),
    );
    expect(app?.manifest).toEqual(
      expect.objectContaining({
        contract_composition: expect.objectContaining({
          mode: "shared",
          instance_id: "neopay:testnet:default",
        }),
      }),
    );
  });

  it("publishes the supported Neo Swap manifest from the active bundled catalog", async () => {
    const definitionsDir = path.join(tempRoot, "defs-archived");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    const apps = await loadMiniAppDefinitions();
    expect(getApp(apps, "miniapp-neo-swap")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-neo-swap",
        name: "Neo Swap",
      }),
    );
    await expect(loadBundledMiniAppById("miniapp-neo-swap")).resolves.toEqual(
      expect.objectContaining({
        app_id: "miniapp-neo-swap",
        name: "Neo Swap",
      }),
    );
  });

  it("resolves the current network contract hash from manifest contracts", async () => {
    const definitionsDir = path.join(tempRoot, "defs-network-aware");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;
    process.env.NEO_TARGET_NETWORK = "testnet";

    fs.writeFileSync(
      path.join(definitionsDir, "network-aware.json"),
      JSON.stringify(
        {
          app_id: "miniapp-network-aware",
          name: "Network Aware",
          entry_url: "mf://manifest?app=miniapp-network-aware",
          contract_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          manifest: {
            default_network: "neo-n3-mainnet",
            contracts: {
              "neo-n3-mainnet": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "neo-n3-testnet": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(apps.length).toBeGreaterThan(0);
    expect(getApp(apps, "miniapp-network-aware")?.contract_hash).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("loads yaml definitions and preserves template/i18n metadata", async () => {
    const definitionsDir = path.join(tempRoot, "defs-yaml");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "yaml-miniapp.yaml"),
      [
        "app_id: miniapp-yaml-market",
        "name: YAML Market",
        "name_zh: YAML 市场",
        "description: Example loaded from YAML",
        "description_zh: YAML 配置示例",
        "template_type: prediction",
        "entry_url: https://example.com/yaml-market",
        "template:",
        "  frontend_template:",
        "    template_id: prediction",
        "    version: 1.0.0",
        "  contract_template:",
        "    template_id: prediction-binary",
        "    version: 1.0.0",
        "media:",
        "  logo: https://cdn.example.com/yaml/logo.png",
        "  banner: https://cdn.example.com/yaml/banner.png",
        "  logo_variants:",
        "    - url: https://cdn.example.com/yaml/logo-dark.png",
        "      theme: dark",
        "      locale: zh-CN",
        "  banner_variants:",
        "    - url: https://cdn.example.com/yaml/banner-dark.png",
        "      theme: dark",
        "",
      ].join("\n"),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(apps.length).toBeGreaterThan(0);
    expect(getApp(apps, "miniapp-yaml-market")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-yaml-market",
        name: "YAML Market",
      }),
    );
    expect(getApp(apps, "miniapp-yaml-market")?.manifest).toEqual(
      expect.objectContaining({
        name_zh: "YAML 市场",
        description_zh: "YAML 配置示例",
        template_type: "prediction",
        media: expect.objectContaining({
          logo_variants: expect.arrayContaining([
            expect.objectContaining({ url: "https://cdn.example.com/yaml/logo-dark.png" }),
          ]),
          banner_variants: expect.arrayContaining([
            expect.objectContaining({ url: "https://cdn.example.com/yaml/banner-dark.png" }),
          ]),
        }),
        template: expect.objectContaining({
          frontend_template: expect.objectContaining({ template_id: "prediction" }),
          contract_template: expect.objectContaining({ template_id: "prediction-binary" }),
        }),
      }),
    );
  });

  it("skips non-runtime definition files and canonicalizes app ids to miniapp-*", async () => {
    const definitionsDir = path.join(tempRoot, "defs-filter");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "miniapp-config.schema.json"),
      JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema" }, null, 2),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(definitionsDir, "sample.example.json"),
      JSON.stringify(
        {
          app_id: "sample-example",
          name: "Sample Example",
        },
        null,
        2,
      ),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(definitionsDir, "red-envelope.json"),
      JSON.stringify(
        {
          app_id: "red-envelope",
          name: "Red Envelope",
          entry_url: "https://example.com/red-envelope",
          content: {
            category: "gaming",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(definitionsDir, "legacy-coinflip.json"),
      JSON.stringify(
        {
          app_id: "miniapp-fogplay",
          name: "Legacy Coin Flip",
          content: {
            category: "gaming",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    const byId = new Map(apps.map((app) => [app.app_id, app]));
    expect(apps.length).toBeGreaterThanOrEqual(2);
    expect(byId.get("miniapp-redenvelope")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-redenvelope",
        entry_url: "https://example.com/red-envelope",
      }),
    );
    expect(byId.get("miniapp-fogplay")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-fogplay",
        entry_url: "mf://manifest?app=miniapp-fogplay",
      }),
    );
    expect(byId.has("miniapp-sample-example")).toBe(false);
  });

  it("keeps bundled SelfLoan host operations aligned with the PlatformDeFi ABI", async () => {
    const app = await loadBundledMiniAppById("miniapp-self-loan");
    const operations = app?.operations ?? [];
    const byMethod = new Map(operations.map((operation) => [operation.method, operation] as const));

    expect(byMethod.has("repayDebt")).toBe(false);
    expect(byMethod.get("repayLoan")?.params?.map((param) => [param.name, param.type])).toEqual([
      ["appId", "string"],
      ["loanId", "integer"],
    ]);
    expect(byMethod.get("addCollateral")?.params?.map((param) => [param.name, param.type])).toEqual([
      ["appId", "string"],
      ["loanId", "integer"],
    ]);
    expect(byMethod.get("syncProfitAnchorVote")?.params?.map((param) => [param.name, param.type])).toEqual([
      ["appId", "string"],
    ]);
  });

  it("loads bundled miniapps by the public MiniApp slug", async () => {
    const app = await loadBundledMiniAppById("self-loan");

    expect(app).toEqual(
      expect.objectContaining({
        app_id: "miniapp-self-loan",
        entry_url: "mf://manifest?app=miniapp-self-loan",
      }),
    );
  });
});
