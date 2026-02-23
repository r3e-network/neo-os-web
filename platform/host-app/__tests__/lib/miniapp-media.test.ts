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
      expect(resolveMiniAppSlug("miniapp-candidate-vote", "mf://manifest?app=miniapp-candidate-vote")).toBe(
        "candidate-vote",
      );
    });

    it("maps known compact app ids to canonical asset slugs", () => {
      expect(resolveMiniAppSlug("miniapp-coinflip", "mf://manifest?app=miniapp-coinflip")).toBe("coin-flip");
      expect(resolveMiniAppSlug("miniapp-dicegame", "mf://manifest?app=miniapp-dicegame")).toBe("dice-game");
      expect(resolveMiniAppSlug("miniapp-predictionmarket", "mf://manifest?app=miniapp-predictionmarket")).toBe(
        "prediction-market",
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

    it("uses static miniapp assets for app ids without miniapp-assets jpgs", () => {
      expect(getMiniAppPrimaryAssets("miniapp-dicegame", "mf://manifest?app=miniapp-dicegame")).toEqual({
        logoURL: "/miniapps/dice-game/static/icon.svg",
        bannerURL: "/miniapps/dice-game/static/banner.svg",
      });
      expect(getMiniAppPrimaryAssets("miniapp-secretvote", "mf://manifest?app=miniapp-secretvote")).toEqual({
        logoURL: "/miniapps/secret-vote/static/icon.svg",
        bannerURL: "/miniapps/secret-vote/static/banner.svg",
      });
    });
  });

  describe("buildMiniAppLogoSources", () => {
    it("prioritizes explicit URL and includes compatible fallback logo paths", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-lottery",
        entryURL: "/miniapps/lottery/",
        logoURL: "/custom/logo.png",
      });

      expect(result[0]).toBe("/custom/logo.png");
      expect(result).toEqual(
        expect.arrayContaining([
          "/miniapp-assets/lottery/logo.jpg",
          "/miniapp-assets/lottery/logo.png",
          "/miniapps/lottery/logo.jpg",
          "/miniapps/lottery/public/logo.jpg",
          "/miniapps/lottery/static/icon.svg",
        ]),
      );
    });

    it("prefers static icon assets for apps without jpg media", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-dicegame",
        entryURL: "mf://manifest?app=miniapp-dicegame",
      });

      expect(result[0]).toBe("/miniapps/dice-game/static/icon.svg");
      expect(result).toEqual(expect.arrayContaining(["/miniapps/dice-game/static/icon.svg"]));
    });

    it("prioritizes best matching logo variant by theme/locale", () => {
      expect(
        buildMiniAppLogoSources({
          appID: "miniapp-lottery",
          entryURL: "/miniapps/lottery/",
          manifest: {
            media: {
              logo_variants: [
                { url: "https://cdn.example.com/logo-any.png", theme: "any" },
                { url: "https://cdn.example.com/logo-zh-dark.png", theme: "dark", locale: "zh-CN" },
                { url: "https://cdn.example.com/logo-en-dark.png", theme: "dark", locale: "en" },
              ],
            },
          },
          preferences: {
            theme: "dark",
            locale: "zh-CN",
          },
        }),
      ).toEqual(
        expect.arrayContaining([
          "https://cdn.example.com/logo-zh-dark.png",
          "https://cdn.example.com/logo-en-dark.png",
          "https://cdn.example.com/logo-any.png",
        ]),
      );
    });
  });

  describe("buildMiniAppBannerSources", () => {
    it("includes compatible fallback banner paths", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-lottery",
        entryURL: "/miniapps/lottery/",
      });

      expect(result).toEqual(
        expect.arrayContaining([
          "/miniapp-assets/lottery/banner.jpg",
          "/miniapp-assets/lottery/banner.png",
          "/miniapps/lottery/banner.jpg",
          "/miniapps/lottery/public/banner.jpg",
          "/miniapps/lottery/static/banner.svg",
        ]),
      );
    });

    it("prefers static banner assets for apps without jpg media", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-secretvote",
        entryURL: "mf://manifest?app=miniapp-secretvote",
      });

      expect(result[0]).toBe("/miniapps/secret-vote/static/banner.svg");
      expect(result).toEqual(expect.arrayContaining(["/miniapps/secret-vote/static/banner.svg"]));
    });

    it("prioritizes best matching banner variant by theme", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-lottery",
        entryURL: "/miniapps/lottery/",
        manifest: {
          media: {
            banner_variants: [
              { url: "https://cdn.example.com/banner-light.png", theme: "light" },
              { url: "https://cdn.example.com/banner-dark.png", theme: "dark" },
            ],
          },
        },
        preferences: {
          theme: "dark",
        },
      });

      expect(result[0]).toBe("https://cdn.example.com/banner-dark.png");
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

    it("fills manifest-mode app media from canonical aliases", () => {
      const app = withMiniAppCardAssets({
        app_id: "miniapp-predictionmarket",
        entry_url: "mf://manifest?app=miniapp-predictionmarket",
        name: "Prediction Market",
        description: "test",
        icon: "📊",
        category: "defi",
      });

      expect(app.logo_url).toBe("/miniapp-assets/prediction-market/logo.jpg");
      expect(app.banner_url).toBe("/miniapp-assets/prediction-market/banner.jpg");
    });
  });
});
