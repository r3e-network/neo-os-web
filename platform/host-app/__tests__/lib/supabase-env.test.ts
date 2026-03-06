describe("supabase env helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers public supabase url and service-role auth when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = " https://public.supabase.co ";
    process.env.SUPABASE_URL = "https://server.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { getSupabaseEnv } = require("../../lib/supabase-env");
    expect(getSupabaseEnv()).toEqual({
      url: "https://public.supabase.co",
      anonKey: "anon-key",
      serviceRoleKey: "service-role-key",
      authHeaders: {
        apikey: "service-role-key",
        Authorization: "Bearer service-role-key",
      },
    });
  });

  it("falls back to server url and anon auth when service role is absent", () => {
    process.env.SUPABASE_URL = " https://server.supabase.co ";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = " anon-key ";

    const { getSupabaseEnv } = require("../../lib/supabase-env");
    expect(getSupabaseEnv()).toEqual({
      url: "https://server.supabase.co",
      anonKey: "anon-key",
      serviceRoleKey: "",
      authHeaders: {
        apikey: "anon-key",
        Authorization: "Bearer anon-key",
      },
    });
  });

  it("returns empty values and no auth headers when supabase is unconfigured", () => {
    const { getSupabaseEnv } = require("../../lib/supabase-env");
    expect(getSupabaseEnv()).toEqual({
      url: "",
      anonKey: "",
      serviceRoleKey: "",
      authHeaders: null,
    });
  });
});
