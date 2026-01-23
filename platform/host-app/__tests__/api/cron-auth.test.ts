import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/cron/collect-miniapp-stats";

jest.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [] })),
    })),
  },
}));

describe("cron auth", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails closed when CRON_SECRET is missing in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.CRON_SECRET;

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
  });
});
