describe("resolveInternalBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_BRANCH_URL;
    delete process.env.VERCEL_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers NEXT_PUBLIC_API_URL and normalizes trailing slash", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/";
    const { resolveInternalBaseUrl } = require("../../lib/edge");
    expect(resolveInternalBaseUrl()).toBe("https://api.example.com");
  });

  it("uses VERCEL_URL in production when NEXT_PUBLIC_API_URL is missing", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true });
    process.env.VERCEL_URL = "miniapps.example.vercel.app";
    const { resolveInternalBaseUrl } = require("../../lib/edge");
    expect(resolveInternalBaseUrl()).toBe("https://miniapps.example.vercel.app");
  });

  it("falls back to forwarded host headers when env URLs are unavailable", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true });
    const { resolveInternalBaseUrl } = require("../../lib/edge");
    expect(
      resolveInternalBaseUrl({
        headers: {
          "x-forwarded-host": "app.example.com",
          "x-forwarded-proto": "https",
        },
      }),
    ).toBe("https://app.example.com");
  });

  it("uses http for localhost hosts even in production local start", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true });
    const { resolveInternalBaseUrl } = require("../../lib/edge");
    expect(
      resolveInternalBaseUrl({ headers: { host: "127.0.0.1:3101" } }),
    ).toBe("http://127.0.0.1:3101");
    expect(
      resolveInternalBaseUrl({ headers: { host: "localhost:3101" } }),
    ).toBe("http://localhost:3101");
  });

  it("throws when no trusted URL source is available", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true });
    const { resolveInternalBaseUrl } = require("../../lib/edge");
    expect(() =>
      resolveInternalBaseUrl({
        headers: {
          host: "invalid host value",
        },
      }),
    ).toThrow("Unable to resolve base URL");
  });
});

describe("getEdgeFunctionsBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers EDGE_BASE_URL over public edge and Supabase URLs", () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    process.env.NEXT_PUBLIC_EDGE_URL = "https://public-edge.example";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";

    const { getEdgeFunctionsBaseUrl } = require("../../lib/edge");

    expect(getEdgeFunctionsBaseUrl()).toBe("https://edge.example/functions/v1");
  });

  it("uses NEXT_PUBLIC_EDGE_URL before falling back to Supabase", () => {
    process.env.NEXT_PUBLIC_EDGE_URL = "https://edge-gateway.example";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";

    const { getEdgeFunctionsBaseUrl } = require("../../lib/edge");

    expect(getEdgeFunctionsBaseUrl()).toBe("https://edge-gateway.example/functions/v1");
  });

  it("falls back to Supabase functions when no edge gateway is configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co/";

    const { getEdgeFunctionsBaseUrl } = require("../../lib/edge");

    expect(getEdgeFunctionsBaseUrl()).toBe("https://project.supabase.co/functions/v1");
  });
});
