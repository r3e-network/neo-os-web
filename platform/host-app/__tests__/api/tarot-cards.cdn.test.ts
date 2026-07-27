import handler from "../../pages/api/miniapps/on-chain-tarot/cards/[file]";
import { clearMiniAppCdnCatalogCache } from "@/lib/miniapp-cdn";

const CDN = "https://cdn.example.test";

function res() {
  const state = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    redirectedTo: "",
    body: undefined as unknown,
    ended: false,
  };
  const api = {
    setHeader: (key: string, value: string) => {
      state.headers[key.toLowerCase()] = value;
    },
    status: (code: number) => {
      state.statusCode = code;
      return api;
    },
    json: (payload: unknown) => {
      state.body = payload;
      return api;
    },
    send: (payload: unknown) => {
      state.body = payload;
      return api;
    },
    end: () => {
      state.ended = true;
      return api;
    },
    redirect: (code: number, url: string) => {
      state.statusCode = code;
      state.redirectedTo = url;
      return api;
    },
  };
  return { api, state };
}

function catalogFetch(version = "2.0.0") {
  return jest.fn(async (url: unknown) => {
    if (String(url).includes("/catalog/minigames.json")) {
      return {
        ok: true,
        json: async () => ({
          kind: "minigames",
          cdn_base_url: CDN,
          apps: [
            {
              app_id: "miniapp-on-chain-tarot",
              slug: "on-chain-tarot",
              name: "On-Chain Tarot",
              description: "",
              category: "games",
              tags: [],
              version,
              icon_url: `${CDN}/minigames/on-chain-tarot/${version}/logo.webp`,
              banner_url: "",
              entry_url: `${CDN}/minigames/on-chain-tarot/${version}/index.html`,
              manifest_url: `${CDN}/minigames/on-chain-tarot/${version}/neo-manifest.json`,
              supported_networks: [],
              default_network: "",
              contracts: {},
            },
          ],
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

/**
 * The route predates CDN delivery: the app used to be served from the platform's
 * own public directory, where an absolute /miniapps/on-chain-tarot/cards/* URL
 * resolved. The app asks relatively now, so nothing new hits this route - but
 * cached clients and printed QR codes still do, and the app sources it used to
 * read from disk live in another repository.
 */
describe("tarot card assets", () => {
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

  it("redirects to the published bundle instead of reading app sources", async () => {
    global.fetch = catalogFetch();
    const { api, state } = res();

    await handler({ method: "GET", query: { file: "back.webp" } } as never, api as never);

    expect(state.statusCode).toBe(302);
    expect(state.redirectedTo).toBe(`${CDN}/minigames/on-chain-tarot/2.0.0/cards/back.webp`);
  });

  it("follows the published version rather than pinning one", async () => {
    global.fetch = catalogFetch("9.1.0");
    const { api, state } = res();

    await handler({ method: "GET", query: { file: "index.json" } } as never, api as never);

    expect(state.redirectedTo).toBe(`${CDN}/minigames/on-chain-tarot/9.1.0/cards/index.json`);
  });

  it("caches the redirect no longer than the pointer that produced it", async () => {
    global.fetch = catalogFetch();
    const { api, state } = res();

    await handler({ method: "GET", query: { file: "back.webp" } } as never, api as never);

    expect(state.headers["cache-control"]).toContain("max-age=60");
  });

  it("still rejects anything outside the card allowlist, before any lookup", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    for (const file of ["../../../etc/passwd", "evil.js", "00-fool.webp.js", ""]) {
      const { api, state } = res();
      await handler({ method: "GET", query: { file } } as never, api as never);
      expect(state.statusCode).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-read methods", async () => {
    const { api, state } = res();
    await handler({ method: "POST", query: { file: "back.webp" } } as never, api as never);
    expect(state.statusCode).toBe(405);
    expect(state.headers.allow).toBe("GET, HEAD");
  });

  it("serves locally staged bytes when the host is pinned to local bundles", async () => {
    process.env.MINIAPP_BUNDLE_SOURCE = "local";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { api, state } = res();

    await handler({ method: "GET", query: { file: "back.webp" } } as never, api as never);

    // No CDN lookup, and a filesystem outcome either way - the app sources may
    // or may not be present in this checkout.
    expect(fetchMock).not.toHaveBeenCalled();
    expect([200, 404, 500]).toContain(state.statusCode);
    expect(state.redirectedTo).toBe("");
  });

  it("falls back to the filesystem when the catalogue cannot be reached", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const { api, state } = res();

    await handler({ method: "GET", query: { file: "back.webp" } } as never, api as never);

    expect(state.redirectedTo).toBe("");
    expect([200, 404, 500]).toContain(state.statusCode);
  });
});
