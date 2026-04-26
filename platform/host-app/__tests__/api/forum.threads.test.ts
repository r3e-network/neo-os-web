import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

function makeThreadQuery(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.order = jest.fn(() => query);
  query.range = jest.fn(async () => result);
  return query;
}

async function loadHandler(options: {
  configured?: boolean;
  supabase?: unknown;
}) {
  jest.resetModules();
  jest.doMock("@/lib/rate-limit", () => ({
    standardLimit: jest.fn(() => false),
  }));
  jest.doMock("@/lib/logger", () => ({
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }));
  jest.doMock("@/lib/server-supabase", () => ({
    isServerSupabaseConfigured: jest.fn(() => options.configured ?? true),
    hasServiceRoleSupabase: jest.fn(() => false),
    getServerSupabaseClient: jest.fn(() => options.supabase ?? null),
  }));

  return require("@/pages/api/miniapps/[appId]/forum/threads").default as (
    req: NextApiRequest,
    res: NextApiResponse,
  ) => Promise<void>;
}

describe("/api/miniapps/[appId]/forum/threads", () => {
  it("returns an empty list when Supabase is not configured", async () => {
    const handler = await loadHandler({ configured: false });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appId: "miniapp-test" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      threads: [],
      hasMore: false,
      total: 0,
    });
  });

  it("degrades read failures to an empty unavailable list", async () => {
    const query = makeThreadQuery({
      data: null,
      count: null,
      error: {
        code: "42P01",
        message: 'relation "forum_threads" does not exist',
      },
    });
    const handler = await loadHandler({
      supabase: {
        from: jest.fn(() => query),
      },
    });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appId: "miniapp-test" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      threads: [],
      hasMore: false,
      total: 0,
      unavailable: true,
    });
  });

  it("returns stored threads when forum storage is available", async () => {
    const query = makeThreadQuery({
      data: [
        {
          id: "thread-1",
          app_id: "miniapp-test",
          author_wallet: "Nabc",
          author_name: "Neo user",
          title: "Hello",
          content: "World",
          category: "general",
          reply_count: 2,
          view_count: 7,
          is_pinned: false,
          is_locked: false,
          created_at: "2026-04-26T00:00:00.000Z",
          updated_at: "2026-04-26T00:00:00.000Z",
          last_reply_at: null,
        },
      ],
      count: 1,
      error: null,
    });
    const handler = await loadHandler({
      supabase: {
        from: jest.fn(() => query),
      },
    });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appId: "miniapp-test" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toMatchObject({
      threads: [
        {
          id: "thread-1",
          app_id: "miniapp-test",
          author_id: "Nabc",
          title: "Hello",
          reply_count: 2,
        },
      ],
      hasMore: false,
      total: 1,
    });
  });
});
