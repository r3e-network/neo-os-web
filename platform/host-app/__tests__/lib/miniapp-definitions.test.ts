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
            logo_url: "/miniapp-assets/neo-swap/logo.webp",
            banner_url: "/miniapp-assets/neo-swap/banner.webp",
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
        logo_url: "/miniapp-assets/neo-swap/logo.webp",
        banner_url: "/miniapp-assets/neo-swap/banner.webp",
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
            icon: "/miniapps/on-chain-tarot/logo.webp",
            banner: "/miniapps/on-chain-tarot/banner.webp",
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
        dapp_url: "/miniapps/on-chain-tarot/index.html",
        logo_url: "/miniapp-assets/on-chain-tarot/logo.webp",
        banner_url: "/miniapp-assets/on-chain-tarot/banner.webp",
      }),
    );
  });

  it("keeps manifest-only dapp_url for app ids whose slug is not app_id without prefix", async () => {
    delete process.env.MINIAPP_DEFINITIONS_DIR;

    const app = await loadBundledMiniAppById("miniapp-unbreakablevault");

    expect(app).toEqual(
      expect.objectContaining({
        app_id: "miniapp-unbreakablevault",
        entry_url: "mf://manifest?app=miniapp-unbreakablevault",
        dapp_url: "/miniapps/unbreakable-vault/index.html",
        manifest: expect.objectContaining({
          contracts: expect.objectContaining({
            "neo-n3-testnet": "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
          }),
        }),
      }),
    );
  });

  it("keeps Memorial Shrine create and tribute flows inside the embedded shrine app", async () => {
    // Manifest v1.1.0 intentionally retired the host operation panel: the
    // createMemorial/payTribute wallet flows (draft validation, offering
    // prepay, receipt confirmation) moved into the designed embedded app.
    // This guard used to pin the host form's exact ABI param shapes; its
    // intent — the shrine's wallet flows stay intact and are not duplicated
    // by a generic host form — is now enforced against the embedded app.
    delete process.env.MINIAPP_DEFINITIONS_DIR;

    const app = await loadBundledMiniAppById("miniapp-memorial-shrine");
    expect(app?.operations ?? []).toEqual([]);
    expect(app?.detail_template?.operation_panel?.operations ?? []).toEqual([]);

    // The other half of this guard - that the embedded app still carries the
    // createMemorial/payTribute flows - lives in neo-miniapps, which holds that
    // source.
  });

  it("keeps human GAS amount operations scaled to fixed8 units", async () => {
    process.env.MINIAPP_DEFINITIONS_DIR = path.resolve(
      __dirname,
      "../../public/miniapp-definitions",
    );

    const apps = await loadMiniAppDefinitions();
    // Guest-only releases must not inherit an old paid template merely because
    // the catalog still knows the historical contract binding.
    expect(getApp(apps, "miniapp-fogplay")?.operations ?? []).toEqual([]);

    const redEnvelope = getApp(apps, "miniapp-redenvelope");
    const createAmount = redEnvelope?.operations
      ?.find((operation) => operation.method === "createEnvelope")
      ?.params?.find((param) => param.name === "amount");
    expect(createAmount).toEqual(
      expect.objectContaining({
        type: "amount",
        placeholder: "0.10",
        scale: 8,
      }),
    );
    expect(createAmount?.presets?.[0]).toEqual(
      expect.objectContaining({
        label: "0.10",
        value: "0.10",
      }),
    );

    const neoPay = getApp(apps, "miniapp-neo-pay");
    const createStream = neoPay?.operations?.find(
      (operation) => operation.method === "createStream",
    );
    expect(createStream).toEqual(
      expect.objectContaining({
        name: "Create Stream",
        priority: "primary",
      }),
    );
    expect(
      createStream?.params?.find((param) => param.name === "totalAmount"),
    ).toEqual(
      expect.objectContaining({
        type: "amount",
        placeholder: "0.03",
        scale: 8,
      }),
    );
    expect(
      createStream?.params?.find((param) => param.name === "rateAmount"),
    ).toEqual(
      expect.objectContaining({
        type: "amount",
        scale: 8,
      }),
    );

    const aaRelay = getApp(apps, "miniapp-aa-relay-console");
    // AA Relay Console v2.0.0 retired the transactional sponsor/relay console
    // (manifest platform.transactions=false): review packages, receipt import,
    // and UserOp verification live in the embedded app. The host must not
    // expose the old checkSponsor/requestSponsor/submitRelay forms.
    expect(aaRelay?.operations ?? []).toEqual([]);
    expect(aaRelay?.detail_template?.operation_panel?.operations ?? []).toEqual(
      [],
    );

    const devTipping = getApp(apps, "miniapp-dev-tipping");
    expect(devTipping?.manifest?.supported_networks).toContain(
      "neo-n3-testnet",
    );
    // Recipient selection, Fixed8 amount validation, payment recovery, and
    // exact event/readback confirmation live in the designed embedded app.
    expect(devTipping?.operations ?? []).toEqual([]);

    const timeCapsule = getApp(apps, "miniapp-time-capsule");
    expect(timeCapsule?.manifest?.supported_networks).toContain(
      "neo-n3-testnet",
    );
    // The standalone capsule owns its draft, lock-period presets, prepay,
    // exact event/readback confirmation, and recovery journal. The host must
    // not recreate that flow as a seven-field operation form.
    expect(timeCapsule?.operations ?? []).toEqual([]);

    const vault = getApp(apps, "miniapp-unbreakablevault");
    expect(vault?.manifest?.supported_networks).toContain("neo-n3-testnet");
    // The standalone vault owns its multi-step create/break/recover workflow.
    // Its explicit empty host panel must suppress the old generic proof form.
    expect(vault?.operations ?? []).toEqual([]);
  });

  it("exposes oracle fee funding before VRF game actions for oracle-backed apps", async () => {
    process.env.MINIAPP_DEFINITIONS_DIR = path.resolve(
      __dirname,
      "../../public/miniapp-definitions",
    );

    const apps = await loadMiniAppDefinitions();
    // Red Envelope still settles its lucky split via the Morpheus oracle, so
    // it keeps the oracle fee-funding action before the VRF-backed action.
    const oracleVrfActionByAppId = {
      "miniapp-redenvelope": "createEnvelope",
    } as const;

    for (const [appId, actionMethod] of Object.entries(oracleVrfActionByAppId)) {
      const app = getApp(apps, appId);
      const methods = app?.operations?.map((operation) => operation.method);
      expect(methods).toContain("fundOracleRequestFee");
      const oracleIndex = methods?.indexOf("fundOracleRequestFee") ?? -1;
      const playIndex = methods?.indexOf(actionMethod) ?? -1;
      expect(oracleIndex).toBeGreaterThan(-1);
      expect(playIndex).toBeGreaterThan(oracleIndex);
    }
  });

  it("does not expose a phantom oracle fee button on atomic-settlement games", async () => {
    process.env.MINIAPP_DEFINITIONS_DIR = path.resolve(
      __dirname,
      "../../public/miniapp-definitions",
    );

    const apps = await loadMiniAppDefinitions();
    // FogPlay's current release is guest-only until its paid settlement path is
    // revalidated, so the host must not resurrect any historical funding form.
    const fogplayMethods =
      getApp(apps, "miniapp-fogplay")?.operations?.map(
        (operation) => operation.method,
      ) ?? [];
    expect(fogplayMethods).toEqual([]);

    // Dice is fail-closed while its bound Neo N3 settlement bytecode is
    // incompatible with the audited source artifact. The host must expose no
    // GAS-funding or paid-roll operation until a compatible deployment is bound.
    const diceMethods =
      getApp(apps, "miniapp-dice-game")?.operations?.map(
        (operation) => operation.method,
      ) ?? [];
    expect(diceMethods).toEqual([]);
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
      path.join(definitionsDir, "neo-pay-shared-example.json"),
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
    // Manifest v1.1.0 (NeoPay Stream Studio) intentionally retired the
    // host-side operation panel and top-level operations: the embedded studio
    // owns stream creation. The shared-runtime composition metadata — the
    // createSharedStream operation recipe — must still survive the bundled
    // manifest merge, which is what this guard now pins.
    expect(app?.operations ?? []).toEqual([]);
    expect(app?.detail_template?.operation_panel?.operations ?? []).toEqual([]);
    expect(
      (
        app?.manifest?.frontend_composition as {
          operation_recipes?: Array<{ operation?: string }>;
        }
      )?.operation_recipes?.[0]?.operation,
    ).toBe("createSharedStream");
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

  it("keeps Graveyard mutations inside the designed embedded Memory Garden", async () => {
    const app = await loadBundledMiniAppById("miniapp-graveyard");

    expect(app).toEqual(
      expect.objectContaining({
        app_id: "miniapp-graveyard",
        dapp_url: "/miniapps/graveyard/index.html",
      }),
    );
    expect(app?.operations ?? []).toEqual([]);
    expect(app?.detail_template?.operation_panel?.operations ?? []).toEqual([]);
    expect(
      (app?.manifest?.operation_panel as { operations?: unknown[] })?.operations,
    ).toEqual([]);
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
        "  logo: https://cdn.example.com/yaml/logo.webp",
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

  it("keeps bundled SelfLoan host operations aligned with the deployed MiniAppSelfLoan ABI", async () => {
    const app = await loadBundledMiniAppById("miniapp-self-loan");
    const operations = app?.operations ?? [];
    const byMethod = new Map(operations.map((operation) => [operation.method, operation] as const));

    // The deployed contract exposes borrow(borrower, tier), repay(borrower) and
    // addCollateral(borrower) — there is no createLoan/repayLoan/repayDebt and no
    // syncProfitAnchorVote method (one loan per borrower, no loanId).
    expect(byMethod.has("createLoan")).toBe(false);
    expect(byMethod.has("repayLoan")).toBe(false);
    expect(byMethod.has("repayDebt")).toBe(false);
    expect(byMethod.has("syncProfitAnchorVote")).toBe(false);
    expect(byMethod.get("borrow")?.params?.map((param) => [param.name, param.type])).toEqual([
      ["borrower", "hash160"],
      ["collateralNeo", "integer"],
      ["tier", "select"],
      ["poolTopupGas", "amount"],
    ]);
    expect(byMethod.get("repay")?.params?.map((param) => [param.name, param.type])).toEqual([
      ["borrower", "hash160"],
      ["repayGas", "amount"],
    ]);
    expect(byMethod.get("addCollateral")?.params?.map((param) => [param.name, param.type])).toEqual([
      ["borrower", "hash160"],
      ["collateralNeo", "integer"],
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

  it("keeps LastSurvivor's retired paid lifecycle out of the guest release", async () => {
    delete process.env.MINIAPP_DEFINITIONS_DIR;

    const app = await loadBundledMiniAppById("miniapp-last-survivor");
    expect(app?.operations ?? []).toEqual([]);
    expect(app?.manifest?.runtime).toBeUndefined();
    expect(app?.manifest?.platform).toEqual(
      expect.objectContaining({ transactions: false }),
    );
  });

  it("does not let a stale public definition re-enable LastSurvivor funding", async () => {
    const definitionsDir = path.join(tempRoot, "defs-stale-last-survivor");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;
    fs.writeFileSync(
      path.join(definitionsDir, "last-survivor.json"),
      JSON.stringify(
        {
          app_id: "miniapp-last-survivor",
          name: "Stale paid LastSurvivor",
          operations: [
            {
              name: "Fund Keys",
              method: "fundGameCredit",
              params: [{ name: "amount", type: "amount", scale: 8 }],
            },
          ],
          manifest: {
            runtime: {
              mode: "platform",
              modules: [{ appId: "miniapp-last-survivor" }],
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    const app = getApp(apps, "miniapp-last-survivor");
    expect(app?.operations ?? []).toEqual([]);
    expect(app?.manifest?.runtime).toBeUndefined();
  });


  it("preserves platform runtime metadata from top-level definitions", async () => {
    const definitionsDir = path.join(tempRoot, "defs-runtime");
    fs.mkdirSync(definitionsDir, { recursive: true });
    process.env.MINIAPP_DEFINITIONS_DIR = definitionsDir;

    fs.writeFileSync(
      path.join(definitionsDir, "runtime-game.json"),
      JSON.stringify(
        {
          app_id: "miniapp-runtime-game",
          name: "Runtime Game",
          entry_url: "mf://manifest?app=miniapp-runtime-game",
          runtime: {
            mode: "platform",
            modules: [
              {
                binding: "countdown-auction",
                platform: "PlatformGame",
                appId: "runtime-game",
                moduleType: 1,
                networks: {
                  "neo-n3-testnet": {
                    contract_hash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
                    registered: true,
                  },
                },
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const apps = await loadMiniAppDefinitions();
    expect(getApp(apps, "miniapp-runtime-game")?.manifest).toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({
          mode: "platform",
          modules: expect.arrayContaining([
            expect.objectContaining({
              platform: "PlatformGame",
              appId: "runtime-game",
            }),
          ]),
        }),
      }),
    );
  });

  it("loads platform runtime metadata for platform-backed flagship apps", async () => {
    delete process.env.MINIAPP_DEFINITIONS_DIR;

    const guestOnly = await loadBundledMiniAppById("miniapp-last-survivor");
    expect(guestOnly?.manifest?.runtime).toBeUndefined();

    const standaloneSelfLoan = await loadBundledMiniAppById("miniapp-self-loan");
    expect(standaloneSelfLoan?.manifest?.runtime).toBeUndefined();

    const apps = await Promise.all([
      loadBundledMiniAppById("miniapp-profitanchor"),
      loadBundledMiniAppById("miniapp-trustanchor"),
    ]);

    for (const app of apps) {
      expect(app?.manifest).toEqual(
        expect.objectContaining({
          runtime: expect.objectContaining({
            mode: "platform",
            modules: expect.arrayContaining([
              expect.objectContaining({
                appId: expect.any(String),
                platform: expect.stringMatching(/^Platform/),
                networks: expect.any(Object),
              }),
            ]),
          }),
        }),
      );
      const runtime = app?.manifest?.runtime as { modules?: Array<{ appId?: string }> } | undefined;
      expect(runtime?.modules?.[0]?.appId).toBe(app?.app_id);
    }
  });

  it("keeps raw public definitions non-interactive for transaction-free releases", () => {
    const appsDir = path.resolve(process.cwd(), "../../apps");
    const definitionsDir = path.resolve(
      process.cwd(),
      "public/miniapp-definitions",
    );
    const hasInteractivePermission = (
      value: unknown,
      key = "",
    ): boolean => {
      const normalizedKey = key.toLowerCase();
      const readOnlyKey = normalizedKey.startsWith("read")
        || normalizedKey.startsWith("view");
      if (typeof value === "boolean") return value && !readOnlyKey;
      if (typeof value === "number") return value !== 0 && !readOnlyKey;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return Boolean(normalized)
          && !normalized.startsWith("read:")
          && !normalized.startsWith("view:");
      }
      if (Array.isArray(value)) {
        return value.some((entry) => hasInteractivePermission(entry));
      }
      if (!value || typeof value !== "object") return false;
      return Object.entries(value).some(([entryKey, entry]) =>
        hasInteractivePermission(entry, entryKey),
      );
    };

    for (const fileName of fs.readdirSync(definitionsDir)) {
      if (!fileName.endsWith(".json")) continue;
      const slug = path.basename(fileName, ".json");
      const manifestPath = path.join(appsDir, slug, "neo-manifest.json");
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest?.platform?.transactions !== false) continue;

      const definition = JSON.parse(
        fs.readFileSync(path.join(definitionsDir, fileName), "utf-8"),
      );
      const operationGroups = [
        definition.operations,
        definition?.frontend_spec?.operation_panel?.operations,
        definition?.detail_template?.operation_panel?.operations,
        definition?.manifest?.operations,
        definition?.manifest?.operation_panel?.operations,
      ];
      const operations = operationGroups.flatMap((group) =>
        Array.isArray(group) ? group : [],
      );

      expect({ slug, operations }).toEqual({ slug, operations: [] });
      expect({
        slug,
        runtime: definition.runtime ?? definition?.manifest?.runtime,
      }).toEqual({ slug, runtime: undefined });
      expect({
        slug,
        deployment:
          definition.deployment ?? definition?.manifest?.deployment,
      }).toEqual({ slug, deployment: undefined });
      expect({
        slug,
        interactivePermissions:
          hasInteractivePermission(definition.permissions)
          || hasInteractivePermission(definition?.manifest?.permissions),
      }).toEqual({ slug, interactivePermissions: false });
    }
  });
});
