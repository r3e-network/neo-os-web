describe("middleware CSP", () => {
  let buildCSP: typeof import("../middleware").buildCSP;

  beforeAll(() => {
    if (typeof globalThis.Request === "undefined") {
      (globalThis as unknown as { Request: typeof Request }).Request =
        class Request {} as typeof Request;
    }
    if (typeof globalThis.Response === "undefined") {
      (globalThis as unknown as { Response: typeof Response }).Response =
        class Response {} as typeof Response;
    }
    ({ buildCSP } = require("../middleware"));
  });

  const scriptDirective = (csp: string) =>
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src"));

  it("allows native wallet provider injection on miniapp runtime pages", () => {
    const csp = buildCSP("test-nonce", { allowMiniAppEmbedding: true });
    const scriptSrc = scriptDirective(csp);

    expect(scriptSrc).toContain("script-src 'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'nonce-test-nonce'");
    expect(csp).toContain(
      "frame-ancestors 'self' https://neomini.app https://onegate.space",
    );
  });

  it("keeps normal pages nonce-only", () => {
    const csp = buildCSP("test-nonce");
    const scriptSrc = scriptDirective(csp);

    expect(scriptSrc).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
