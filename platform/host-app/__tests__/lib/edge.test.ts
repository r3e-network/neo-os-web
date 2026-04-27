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
