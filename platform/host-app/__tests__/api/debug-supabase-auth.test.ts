import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/debug/test-supabase";

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: null,
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(),
      })),
    })),
  },
}));

describe("/api/debug/test-supabase", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("blocks access in production", async () => {
    process.env.NODE_ENV = "production";

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
  });
});
