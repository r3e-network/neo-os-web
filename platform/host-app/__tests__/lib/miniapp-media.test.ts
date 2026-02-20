import {
  buildMiniAppBannerSources,
  buildMiniAppLogoSources,
  getMiniAppPrimaryAssets,
  resolveMiniAppSlug,
  withMiniAppCardAssets,
} from "@/lib/miniapp-media";

describe("miniapp-media helpers", () => {
  describe("resolveMiniAppSlug", () => {
    it("extracts slug from /miniapps entry URL", () => {
      expect(resolveMiniAppSlug("miniapp-coinflip", "/miniapps/coin-flip/")).toBe("coin-flip");
    });

    it("extracts slug from /miniapp-assets entry URL", () => {
      expect(resolveMiniAppSlug("miniapp-coinflip", "/miniapp-assets/coin-flip/index.html")).toBe("coin-flip");
    });

    it("falls back to app_id when entry URL is not static", () => {
      expect(resolveMiniAppSlug("miniapp-candidate-vote", "mf://builtin?app=miniapp-candidate-vote")).toBe(
        "candidate-vote",
      );
    });
  });

  describe("getMiniAppPrimaryAssets", () => {
    it("returns banner.png/logo.png paths", () => {
      expect(getMiniAppPrimaryAssets("miniapp-lottery", "/miniapps/lottery/")).toEqual({
        logoURL: "/miniapps/lottery/logo.png",
        bannerURL: "/miniapps/lottery/banner.png",
      });
    });
  });

  describe("buildMiniAppLogoSources", () => {
    it("prioritizes explicit URL and includes compatibility fallbacks", () => {
      expect(
        buildMiniAppLogoSources({
          appID: "miniapp-lottery",
          entryURL: "/miniapps/lottery/",
          logoURL: "/custom/logo.png",
        }),
      ).toEqual([
        "/custom/logo.png",
        "/miniapps/lottery/logo.png",
        "/miniapps/lottery/logo.jpg",
        "/miniapp-assets/lottery/logo.jpg",
        "/miniapps/lottery/static/logo.png",
        "/miniapp-assets/lottery/static/logo.png",
        "/miniapps/lottery/static/icon.svg",
        "/miniapp-assets/lottery/static/icon.svg",
      ]);
    });
  });

  describe("buildMiniAppBannerSources", () => {
    it("includes primary and legacy banner paths", () => {
      expect(
        buildMiniAppBannerSources({
          appID: "miniapp-lottery",
          entryURL: "/miniapps/lottery/",
        }),
      ).toEqual([
        "/miniapps/lottery/banner.png",
        "/miniapps/lottery/banner.jpg",
        "/miniapp-assets/lottery/banner.jpg",
        "/miniapps/lottery/static/banner.svg",
        "/miniapp-assets/lottery/static/banner.svg",
      ]);
    });
  });

  describe("withMiniAppCardAssets", () => {
    it("fills missing card media fields from convention", () => {
      const app = withMiniAppCardAssets({
        app_id: "miniapp-coinflip",
        entry_url: "/miniapps/coin-flip/",
        name: "Coin Flip",
        description: "test",
        icon: "🪙",
        category: "gaming",
      });

      expect(app.logo_url).toBe("/miniapps/coin-flip/logo.png");
      expect(app.banner_url).toBe("/miniapps/coin-flip/banner.png");
    });
  });
});
