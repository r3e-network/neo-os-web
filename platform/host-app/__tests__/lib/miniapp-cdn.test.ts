import {
  buildDefinitionFromCdnApp,
  buildLocalBundleEntryUrl,
  buildMiniAppCatalogUrl,
  buildMiniAppPointerUrl,
  clearMiniAppCdnCatalogCache,
  findMiniAppCdnApp,
  getMiniAppBundleSource,
  getMiniAppCdnBaseUrl,
  isMiniAppCdnEnabled,
  loadMiniAppCdnCatalog,
  resolveMiniAppBundle,
} from "@/lib/miniapp-cdn";

const CDN = "https://cdn.example.test";

function catalogResponse(kind: "miniapps" | "minigames", apps: unknown[]) {
  return {
    ok: true,
    json: async () => ({
      generated_at: "2026-07-26T00:00:00.000Z",
      source: `neo-${kind}`,
      kind,
      cdn_base_url: CDN,
      count: apps.length,
      apps,
    }),
  };
}

function miniappEntry() {
  return {
    app_id: "miniapp-neo-pay",
    slug: "neo-pay",
    kind: "miniapps",
    name: "Neo Pay",
    name_zh: "Neo 支付",
    description: "Payments",
    category: "finance",
    tags: ["payments"],
    version: "2.1.0",
    icon_url: `${CDN}/miniapps/neo-pay/2.1.0/logo.webp`,
    banner_url: `${CDN}/miniapps/neo-pay/2.1.0/banner.webp`,
    entry_url: `${CDN}/miniapps/neo-pay/2.1.0/index.html`,
    manifest_url: `${CDN}/miniapps/neo-pay/2.1.0/neo-manifest.json`,
    supported_networks: ["neo-n3-testnet"],
    default_network: "neo-n3-testnet",
    contracts: { "neo-n3-testnet": "0xabc" },
    onegate: { id: 42, url: "https://neomini.app/play/neo-pay" },
  };
}

function gameEntry() {
  return {
    app_id: "miniapp-game-2048",
    slug: "game-2048",
    kind: "minigames",
    name: "2048",
    description: "Slide tiles",
    category: "games",
    tags: [],
    version: "1.3.0",
    icon_url: `${CDN}/minigames/game-2048/1.3.0/logo.webp`,
    banner_url: "",
    entry_url: `${CDN}/minigames/game-2048/1.3.0/index.html`,
    manifest_url: `${CDN}/minigames/game-2048/1.3.0/neo-manifest.json`,
    supported_networks: [],
    default_network: "",
    contracts: {},
  };
}

describe("miniapp-cdn", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearMiniAppCdnCatalogCache();
    process.env.MINIAPP_CDN_BASE_URL = CDN;
    delete process.env.MINIAPP_BUNDLE_SOURCE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    clearMiniAppCdnCatalogCache();
  });

  it("builds the catalogue and pointer keys the publisher writes", () => {
    expect(getMiniAppCdnBaseUrl()).toBe(CDN);
    expect(buildMiniAppCatalogUrl("minigames")).toBe(`${CDN}/catalog/minigames.json`);
    expect(buildMiniAppPointerUrl("miniapps", "neo-pay")).toBe(
      `${CDN}/meta/miniapps/neo-pay/latest.json`,
    );
    expect(buildLocalBundleEntryUrl("neo-pay")).toBe("/miniapps/neo-pay/index.html");
  });

  it("trims a trailing slash off the configured base so keys never double up", () => {
    process.env.MINIAPP_CDN_BASE_URL = `${CDN}/`;
    expect(getMiniAppCdnBaseUrl()).toBe(CDN);
  });

  it("merges both catalogues and sorts by slug", async () => {
    global.fetch = jest.fn(async (url: unknown) =>
      String(url).includes("minigames")
        ? catalogResponse("minigames", [gameEntry()])
        : catalogResponse("miniapps", [miniappEntry()]),
    ) as unknown as typeof fetch;

    const catalog = await loadMiniAppCdnCatalog();
    expect(catalog.map((entry) => entry.slug)).toEqual(["game-2048", "neo-pay"]);
    expect(catalog.map((entry) => entry.kind)).toEqual(["minigames", "miniapps"]);
  });

  it("caches the merged catalogue so a launcher render costs one fetch per kind", async () => {
    const fetchMock = jest.fn(async (url: unknown) =>
      String(url).includes("minigames")
        ? catalogResponse("minigames", [gameEntry()])
        : catalogResponse("miniapps", [miniappEntry()]),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await loadMiniAppCdnCatalog();
    await loadMiniAppCdnCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache an empty result, so a CDN blip cannot pin the launcher to zero apps", async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await loadMiniAppCdnCatalog()).toEqual([]);
    await loadMiniAppCdnCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("drops catalogue rows without a slug or entry url", async () => {
    global.fetch = jest.fn(async (url: unknown) =>
      String(url).includes("minigames")
        ? catalogResponse("minigames", [{ ...gameEntry(), entry_url: "" }, { name: "no slug" }])
        : catalogResponse("miniapps", [miniappEntry()]),
    ) as unknown as typeof fetch;

    const catalog = await loadMiniAppCdnCatalog();
    expect(catalog.map((entry) => entry.slug)).toEqual(["neo-pay"]);
  });

  it("finds an app by slug or by canonical app id", async () => {
    global.fetch = jest.fn(async (url: unknown) =>
      String(url).includes("minigames")
        ? catalogResponse("minigames", [gameEntry()])
        : catalogResponse("miniapps", [miniappEntry()]),
    ) as unknown as typeof fetch;

    expect((await findMiniAppCdnApp("neo-pay"))?.app_id).toBe("miniapp-neo-pay");
    expect((await findMiniAppCdnApp("miniapp-neo-pay"))?.slug).toBe("neo-pay");
    expect(await findMiniAppCdnApp("nope")).toBeNull();
  });

  it("resolves a bundle from the catalogue, deriving the immutable base from the entry", async () => {
    global.fetch = jest.fn(async (url: unknown) =>
      String(url).includes("minigames")
        ? catalogResponse("minigames", [gameEntry()])
        : catalogResponse("miniapps", [miniappEntry()]),
    ) as unknown as typeof fetch;

    const resolved = await resolveMiniAppBundle("game-2048");
    expect(resolved).toEqual({
      entry_url: `${CDN}/minigames/game-2048/1.3.0/index.html`,
      source: "cdn",
      kind: "minigames",
      version: "1.3.0",
      base_url: `${CDN}/minigames/game-2048/1.3.0`,
    });
  });

  it("falls back to the release pointer when an app is newer than the cached catalogue", async () => {
    global.fetch = jest.fn(async (url: unknown) => {
      const target = String(url);
      if (target.includes("/catalog/")) return catalogResponse("miniapps", []);
      if (target === `${CDN}/meta/miniapps/fresh-app/latest.json`) {
        return {
          ok: true,
          json: async () => ({
            app_id: "miniapp-fresh-app",
            slug: "fresh-app",
            kind: "miniapps",
            version: "9.0.0",
            entry_url: `${CDN}/miniapps/fresh-app/9.0.0/index.html`,
            base_url: `${CDN}/miniapps/fresh-app/9.0.0`,
            manifest_url: `${CDN}/miniapps/fresh-app/9.0.0/neo-manifest.json`,
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const resolved = await resolveMiniAppBundle("fresh-app");
    expect(resolved.source).toBe("cdn");
    expect(resolved.version).toBe("9.0.0");
    expect(resolved.entry_url).toBe(`${CDN}/miniapps/fresh-app/9.0.0/index.html`);
  });

  it("serves the locally staged bundle when the CDN is unreachable", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const resolved = await resolveMiniAppBundle("neo-pay");
    expect(resolved).toEqual({
      entry_url: "/miniapps/neo-pay/index.html",
      source: "local",
      kind: null,
      version: null,
      base_url: null,
    });
  });

  it("MINIAPP_BUNDLE_SOURCE=local pins the host to its own bundles without any fetch", async () => {
    process.env.MINIAPP_BUNDLE_SOURCE = "local";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(getMiniAppBundleSource()).toBe("local");
    expect(isMiniAppCdnEnabled()).toBe(false);
    expect(await loadMiniAppCdnCatalog()).toEqual([]);
    expect((await resolveMiniAppBundle("neo-pay")).source).toBe("local");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a catalogue row as a definition payload the host can coerce", () => {
    const definition = buildDefinitionFromCdnApp({
      ...miniappEntry(),
      kind: "miniapps",
    } as never);

    expect(definition.app_id).toBe("miniapp-neo-pay");
    expect(definition.entry_url).toBe(`${CDN}/miniapps/neo-pay/2.1.0/index.html`);
    expect(definition.dapp_url).toBe(definition.entry_url);
    expect(definition.status).toBe("active");
    expect(definition.contracts).toEqual({ "neo-n3-testnet": "0xabc" });
    expect(definition.bundle).toEqual({
      kind: "miniapps",
      version: "2.1.0",
      source: "cdn",
      entry_url: `${CDN}/miniapps/neo-pay/2.1.0/index.html`,
      manifest_url: `${CDN}/miniapps/neo-pay/2.1.0/neo-manifest.json`,
    });
    expect((definition.manifest as Record<string, unknown>).version).toBe("2.1.0");
  });
});
