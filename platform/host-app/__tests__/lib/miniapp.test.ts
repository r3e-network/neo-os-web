import { coerceMiniAppInfo } from "@/lib/miniapp";
import { applyBuiltInMiniAppDefaults } from "@/lib/miniapp-builtins";

describe("miniapp coercion", () => {
  const originalTargetNetwork = process.env.NEO_TARGET_NETWORK;

  afterEach(() => {
    if (originalTargetNetwork === undefined) {
      delete process.env.NEO_TARGET_NETWORK;
    } else {
      process.env.NEO_TARGET_NETWORK = originalTargetNetwork;
    }
  });

  it("reads presentation + stats flags from manifest fallback fields", () => {
    const app = coerceMiniAppInfo({
      app_id: "miniapp-manifest-fallback",
      entry_url: "https://example.com/miniapp",
      manifest: {
        name: "Manifest Name",
        description: "Manifest description",
        icon: "🧪",
        category: "defi",
        news_integration: false,
        stats_display: ["tx_count", "daily_active_users"],
        logo_url: "https://cdn.example.com/logo.png",
        banner_url: "https://cdn.example.com/banner.png",
        docs_url: "https://docs.example.com/app",
      },
      permissions: {
        payments: true,
      },
    });

    expect(app).not.toBeNull();
    if (!app) return;

    expect(app.name).toBe("Manifest Name");
    expect(app.news_integration).toBe(false);
    expect(app.stats_display).toEqual(["total_transactions", "daily_active_users"]);
    expect(app.logo_url).toBe("https://cdn.example.com/logo.png");
    expect(app.banner_url).toBe("https://cdn.example.com/banner.png");
    expect(app.docs_url).toBe("https://docs.example.com/app");
  });

  it("uses manifest urls for bundled dapp media before generic fallbacks", () => {
    const app = coerceMiniAppInfo({
      app_id: "miniapp-svg-media",
      entry_url: "/miniapps/svg-media/index.html",
      manifest: {
        urls: {
          icon: "/miniapps/svg-media/logo.svg",
          banner: "/miniapps/svg-media/banner.svg",
        },
      },
      permissions: {},
    });

    expect(app?.logo_url).toBe("/miniapps/svg-media/logo.svg");
    expect(app?.banner_url).toBe("/miniapps/svg-media/banner.svg");
  });

  it("prefers manifest network contracts over a stale top-level contract hash", () => {
    process.env.NEO_TARGET_NETWORK = "testnet";

    const app = coerceMiniAppInfo({
      app_id: "miniapp-network-aware",
      entry_url: "https://example.com/network-aware",
      contract_hash: "0x1111111111111111111111111111111111111111",
      manifest: {
        default_network: "neo-n3-mainnet",
        contracts: {
          "neo-n3-mainnet": "0x1111111111111111111111111111111111111111",
          "neo-n3-testnet": "0x2222222222222222222222222222222222222222",
        },
      },
      permissions: {},
    });

    expect(app).not.toBeNull();
    if (!app) return;

    expect(app.contract_hash).toBe("0x2222222222222222222222222222222222222222");
  });

  it("normalizes bare .matrix entry urls and preserves aa permissions", () => {
    const app = coerceMiniAppInfo({
      app_id: "miniapp-matrix-aa",
      entry_url: "wallet.matrix/apps/aa",
      permissions: {
        aa: true,
      },
    });

    expect(app).not.toBeNull();
    if (!app) return;

    expect(app.entry_url).toBe("https://wallet.matrix/apps/aa");
    expect(app.permissions.aa).toBe(true);
  });

  it("allows same-origin published miniapp entries", () => {
    const app = coerceMiniAppInfo({
      app_id: "miniapp-local-production",
      entry_url: "/miniapps/local-production/index.html",
      permissions: {},
    });

    expect(app?.entry_url).toBe("/miniapps/local-production/index.html");
  });

  it("maps legacy bundled manifest category aliases into host categories", () => {
    const cases = [
      ["games", "gaming"],
      ["game", "gaming"],
      ["finance", "defi"],
      ["tools", "utility"],
      ["tool", "utility"],
      ["oracle", "data"],
    ] as const;

    for (const [rawCategory, normalizedCategory] of cases) {
      const app = coerceMiniAppInfo({
        app_id: `miniapp-category-${rawCategory}`,
        entry_url: `https://example.com/${rawCategory}`,
        category: rawCategory,
        permissions: {},
      });

      expect(app?.category).toBe(normalizedCategory);
    }
  });

  it("defaults non-flagship miniapps to beta while preserving flagship active state", () => {
    const nonFlagship = applyBuiltInMiniAppDefaults({
      app_id: "miniapp-on-chain-tarot",
      name: "On-Chain Tarot",
      description: "utility app",
      icon: "🔮",
      category: "utility",
      entry_url: "mf://manifest?app=miniapp-on-chain-tarot",
      permissions: {},
      status: null,
    });

    const flagship = applyBuiltInMiniAppDefaults({
      app_id: "miniapp-neo-pay",
      name: "NeoPay",
      description: "flagship app",
      icon: "💸",
      category: "defi",
      entry_url: "mf://manifest?app=miniapp-neo-pay",
      permissions: {},
      status: "active",
    });

    expect(nonFlagship.status).toBe("beta");
    expect(flagship.status).toBe("active");
  });
});
