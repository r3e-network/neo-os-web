/**
 * These pin the two policies CDN delivery depends on. Both were wrong in the
 * first deployment and neither was visible from unit tests of the loader: the
 * middleware sets the response CSP and overrides anything next.config.js
 * declares, so a frame-src that omits the CDN silently blocks every MiniApp,
 * and frame-ancestors 'none' on /play makes the surface unembeddable by OneGate.
 */
describe("middleware CSP for CDN-delivered bundles", () => {
  let buildCSP: typeof import("../middleware").buildCSP;
  const originalEnv = { ...process.env };

  // next/server touches the edge-runtime globals at import time, which jsdom
  // does not provide; the existing middleware suite stubs them the same way.
  beforeAll(() => {
    if (typeof globalThis.Request === "undefined") {
      (globalThis as unknown as { Request: typeof Request }).Request =
        class Request {} as unknown as typeof Request;
    }
    if (typeof globalThis.Response === "undefined") {
      (globalThis as unknown as { Response: typeof Response }).Response =
        class Response {} as typeof Response;
    }
    ({ buildCSP } = require("../middleware"));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function directive(csp: string, name: string): string {
    const found = csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `));
    return found ?? "";
  }

  it("permits framing the CDN origin wherever a bundle is embedded", () => {
    process.env.MINIAPP_CDN_BASE_URL = "https://cdn.example.test";

    for (const options of [{ allowMiniAppFrames: true }, { allowMiniAppEmbedding: true }]) {
      const csp = buildCSP("nonce", options);
      const frameSrc = directive(csp, "frame-src");
      expect(frameSrc).toContain("'self'");
      expect(frameSrc).toContain("https://cdn.example.test");
    }
  });

  it("still forbids framing anywhere a bundle is not embedded", () => {
    process.env.MINIAPP_CDN_BASE_URL = "https://cdn.example.test";
    expect(directive(buildCSP("nonce", {}), "frame-src")).toBe("frame-src 'none'");
  });

  it("uses only the CDN origin, never the full base URL with its path", () => {
    process.env.MINIAPP_CDN_BASE_URL = "https://cdn.example.test/bundles/";
    const frameSrc = directive(buildCSP("nonce", { allowMiniAppFrames: true }), "frame-src");
    expect(frameSrc).toContain("https://cdn.example.test");
    expect(frameSrc).not.toContain("/bundles");
  });

  it("falls back to the default CDN origin when nothing is configured", () => {
    delete process.env.MINIAPP_CDN_BASE_URL;
    delete process.env.NEXT_PUBLIC_MINIAPP_CDN_BASE_URL;
    expect(directive(buildCSP("nonce", { allowMiniAppFrames: true }), "frame-src")).toContain(
      "https://meshmini.app",
    );
  });

  it("ignores a malformed CDN base rather than emitting a broken directive", () => {
    process.env.MINIAPP_CDN_BASE_URL = "not a url";
    const frameSrc = directive(buildCSP("nonce", { allowMiniAppFrames: true }), "frame-src");
    expect(frameSrc).toBe("frame-src 'self' blob:");
  });

  it("lets the wallets in the allowlist embed a miniapp surface", () => {
    const csp = buildCSP("nonce", { allowMiniAppEmbedding: true });
    const frameAncestors = directive(csp, "frame-ancestors");
    expect(frameAncestors).toContain("https://onegate.space");
    expect(frameAncestors).toContain("https://neomini.app");
    expect(frameAncestors).not.toBe("frame-ancestors 'none'");
  });

  it("keeps every other surface unembeddable", () => {
    expect(directive(buildCSP("nonce", { allowMiniAppFrames: true }), "frame-ancestors")).toBe(
      "frame-ancestors 'none'",
    );
    expect(directive(buildCSP("nonce", {}), "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("allows reading the catalogue and pointers from the CDN", () => {
    process.env.MINIAPP_CDN_BASE_URL = "https://cdn.example.test";
    expect(directive(buildCSP("nonce", {}), "connect-src")).toContain("https://cdn.example.test");
  });
});
