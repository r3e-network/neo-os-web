import fs from "fs";
import os from "os";
import path from "path";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";

describe("miniapp-definitions loader", () => {
  const prevDir = process.env.MINIAPP_DEFINITIONS_DIR;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-defs-"));

  afterAll(() => {
    process.env.MINIAPP_DEFINITIONS_DIR = prevDir;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("loads and normalizes json definitions", async () => {
    const definitionsDir = path.join(tempRoot, "defs");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "prediction-market.json"),
      JSON.stringify(
        {
          app_id: "miniapp-predictionmarket",
          name: "Prediction Market",
          entry_url: "mf://manifest?app=miniapp-predictionmarket",
          content: {
            category: "defi",
            logo_url: "/miniapp-assets/prediction-market/logo.jpg",
            banner_url: "/miniapp-assets/prediction-market/banner.jpg",
          },
          frontend_spec: {
            format: "markdown",
            content: "# Prediction Market\n\nThis app is fully template-driven.",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual(
      expect.objectContaining({
        app_id: "miniapp-predictionmarket",
        name: "Prediction Market",
        category: "defi",
        logo_url: "/miniapp-assets/prediction-market/logo.jpg",
        banner_url: "/miniapp-assets/prediction-market/banner.jpg",
      }),
    );
    expect(apps[0].detail_template?.tabs?.[0]).toEqual(
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
    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual(
      expect.objectContaining({
        app_id: "miniapp-market-factory",
        contract_hash: "0x6b589e1bc92f5a13c677898cf26c1dfdd8ee7b59",
        news_integration: true,
      }),
    );
    expect(apps[0].manifest).toEqual(
      expect.objectContaining({
        template_id: "prediction-binary",
        contract: expect.objectContaining({
          template_id: "prediction-binary",
        }),
      }),
    );
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
    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual(
      expect.objectContaining({
        app_id: "miniapp-yaml-market",
        name: "YAML Market",
      }),
    );
    expect(apps[0].manifest).toEqual(
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
      path.join(definitionsDir, "lottery.example.json"),
      JSON.stringify(
        {
          app_id: "lottery-example",
          name: "Lottery Example",
        },
        null,
        2,
      ),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(definitionsDir, "dice-game.json"),
      JSON.stringify(
        {
          app_id: "dice-game",
          name: "Dice Game",
          entry_url: "https://example.com/dice-game",
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
    expect(apps).toHaveLength(2);
    const byId = new Map(apps.map((app) => [app.app_id, app]));
    expect(byId.get("miniapp-dicegame")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-dicegame",
        entry_url: "mf://manifest?app=miniapp-dicegame",
      }),
    );
    expect(byId.get("miniapp-fogplay")).toEqual(
      expect.objectContaining({
        app_id: "miniapp-fogplay",
        entry_url: "mf://manifest?app=miniapp-fogplay",
      }),
    );
  });
});
