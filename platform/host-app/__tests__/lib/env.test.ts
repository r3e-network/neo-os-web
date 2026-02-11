/**
 * @jest-environment node
 */

describe("env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, SKIP_ENV_VALIDATION: "true" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("exports env object with SKIP_ENV_VALIDATION=true", () => {
    const { env } = require("@/lib/env");
    expect(env).toBeDefined();
    expect(typeof env).toBe("object");
  });

  it("reads NODE_ENV from process.env", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const { env } = require("@/lib/env");
    expect(env.NODE_ENV).toBe("test");
  });

  it("returns undefined for unset optional server vars", () => {
    delete process.env.SENDGRID_API_KEY;
    const { env } = require("@/lib/env");
    expect(env.SENDGRID_API_KEY).toBeUndefined();
  });

  it("reads CRON_SECRET when set", () => {
    process.env.CRON_SECRET = "a-secret-that-is-16ch";
    const { env } = require("@/lib/env");
    expect(env.CRON_SECRET).toBe("a-secret-that-is-16ch");
  });

  it("reads ADMIN_CONSOLE_API_KEY when set", () => {
    process.env.ADMIN_CONSOLE_API_KEY = "admin-key-value";
    const { env } = require("@/lib/env");
    expect(env.ADMIN_CONSOLE_API_KEY).toBe("admin-key-value");
  });

  it("reads client-side NEXT_PUBLIC vars", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const { env } = require("@/lib/env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });
});
