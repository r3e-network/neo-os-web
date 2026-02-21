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
    it("returns primary JPG paths under /miniapp-assets", () => {
      expect(getMiniAppPrimaryAssets("miniapp-lottery", "/miniapps/lottery/")).toEqual({
        logoURL: "/miniapp-assets/lottery/logo.jpg",
        bannerURL: "/miniapp-assets/lottery/banner.jpg",
      });
    });
  });

  describe("buildMiniAppLogoSources", () => {
    it("prioritizes explicit URL and includes compatible fallback logo paths", () => {
      expect(
        buildMiniAppLogoSources({
          appID: "miniapp-lottery",
          entryURL: "/miniapps/lottery/",
          logoURL: "/custom/logo.png",
        }),
      ).toEqual([
        "/custom/logo.png",
        "/miniapp-assets/lottery/logo.jpg",
        "/miniapp-assets/lottery/logo.png",
        "/miniapp-assets/lottery/logo.jpeg",
        "/miniapp-assets/lottery/logo.svg",
        "/miniapps/lottery/logo.jpg",
        "/miniapps/lottery/logo.png",
        "/miniapps/lottery/logo.jpeg",
        "/miniapps/lottery/logo.svg",
        "/miniapps/lottery/public/logo.jpg",
        "/miniapps/lottery/public/logo.png",
        "/miniapps/lottery/public/logo.jpeg",
        "/miniapps/lottery/public/logo.svg",
      ]);
    });
  });

  describe("buildMiniAppBannerSources", () => {
    it("includes compatible fallback banner paths", () => {
      expect(
        buildMiniAppBannerSources({
          appID: "miniapp-lottery",
          entryURL: "/miniapps/lottery/",
        }),
      ).toEqual([
        "/miniapp-assets/lottery/banner.jpg",
        "/miniapp-assets/lottery/banner.png",
        "/miniapp-assets/lottery/banner.jpeg",
        "/miniapp-assets/lottery/banner.svg",
        "/miniapps/lottery/banner.jpg",
        "/miniapps/lottery/banner.png",
        "/miniapps/lottery/banner.jpeg",
        "/miniapps/lottery/banner.svg",
        "/miniapps/lottery/public/banner.jpg",
        "/miniapps/lottery/public/banner.png",
        "/miniapps/lottery/public/banner.jpeg",
        "/miniapps/lottery/public/banner.svg",
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

      expect(app.logo_url).toBe("/miniapp-assets/coin-flip/logo.jpg");
      expect(app.banner_url).toBe("/miniapp-assets/coin-flip/banner.jpg");
    });
  });
});
