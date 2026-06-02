describe("middleware CSP", () => {
  let buildCSP: typeof import("../middleware").buildCSP;
  let buildMiniAppDetailRewriteUrl: typeof import("../middleware").buildMiniAppDetailRewriteUrl;
  let resolveMiniAppDetailRewriteId: typeof import("../middleware").resolveMiniAppDetailRewriteId;

  beforeAll(() => {
    if (typeof globalThis.Request === "undefined") {
      (globalThis as unknown as { Request: typeof Request }).Request =
        class Request {} as unknown as typeof Request;
    }
    if (typeof globalThis.Response === "undefined") {
      (globalThis as unknown as { Response: typeof Response }).Response =
        class Response {} as typeof Response;
    }
    ({ buildCSP, buildMiniAppDetailRewriteUrl, resolveMiniAppDetailRewriteId } = require("../middleware"));
  });

  const scriptDirective = (csp: string) =>
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src"));

  function withProductionEnv<T>(run: () => T): T {
    const previous = process.env.NODE_ENV;
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = "production";
    try {
      return run();
    } finally {
      env.NODE_ENV = previous;
    }
  }

  it("allows native wallet provider injection on miniapp runtime pages", () => {
    const csp = withProductionEnv(() =>
      buildCSP("test-nonce", { allowMiniAppEmbedding: true }),
    );
    const scriptSrc = scriptDirective(csp);

    expect(scriptSrc).toContain("script-src 'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'nonce-test-nonce'");
    expect(csp).toContain(
      "frame-ancestors 'self' https://neomini.app https://onegate.space",
    );
  });

  it("allows iOS OneGate to inject its provider on vault pages", () => {
    const csp = withProductionEnv(() =>
      buildCSP("test-nonce", {
        allowMiniAppEmbedding: true,
        allowNativeWalletEval: true,
      }),
    );
    const scriptSrc = scriptDirective(csp);

    expect(scriptSrc).toContain("script-src 'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'nonce-test-nonce'");
  });

  it("keeps normal pages nonce-only", () => {
    const csp = withProductionEnv(() => buildCSP("test-nonce"));
    const scriptSrc = scriptDirective(csp);

    expect(scriptSrc).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("lets host detail pages embed same-origin miniapp frames without becoming embeddable", () => {
    const csp = withProductionEnv(() =>
      buildCSP("test-nonce", { allowMiniAppFrames: true }),
    );
    const scriptSrc = scriptDirective(csp);

    expect(scriptSrc).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).toContain("frame-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("only rewrites extensionless miniapp detail slugs", () => {
    expect(resolveMiniAppDetailRewriteId("/miniapps/fogplay")).toBe("fogplay");
    expect(resolveMiniAppDetailRewriteId("/miniapps/fogplay/")).toBe("fogplay");
    expect(resolveMiniAppDetailRewriteId("/miniapps/catalog.json")).toBeNull();
    expect(resolveMiniAppDetailRewriteId("/miniapps/onegate-catalog.json")).toBeNull();
    expect(resolveMiniAppDetailRewriteId("/miniapps/fogplay/index.html")).toBeNull();
  });

  it("preserves query parameters when rewriting miniapp detail pages", () => {
    const rewriteUrl = buildMiniAppDetailRewriteUrl(
      "https://neomini.app/miniapps/fogplay?network=testnet&operation=Flip",
      "fogplay",
    );

    expect(rewriteUrl.pathname).toBe("/miniapp-detail/fogplay");
    expect(rewriteUrl.searchParams.get("network")).toBe("testnet");
    expect(rewriteUrl.searchParams.get("operation")).toBe("Flip");
  });
});
