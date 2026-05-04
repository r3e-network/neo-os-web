import {
  buildMiniAppBannerSources,
  buildMiniAppLogoSources,
  buildModernImageSources,
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
      expect(resolveMiniAppSlug("miniapp-redenvelope", "mf://manifest?app=miniapp-redenvelope")).toBe("red-envelope");
      expect(resolveMiniAppSlug("miniapp-neo-swap", "mf://manifest?app=miniapp-neo-swap")).toBe("neo-swap");
      expect(resolveMiniAppSlug("miniapp-breakupcontract", "mf://manifest?app=miniapp-breakupcontract")).toBe(
        "breakup-contract",
      );
      expect(resolveMiniAppSlug("miniapp-onchaintarot", "mf://manifest?app=miniapp-onchaintarot")).toBe(
        "on-chain-tarot",
      );
      expect(resolveMiniAppSlug("miniapp-unbreakablevault", "mf://manifest?app=miniapp-unbreakablevault")).toBe(
        "unbreakable-vault",
      );
    });

    it("uses current flagship asset slugs for legacy catalog entry URLs", () => {
      expect(resolveMiniAppSlug("miniapp-doomsday-clock", "/miniapps/doomsday-clock/")).toBe(
        "last-survivor",
      );
      expect(resolveMiniAppSlug("miniapp-neo-gacha", "/miniapps/neo-gacha/")).toBe("gasbox");
      expect(resolveMiniAppSlug("miniapp-coinflip", "/miniapps/coin-flip/")).toBe("fogplay");
      expect(resolveMiniAppSlug("miniapp-stream-vault", "/miniapps/stream-vault/")).toBe("neo-pay");
    });
  });

  describe("getMiniAppPrimaryAssets", () => {
    it("returns primary JPEG paths under /miniapp-assets", () => {
      expect(getMiniAppPrimaryAssets("miniapp-gasbox", "/miniapps/gasbox/")).toEqual({
        logoURL: "/miniapp-assets/gasbox/logo.jpg",
        bannerURL: "/miniapp-assets/gasbox/banner.jpg",
      });
    });

    it("uses generated host media for current compact app aliases", () => {
      expect(getMiniAppPrimaryAssets("miniapp-redenvelope", "mf://manifest?app=miniapp-redenvelope")).toEqual({
        logoURL: "/miniapp-assets/red-envelope/logo.jpg",
        bannerURL: "/miniapp-assets/red-envelope/banner.jpg",
      });
      expect(getMiniAppPrimaryAssets("miniapp-neo-swap", "mf://manifest?app=miniapp-neo-swap")).toEqual({
        logoURL: "/miniapp-assets/neo-swap/logo.jpg",
        bannerURL: "/miniapp-assets/neo-swap/banner.jpg",
      });
    });
  });

  describe("buildMiniAppLogoSources", () => {
    it("prioritizes explicit URL and includes compatible fallback logo paths", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-gasbox",
        entryURL: "/miniapps/gasbox/",
        logoURL: "/custom/logo.png",
      });

      expect(result[0]).toBe("/custom/logo.png");
      expect(result).toEqual(
        expect.arrayContaining([
          "/miniapp-assets/gasbox/logo.jpg",
          "/miniapp-assets/gasbox/logo.svg",
          "/miniapp-assets/gasbox/logo.png",
          "/miniapps/gasbox/logo.jpg",
          "/miniapps/gasbox/logo.svg",
          "/miniapps/gasbox/public/logo.jpg",
          "/miniapps/gasbox/public/logo.svg",
          "/miniapps/gasbox/static/icon.svg",
        ]),
      );
    });

    it("prefers generated host icons for apps with legacy static media", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-redenvelope",
        entryURL: "mf://manifest?app=miniapp-redenvelope",
      });

      expect(result[0]).toBe("/miniapp-assets/red-envelope/logo.jpg");
      expect(result).toEqual(expect.arrayContaining(["/miniapps/red-envelope/static/icon.svg"]));
    });

    it("demotes legacy bundled manifest media behind generated host assets", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-self-loan",
        entryURL: "mf://manifest?app=miniapp-self-loan",
        logoURL: "/miniapps/self-loan/logo.jpg",
      });

      expect(result[0]).toBe("/miniapp-assets/self-loan/logo.jpg");
      expect(result).toContain("/miniapps/self-loan/logo.jpg");
    });

    it("prioritizes best matching logo variant by theme/locale", () => {
      expect(
        buildMiniAppLogoSources({
          appID: "miniapp-gasbox",
          entryURL: "/miniapps/gasbox/",
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
        appID: "miniapp-gasbox",
        entryURL: "/miniapps/gasbox/",
      });

      expect(result).toEqual(
        expect.arrayContaining([
          "/miniapp-assets/gasbox/banner.jpg",
          "/miniapp-assets/gasbox/banner.svg",
          "/miniapp-assets/gasbox/banner.png",
          "/miniapps/gasbox/banner.jpg",
          "/miniapps/gasbox/banner.svg",
          "/miniapps/gasbox/public/banner.jpg",
          "/miniapps/gasbox/public/banner.svg",
          "/miniapps/gasbox/static/banner.svg",
        ]),
      );
    });

    it("prefers generated host banners for apps with legacy static media", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-neo-swap",
        entryURL: "mf://manifest?app=miniapp-neo-swap",
      });

      expect(result[0]).toBe("/miniapp-assets/neo-swap/banner.jpg");
      expect(result).toEqual(expect.arrayContaining(["/miniapps/neo-swap/static/banner.svg"]));
    });

    it("demotes legacy bundled banner media behind generated host assets", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-self-loan",
        entryURL: "mf://manifest?app=miniapp-self-loan",
        bannerURL: "/miniapps/self-loan/banner.jpg",
      });

      expect(result[0]).toBe("/miniapp-assets/self-loan/banner.jpg");
      expect(result).toContain("/miniapps/self-loan/banner.jpg");
    });

    it("prioritizes best matching banner variant by theme", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-gasbox",
        entryURL: "/miniapps/gasbox/",
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
        app_id: "miniapp-neo-swap",
        entry_url: "mf://manifest?app=miniapp-neo-swap",
        name: "Neo Swap",
        description: "test",
        icon: "📊",
        category: "defi",
      });

      expect(app.logo_url).toBe("/miniapp-assets/neo-swap/logo.jpg");
      expect(app.banner_url).toBe("/miniapp-assets/neo-swap/banner.jpg");
    });

    it("reuses NeoPay media for the shared-mode example", () => {
      const app = withMiniAppCardAssets({
        app_id: "miniapp-neo-pay-shared-example",
        entry_url: "mf://manifest?app=miniapp-neo-pay-shared-example",
        name: "NeoPay Modular Fixture",
        description: "test",
        icon: "💳",
        category: "defi",
      });

      expect(app.logo_url).toBe("/miniapp-assets/neo-pay/logo.jpg");
      expect(app.banner_url).toBe("/miniapp-assets/neo-pay/banner.jpg");
    });
  });

  describe("buildModernImageSources", () => {
    it("does not invent speculative modern asset URLs", () => {
      expect(buildModernImageSources("/miniapp-assets/fogplay/banner.jpg")).toEqual({});
    });

    it("keeps external and vector assets on their original source", () => {
      expect(buildModernImageSources("https://cdn.example.com/logo.jpg")).toEqual({});
      expect(buildModernImageSources("/miniapp-assets/fogplay/logo.svg")).toEqual({});
    });
  });
});
