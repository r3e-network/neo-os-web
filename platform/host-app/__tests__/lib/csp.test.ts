describe("Content Security Policy", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  const loadConfig = () => {
    jest.resetModules();
    return require("../../next.config");
  };

  const getDirective = (csp: string, name: string) => {
    return (
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `))
        ?.slice(name.length + 1)
        ?.split(/\s+/)
        .filter(Boolean) || []
    );
  };

  it("removes unsafe-eval and wildcard sources", async () => {
    const nextConfig = loadConfig();
    const headers = await nextConfig.headers();
    const miniapps = headers.find((entry: { source: string }) => entry.source === "/miniapps/:path*");
    const appHeaders = miniapps?.headers || [];
    const csp = appHeaders.find((header: { key: string }) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toBeDefined();
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("*");
  });

  it("removes scheme-only wildcards", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.MINIAPP_FRAME_ORIGINS;

    const nextConfig = loadConfig();
    const headers = await nextConfig.headers();
    const defaultEntry = headers.find((entry: { source: string }) => entry.source === "/((?!miniapps).*)");
    const appHeaders = defaultEntry?.headers || [];
    const csp = appHeaders.find((header: { key: string }) => header.key === "Content-Security-Policy")?.value;
    const connectSrc = getDirective(csp, "connect-src");

    expect(connectSrc).not.toContain("https:");
    expect(connectSrc).not.toContain("wss:");
    expect(connectSrc).not.toContain("*");
  });

  it("requires explicit frame-src allowlist in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.MINIAPP_FRAME_ORIGINS;

    const nextConfig = loadConfig();
    const headers = await nextConfig.headers();
    const miniapps = headers.find((entry: { source: string }) => entry.source === "/miniapps/:path*");
    const appHeaders = miniapps?.headers || [];
    const csp = appHeaders.find((header: { key: string }) => header.key === "Content-Security-Policy")?.value;
    const frameSrc = getDirective(csp, "frame-src");

    expect(frameSrc).toEqual(["'self'"]);
  });
});
