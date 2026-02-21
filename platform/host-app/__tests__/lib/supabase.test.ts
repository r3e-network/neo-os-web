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

  it("warns when environment variables are missing", () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";

    jest.resetModules();
    require("../../lib/supabase");

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Supabase environment variables not configured"));
    consoleSpy.mockRestore();
  });
});
