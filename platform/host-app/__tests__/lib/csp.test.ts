const nextConfig = require("../../next.config");

describe("Content Security Policy", () => {
  it("removes unsafe-eval and wildcard sources", async () => {
    const headers = await nextConfig.headers();
    const miniapps = headers.find((entry: { source: string }) => entry.source === "/miniapps/:path*");
    const appHeaders = miniapps?.headers || [];
    const csp = appHeaders.find((header: { key: string }) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toBeDefined();
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("*");
  });

  it("keeps non-miniapps CSP restrictive", async () => {
    const headers = await nextConfig.headers();
    const defaultEntry = headers.find((entry: { source: string }) => entry.source === "/((?!miniapps).*)");
    const appHeaders = defaultEntry?.headers || [];
    const csp = appHeaders.find((header: { key: string }) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toBeDefined();
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("*");
  });
});
