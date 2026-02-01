/**
 * Supabase Client Tests
 */

// Mock @supabase/supabase-js before importing
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    channel: jest.fn(),
  })),
}));

describe("Supabase Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadSupabaseModule(options?: { url?: string; key?: string; serviceRoleKey?: string }) {
    if (options?.url) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = options.url;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (options?.key) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = options.key;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    if (options?.serviceRoleKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = options.serviceRoleKey;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    jest.resetModules();
    jest.unmock("../../lib/supabase");
    jest.unmock("@/lib/supabase");
    return require("../../lib/supabase");
  }

  it("creates client with environment variables", () => {
    const { supabase } = loadSupabaseModule({ url: "https://test.supabase.co", key: "test-key" });
    expect(supabase).toBeDefined();
  });

  it("isSupabaseConfigured is true when env vars are present", () => {
    const { isSupabaseConfigured } = loadSupabaseModule({ url: "https://test.supabase.co", key: "test-key" });
    expect(isSupabaseConfigured).toBe(true);
  });

  it("isSupabaseConfigured is false when env vars are missing", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();

    const { isSupabaseConfigured } = loadSupabaseModule();
    expect(isSupabaseConfigured).toBe(false);
  });
});
