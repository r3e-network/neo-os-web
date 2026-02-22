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
          app_id: "miniapp-prediction-market",
          name: "Prediction Market",
          entry_url: "mf://manifest?app=miniapp-prediction-market",
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
        app_id: "miniapp-prediction-market",
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
});
