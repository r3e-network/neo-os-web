import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function clearRequiredEnv() {
  for (const key of REQUIRED_ENV_KEYS) {
    delete process.env[key];
  }
}

describe("env module", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    clearRequiredEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not throw on production import when env is missing", async () => {
    await expect(import("../env")).resolves.toMatchObject({
      getEnv: expect.any(Function),
    });
  });

  it("does not warn during import when env is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await import("../env");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("throws only when strict env access is requested", async () => {
    const mod = await import("../env");
    expect(() => mod.getEnv({ strict: true })).toThrow(/Missing or invalid environment variables/);
  });
});
