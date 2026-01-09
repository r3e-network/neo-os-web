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

  it("creates client with environment variables", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { supabase } = require("../../lib/supabase");
    expect(supabase).toBeDefined();
  });

  it("isSupabaseConfigured is always true when module loads successfully", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    jest.resetModules();

    // Current implementation sets isSupabaseConfigured to true
    // because it throws error if env vars are missing
    const { isSupabaseConfigured } = require("../../lib/supabase");
    expect(isSupabaseConfigured).toBe(true);
  });
});
