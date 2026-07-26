import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { isArchivedMiniAppSlug } from "@/lib/archived-miniapps";
import {
  buildMiniAppBannerSources,
  buildMiniAppLogoSources,
  buildModernImageSources,
  getMiniAppPrimaryAssets,
  resolveMiniAppSlug,
  withMiniAppCardAssets,
} from "@/lib/miniapp-media";

describe("miniapp-media helpers", () => {
  const originalMediaBase = process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL;
  const originalAssetBase = process.env.NEXT_PUBLIC_MINIAPP_ASSET_BASE_URL;

  afterEach(() => {
    if (originalMediaBase === undefined) {
      delete process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL = originalMediaBase;
    }

    if (originalAssetBase === undefined) {
      delete process.env.NEXT_PUBLIC_MINIAPP_ASSET_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_MINIAPP_ASSET_BASE_URL = originalAssetBase;
    }
  });

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
        logoURL: "/miniapp-assets/gasbox/logo.webp",
        bannerURL: "/miniapp-assets/gasbox/banner.webp",
      });
    });

    it("uses generated host media for current compact app aliases", () => {
      expect(getMiniAppPrimaryAssets("miniapp-redenvelope", "mf://manifest?app=miniapp-redenvelope")).toEqual({
        logoURL: "/miniapp-assets/red-envelope/logo.webp",
        bannerURL: "/miniapp-assets/red-envelope/banner.webp",
      });
      expect(getMiniAppPrimaryAssets("miniapp-neo-swap", "mf://manifest?app=miniapp-neo-swap")).toEqual({
        logoURL: "/miniapp-assets/neo-swap/logo.webp",
        bannerURL: "/miniapp-assets/neo-swap/banner.webp",
      });
    });

    // Curve Arrow used to be excluded from the host bundle because no
    // `public/miniapp-assets/curve-arrow/` directory existed, which made the generated
    // URL 404 and forced the card onto `/miniapps/curve-arrow/…`. That path is
    // build output (`public/miniapps` is gitignored), so the art only resolved after a
    // bundle build. Its media is bundled now, so it follows the same demotion rule as
    // every other app: host asset first, legacy bundle path retained as a fallback.
    it("serves Curve Arrow from the host bundle and keeps its legacy path as fallback", () => {
      expect(
        getMiniAppPrimaryAssets(
          "miniapp-curve-arrow",
          "/miniapps/curve-arrow/index.html",
        ),
      ).toEqual({
        logoURL: "/miniapp-assets/curve-arrow/logo.webp",
        bannerURL: "/miniapp-assets/curve-arrow/banner.webp",
      });

      const sources = buildMiniAppLogoSources({
        appID: "miniapp-curve-arrow",
        entryURL: "/miniapps/curve-arrow/index.html",
        logoURL: "/miniapps/curve-arrow/logo.webp",
      });
      expect(sources[0]).toBe("/miniapp-assets/curve-arrow/logo.webp");
      expect(sources).toContain("/miniapps/curve-arrow/logo.webp");
    });

    it.each(["arrow-escape", "bead-workshop", "fruit-funnel", "screw-sort"])(
      "resolves the %s migration to canonical host WebP and AVIF media",
      (slug) => {
        expect(
          getMiniAppPrimaryAssets(
            `miniapp-${slug}`,
            `mf://manifest?app=miniapp-${slug}`,
          ),
        ).toEqual({
          logoURL: `/miniapp-assets/${slug}/logo.webp`,
          bannerURL: `/miniapp-assets/${slug}/banner.webp`,
        });
        expect(
          buildModernImageSources(`/miniapp-assets/${slug}/logo.webp`),
        ).toEqual({
          avif: `/miniapp-assets/${slug}/logo.avif`,
          webp: `/miniapp-assets/${slug}/logo.webp`,
        });
        expect(
          buildModernImageSources(`/miniapp-assets/${slug}/banner.webp`),
        ).toEqual({
          avif: `/miniapp-assets/${slug}/banner.avif`,
          webp: `/miniapp-assets/${slug}/banner.webp`,
        });
      },
    );

    it.each(["arrow-escape", "bead-workshop", "fruit-funnel", "screw-sort"])(
      "ships canonical %s media bytes with real AVIF derivatives",
      (slug) => {
        const repoRoot = path.resolve(process.cwd(), "../..");
        for (const asset of ["logo", "banner"] as const) {
          const sourceWebP = readFileSync(
            path.join(repoRoot, "apps", slug, "public", `${asset}.webp`),
          );
          const hostWebP = readFileSync(
            path.join(
              process.cwd(),
              "public",
              "miniapp-assets",
              slug,
              `${asset}.webp`,
            ),
          );
          const hostAVIF = readFileSync(
            path.join(
              process.cwd(),
              "public",
              "miniapp-assets",
              slug,
              `${asset}.avif`,
            ),
          );

          expect(hostWebP.equals(sourceWebP)).toBe(true);
          expect(hostWebP.subarray(0, 4).toString("ascii")).toBe("RIFF");
          expect(hostWebP.subarray(8, 12).toString("ascii")).toBe("WEBP");
          expect(hostAVIF.subarray(4, 12).toString("ascii")).toBe("ftypavif");
          expect(hostAVIF.length).toBeGreaterThan(1024);
        }
      },
    );

    // The per-slug lists above only cover the migrations they were written for, so a
    // newly added app that ships its own artwork can miss the host bundle unnoticed
    // (`getMiniAppPrimaryAssets` then returns null and the launcher card renders no
    // art). Derive the expectation from the source tree instead of a hand-kept list.
    it("bundles host card media for every app that ships its own artwork", () => {
      const repoRoot = path.resolve(process.cwd(), "../..");
      const appsRoot = path.join(repoRoot, "apps");
      const authored = readdirSync(appsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== "shared")
        .map((entry) => entry.name)
        .filter((slug) => !isArchivedMiniAppSlug(slug))
        .filter((slug) => existsSync(path.join(appsRoot, slug, "public", "logo.webp")));

      expect(authored.length).toBeGreaterThan(0);

      const unbundled: string[] = [];
      for (const slug of authored) {
        const assets = getMiniAppPrimaryAssets(`miniapp-${slug}`, `mf://manifest?app=miniapp-${slug}`);
        if (assets.logoURL === null) unbundled.push(slug);
      }
      // A non-empty list names the apps whose public/logo.webp never reached the host bundle.
      expect(unbundled).toEqual([]);
    });

    // `buildModernImageSources` advertises an `.avif` sibling for every bundled WebP,
    // so a WebP-only directory would emit a <source> that 404s.
    it("pairs every bundled WebP with a real AVIF derivative", () => {
      const bundleRoot = path.join(process.cwd(), "public", "miniapp-assets");
      const incomplete: string[] = [];

      for (const entry of readdirSync(bundleRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const asset of ["logo", "banner"] as const) {
          const webp = path.join(bundleRoot, entry.name, `${asset}.webp`);
          if (!existsSync(webp)) continue;
          const avif = path.join(bundleRoot, entry.name, `${asset}.avif`);
          if (!existsSync(avif)) {
            incomplete.push(`${entry.name}/${asset}.avif`);
            continue;
          }
          const bytes = readFileSync(avif);
          if (bytes.subarray(4, 12).toString("ascii") !== "ftypavif" || bytes.length <= 1024) {
            incomplete.push(`${entry.name}/${asset}.avif (not a real AVIF)`);
          }
        }
      }

      expect(incomplete).toEqual([]);
    });

    it("can serve primary assets from an external media base", () => {
      process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL = "https://media.neomini.app";

      expect(getMiniAppPrimaryAssets("miniapp-gasbox", "/miniapps/gasbox/")).toEqual({
        logoURL: "https://media.neomini.app/miniapp-assets/gasbox/logo.webp",
        bannerURL: "https://media.neomini.app/miniapp-assets/gasbox/banner.webp",
      });
    });

    it("does not duplicate the miniapp-assets prefix when the base already includes it", () => {
      process.env.NEXT_PUBLIC_MINIAPP_ASSET_BASE_URL = "https://media.neomini.app/miniapp-assets";

      expect(getMiniAppPrimaryAssets("miniapp-gasbox", "/miniapps/gasbox/")).toEqual({
        logoURL: "https://media.neomini.app/miniapp-assets/gasbox/logo.webp",
        bannerURL: "https://media.neomini.app/miniapp-assets/gasbox/banner.webp",
      });
    });
  });

  describe("buildMiniAppLogoSources", () => {
    it("prioritizes explicit URL and includes compatible fallback logo paths", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-gasbox",
        entryURL: "/miniapps/gasbox/",
        logoURL: "/custom/logo.webp",
      });

      expect(result[0]).toBe("/custom/logo.webp");
      expect(result).toEqual(
        expect.arrayContaining([
          "/miniapp-assets/gasbox/logo.webp",
          "/miniapp-assets/gasbox/logo.svg",
          "/miniapp-assets/gasbox/logo.webp",
          "/miniapps/gasbox/logo.webp",
          "/miniapps/gasbox/logo.svg",
          "/miniapps/gasbox/public/logo.webp",
          "/miniapps/gasbox/public/logo.svg",
          "/miniapps/gasbox/static/icon.svg",
        ]),
      );
    });

    it("rewrites bundled fallback logo paths to the configured media base", () => {
      process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL = "https://media.neomini.app";
      const result = buildMiniAppLogoSources({
        appID: "miniapp-gasbox",
        entryURL: "/miniapps/gasbox/",
        logoURL: "/custom/logo.webp",
      });

      expect(result[0]).toBe("/custom/logo.webp");
      expect(result).toEqual(
        expect.arrayContaining([
          "https://media.neomini.app/miniapp-assets/gasbox/logo.webp",
          "https://media.neomini.app/miniapp-assets/gasbox/logo.svg",
          "/miniapps/gasbox/logo.webp",
        ]),
      );
    });

    it("rewrites explicit bundled logo URLs to the configured media base", () => {
      process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL = "https://media.neomini.app";
      const result = buildMiniAppLogoSources({
        appID: "miniapp-gasbox",
        entryURL: "/miniapps/gasbox/",
        logoURL: "/miniapp-assets/custom-app/logo.webp",
      });

      expect(result[0]).toBe("https://media.neomini.app/miniapp-assets/custom-app/logo.webp");
    });

    it("ignores non-image explicit logo values from catalog metadata", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-token-minter",
        entryURL: "mf://manifest?app=miniapp-token-minter",
        logoURL: "🧩",
      });

      expect(result).not.toContain("🧩");
      expect(result[0]).toBe("/miniapps/token-minter/public/logo.webp");
    });

    it("prefers generated host icons for apps with legacy static media", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-redenvelope",
        entryURL: "mf://manifest?app=miniapp-redenvelope",
      });

      expect(result[0]).toBe("/miniapp-assets/red-envelope/logo.webp");
      expect(result).toEqual(expect.arrayContaining(["/miniapps/red-envelope/static/icon.svg"]));
    });

    it("demotes legacy bundled manifest media behind generated host assets", () => {
      const result = buildMiniAppLogoSources({
        appID: "miniapp-self-loan",
        entryURL: "mf://manifest?app=miniapp-self-loan",
        logoURL: "/miniapps/self-loan/logo.webp",
      });

      expect(result[0]).toBe("/miniapp-assets/self-loan/logo.webp");
      expect(result).toContain("/miniapps/self-loan/logo.webp");
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
          "/miniapp-assets/gasbox/banner.webp",
          "/miniapp-assets/gasbox/banner.svg",
          "/miniapp-assets/gasbox/banner.png",
          "/miniapps/gasbox/banner.webp",
          "/miniapps/gasbox/banner.svg",
          "/miniapps/gasbox/public/banner.webp",
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

      expect(result[0]).toBe("/miniapp-assets/neo-swap/banner.webp");
      expect(result).toEqual(expect.arrayContaining(["/miniapps/neo-swap/static/banner.svg"]));
    });

    it("demotes legacy bundled banner media behind generated host assets", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-self-loan",
        entryURL: "mf://manifest?app=miniapp-self-loan",
        bannerURL: "/miniapps/self-loan/banner.webp",
      });

      expect(result[0]).toBe("/miniapp-assets/self-loan/banner.webp");
      expect(result).toContain("/miniapps/self-loan/banner.webp");
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

    it("ignores non-image explicit banner values from catalog metadata", () => {
      const result = buildMiniAppBannerSources({
        appID: "miniapp-token-minter",
        entryURL: "mf://manifest?app=miniapp-token-minter",
        bannerURL: "🧩",
      });

      expect(result).not.toContain("🧩");
      expect(result[0]).toBe("/miniapps/token-minter/public/banner.webp");
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

      expect(app.logo_url).toBe("/miniapp-assets/fogplay/logo.webp");
      expect(app.banner_url).toBe("/miniapp-assets/fogplay/banner.webp");
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

      expect(app.logo_url).toBe("/miniapp-assets/neo-swap/logo.webp");
      expect(app.banner_url).toBe("/miniapp-assets/neo-swap/banner.webp");
    });

    it("uses dedicated media for the shared-mode example", () => {
      const app = withMiniAppCardAssets({
        app_id: "miniapp-neo-pay-shared-example",
        entry_url: "mf://manifest?app=miniapp-neo-pay-shared-example",
        name: "NeoPay Modular Fixture",
        description: "test",
        icon: "💳",
        category: "defi",
      });

      expect(app.logo_url).toBe("/miniapp-assets/neo-pay-shared-example/logo.webp");
      expect(app.banner_url).toBe("/miniapp-assets/neo-pay-shared-example/banner.webp");
    });
  });

  describe("buildModernImageSources", () => {
    it("derives modern variants for managed miniapp media assets", () => {
      expect(buildModernImageSources("/miniapp-assets/fogplay/banner.webp")).toEqual({
        avif: "/miniapp-assets/fogplay/banner.avif",
        webp: "/miniapp-assets/fogplay/banner.webp",
      });
    });

    it("preserves query strings when deriving managed modern variants", () => {
      expect(buildModernImageSources("https://media.neomini.app/miniapp-assets/fogplay/logo.jpeg?v=1")).toEqual({
        avif: "https://media.neomini.app/miniapp-assets/fogplay/logo.avif?v=1",
        webp: "https://media.neomini.app/miniapp-assets/fogplay/logo.webp?v=1",
      });
    });

    it("keeps external and vector assets on their original source", () => {
      expect(buildModernImageSources("https://cdn.example.com/logo.webp")).toEqual({});
      expect(buildModernImageSources("/miniapp-assets/fogplay/logo.svg")).toEqual({});
    });
  });
});
