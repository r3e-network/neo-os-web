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
      expect(resolveMiniAppSlug("miniapp-fogplay", "/miniapps/fogplay/")).toBe("fogplay");
    });

    it("extracts slug from /miniapp-assets entry URL", () => {
      expect(resolveMiniAppSlug("miniapp-fogplay", "/miniapp-assets/fogplay/index.html")).toBe("fogplay");
    });

    it("falls back to app_id when entry URL is not static", () => {
      expect(resolveMiniAppSlug("miniapp-candidate-vote", "mf://manifest?app=miniapp-candidate-vote")).toBe(
        "candidate-vote",
      );
    });

    it("maps known compact app ids to canonical asset slugs", () => {
      expect(resolveMiniAppSlug("miniapp-fogplay", "mf://manifest?app=miniapp-fogplay")).toBe("fogplay");
      expect(resolveMiniAppSlug("miniapp-dicegame", "mf://manifest?app=miniapp-dicegame")).toBe("dice-game");
      expect(resolveMiniAppSlug("miniapp-predictionmarket", "mf://manifest?app=miniapp-predictionmarket")).toBe(
        "prediction-market",
      );
    });
  });

  describe("getMiniAppPrimaryAssets", () => {
    it("returns primary JPEG paths under /miniapp-assets", () => {
      expect(getMiniAppPrimaryAssets("miniapp-lottery", "/miniapps/lottery/")).toEqual({
        logoURL: "/miniapp-assets/lottery/logo.jpg",
        bannerURL: "/miniapp-assets/lottery/banner.jpg",
      });
    });

    it("uses generated host media for compact app aliases", () => {
      expect(getMiniAppPrimaryAssets("miniapp-dicegame", "mf://manifest?app=miniapp-dicegame")).toEqual({
        logoURL: "/miniapp-assets/dice-game/logo.jpg",
        bannerURL: "/miniapp-assets/dice-game/banner.jpg",
      });
      expect(getMiniAppPrimaryAssets("miniapp-secretvote", "mf://manifest?app=miniapp-secretvote")).toEqual({
        logoURL: "/miniapp-assets/secret-vote/logo.jpg",
        bannerURL: "/miniapp-assets/secret-vote/banner.jpg",
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
          "/miniapp-assets/lottery/logo.svg",
          "/miniapp-assets/lottery/logo.png",
          "/miniapps/lottery/logo.jpg",
          "/miniapps/lottery/logo.svg",
          "/miniapps/lottery/public/logo.jpg",
          "/miniapps/lottery/public/logo.svg",
          "/miniapps/lottery/static/icon.svg",
        ]),
      );
    });

    it("prefers generated host icons for apps with legacy static media", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-dicegame",
        entryURL: "mf://manifest?app=miniapp-dicegame",
      });

      expect(result[0]).toBe("/miniapp-assets/dice-game/logo.jpg");
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
          "/miniapp-assets/lottery/banner.svg",
          "/miniapp-assets/lottery/banner.png",
          "/miniapps/lottery/banner.jpg",
          "/miniapps/lottery/banner.svg",
          "/miniapps/lottery/public/banner.jpg",
          "/miniapps/lottery/public/banner.svg",
          "/miniapps/lottery/static/banner.svg",
        ]),
      );
    });

    it("prefers generated host banners for apps with legacy static media", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-secretvote",
        entryURL: "mf://manifest?app=miniapp-secretvote",
      });

      expect(result[0]).toBe("/miniapp-assets/secret-vote/banner.jpg");
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
        app_id: "miniapp-fogplay",
        entry_url: "/miniapps/fogplay/",
        name: "Coin Flip",
        description: "test",
        icon: "🪙",
        category: "gaming",
      });

      expect(app.logo_url).toBe("/miniapp-assets/fogplay/logo.jpg");
      expect(app.banner_url).toBe("/miniapp-assets/fogplay/banner.jpg");
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
