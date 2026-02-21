import { coerceMiniAppInfo } from "@/lib/miniapp";

describe("miniapp coercion", () => {
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
});
