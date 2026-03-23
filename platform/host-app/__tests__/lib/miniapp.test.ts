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
