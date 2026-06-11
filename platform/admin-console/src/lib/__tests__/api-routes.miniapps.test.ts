import { describe, it, expect, vi } from "vitest";
import {
  authedRequest,
  fetchSpy,
  importRoute,
  mockJsonResponse,
  routeParams,
} from "./api-routes.test-utils";

// ==========================================================================
// 7. GET /api/miniapps
// ==========================================================================

describe("GET /api/miniapps", () => {
  it("rejects invalid app_id filter → 400", async () => {
    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/route");
    const res = await GET(
      authedRequest("http://localhost/api/miniapps?app_id=INVALID!!!"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid status filter → 400", async () => {
    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/route");
    const res = await GET(
      authedRequest("http://localhost/api/miniapps?status=deleted"),
    );
    expect(res.status).toBe(400);
  });

  it("proxies list request to host catalog endpoint", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        apps: [{ app_id: "miniapp-a" }, { app_id: "miniapp-b" }],
      }),
    );

    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/route");
    const res = await GET(
      authedRequest(
        "http://localhost/api/miniapps?status=active&search=miniapp",
      ),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual([{ app_id: "miniapp-a" }, { app_id: "miniapp-b" }]);

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/catalog");
    expect(calledUrl).toContain("status=active");
    expect(calledUrl).toContain("search=miniapp");
  });
});

// ==========================================================================
// 8. PATCH /api/miniapps/[id]
// ==========================================================================

describe("PATCH /api/miniapps/[id]", () => {
  const url = "http://localhost/api/miniapps/my-app";

  function patchReq(body: unknown) {
    return authedRequest(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects invalid path app_id → 400", async () => {
    const { PATCH } = await importRoute<{
      PATCH: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const res = await PATCH(patchReq({ name: "ok-name" }), {
      params: routeParams("INVALID!!!"),
    });
    expect(res.status).toBe(400);
  });

  it("allows updating empty arrays/objects in patch payload", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse({ success: true }));

    const { PATCH } = await importRoute<{
      PATCH: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const res = await PATCH(
      patchReq({
        assets_allowed: [],
        permissions: {},
        limits: {},
      }),
      { params: routeParams("my-app") },
    );

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/upsert");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("my-app");
    expect(body.action).toBe("save_draft");
    expect(body.assets_allowed).toEqual([]);
    expect(body.permissions).toEqual({});
    expect(body.limits).toEqual({});
  });

  it("passes explicit publish action to host upsert", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse({ success: true }));

    const { PATCH } = await importRoute<{
      PATCH: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const res = await PATCH(
      patchReq({
        action: "publish",
        name: "Publish Name",
        entry_url: "https://example.com/publish",
      }),
      { params: routeParams("my-app") },
    );

    expect(res.status).toBe(200);
    const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.action).toBe("publish");
    expect(body.app_id).toBe("my-app");
  });

  it("preserves extended keys on PATCH so updates stay symmetric with create", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse({ success: true }));

    const { PATCH } = await importRoute<{
      PATCH: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    // Create accepts extended keys via .passthrough(); editing the same app
    // through the console must not silently strip them.
    const res = await PATCH(
      patchReq({
        name: "Updated Name",
        custom_extension: { flag: true, note: "kept" },
      }),
      { params: routeParams("my-app") },
    );

    expect(res.status).toBe(200);
    const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.name).toBe("Updated Name");
    expect(body.custom_extension).toEqual({ flag: true, note: "kept" });
  });
});

// ==========================================================================
// 8b. POST /api/miniapps/create
// ==========================================================================

describe("POST /api/miniapps/create", () => {
  const url = "http://localhost/api/miniapps/create";

  function postReq(body: string) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  it("returns the schema validation message instead of 'Invalid JSON body' for invalid configs", async () => {
    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/create/route");

    const res = await POST(
      postReq(
        JSON.stringify({
          app_id: "INVALID!!!",
          name: "My App",
          entry_url: "https://example.com/app",
        }),
      ),
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toBe("lowercase alphanumeric with dots/hyphens");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still reports 'Invalid JSON body' for malformed JSON", async () => {
    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/create/route");

    const res = await POST(postReq("{not-json"));

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toBe("Invalid JSON body");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies a valid config to the host upsert endpoint", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse({ success: true }));

    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/create/route");

    const res = await POST(
      postReq(
        JSON.stringify({
          app_id: "my-app",
          name: "My App",
          entry_url: "https://example.com/app",
          custom_extension: { flag: true },
        }),
      ),
    );

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/upsert");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("my-app");
    expect(body.action).toBe("save_draft");
    expect(body.custom_extension).toEqual({ flag: true });
  });
});

// ==========================================================================
// 10. GET /api/miniapps/[id]
// ==========================================================================

describe("GET /api/miniapps/[id]", () => {
  it("proxies detail request to host catalog", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({ app: { app_id: "my-app", name: "My App" } }),
    );

    const { GET } = await importRoute<{
      GET: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/my-app");
    const res = await GET(req, { params: Promise.resolve({ id: "my-app" }) });

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual({ app_id: "my-app", name: "My App" });

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/catalog");
    expect(calledUrl).toContain("app_id=my-app");
  });

  it("rejects invalid app id format", async () => {
    const { GET } = await importRoute<{
      GET: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/bad");
    const res = await GET(req, {
      params: Promise.resolve({ id: "INVALID!!!" }),
    });
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 9. DELETE /api/miniapps/[id]
// ==========================================================================

describe("DELETE /api/miniapps/[id]", () => {
  it("proxies delete to disabled status update", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));

    const { DELETE } = await importRoute<{
      DELETE: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/my-app", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "my-app" }),
    });

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/status");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body).toEqual({ app_id: "my-app", status: "disabled" });
  });

  it("rejects invalid app id for delete", async () => {
    const { DELETE } = await importRoute<{
      DELETE: (
        r: Request,
        ctx: { params: Promise<{ id: string }> },
      ) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/invalid", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "INVALID!!!" }),
    });

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 11. POST /api/miniapps/import-batch
// ==========================================================================

describe("POST /api/miniapps/import-batch", () => {
  const url = "http://localhost/api/miniapps/import-batch";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("validates request payload", async () => {
    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/import-batch/route");
    const res = await POST(postReq({ definitions: [] }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies batch import request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        success: true,
        dry_run: true,
        stop_on_error: false,
        summary: { total: 1, failed: 0, validated: 1, imported: 0 },
        results: [],
        rollback_plan: null,
      }),
    );

    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/import-batch/route");
    const res = await POST(
      postReq({
        dry_run: true,
        stop_on_error: false,
        definitions: [
          { file_name: "miniapp-a.yaml", content: "app_id: miniapp-a" },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/import-batch");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.definitions).toHaveLength(1);
    expect(body.dry_run).toBe(true);
  });
});

// ==========================================================================
// 12. POST /api/miniapps/import-batch/rollback
// ==========================================================================

describe("POST /api/miniapps/import-batch/rollback", () => {
  const url = "http://localhost/api/miniapps/import-batch/rollback";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("validates rollback payload", async () => {
    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/import-batch/rollback/route");
    const res = await POST(postReq({ targets: [{ app_id: "INVALID!!!" }] }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies rollback request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        success: true,
        summary: {
          total: 1,
          failed: 0,
          rolled_back: 1,
          disabled_created_app: 0,
          noop: 0,
        },
        results: [{ app_id: "miniapp-a", status: "rolled_back" }],
      }),
    );

    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/import-batch/rollback/route");
    const res = await POST(
      postReq({
        targets: [
          {
            app_id: "miniapp-a",
            mode: "update",
            rollback_version_id: "11111111-1111-4111-8111-111111111111",
            rollback_release_channel: "draft",
          },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/import-batch-rollback");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0].app_id).toBe("miniapp-a");
  });
});

// ==========================================================================
// 13. /api/miniapps/template-market
// ==========================================================================

describe("/api/miniapps/template-market", () => {
  it("GET validates query filters", async () => {
    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/template-market/route");
    const res = await GET(
      authedRequest(
        "http://localhost/api/miniapps/template-market?mode=invalid",
      ),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GET proxies templates mode and applies local source/search filtering", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        templates: [
          {
            template_id: "prediction.alpha",
            name: "Prediction Alpha",
            source_type: "community",
            category: "defi",
            tags: ["prediction"],
          },
          {
            template_id: "prediction.beta",
            name: "Prediction Beta",
            source_type: "verified",
            category: "defi",
            tags: ["prediction"],
          },
        ],
        approval_required: true,
      }),
    );

    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/template-market/route");
    const res = await GET(
      authedRequest(
        "http://localhost/api/miniapps/template-market?mode=templates&kind=frontend&source=community&search=alpha&limit=50",
      ),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.mode).toBe("templates");
    expect(payload.templates).toHaveLength(1);
    expect(payload.templates[0].template_id).toBe("prediction.alpha");

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/admin/template-market");
    expect(calledUrl).toContain("mode=templates");
    expect(calledUrl).toContain("kind=frontend");
    expect(calledUrl).toContain("limit=50");
  });

  it("GET proxies requests mode", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        requests: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            template_kind: "frontend",
            template_row_id: "22222222-2222-4222-8222-222222222222",
            status: "pending",
            requested_by: "api_key",
            reviewed_by: null,
            review_note: null,
            created_at: "2026-02-22T00:00:00.000Z",
            reviewed_at: null,
          },
        ],
      }),
    );

    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/template-market/route");
    const res = await GET(
      authedRequest(
        "http://localhost/api/miniapps/template-market?mode=requests&kind=frontend&status=pending",
      ),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.mode).toBe("requests");
    expect(payload.requests).toHaveLength(1);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("mode=requests");
    expect(calledUrl).toContain("status=pending");
  });

  it("POST proxies upsert template payload to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse(
        { success: true, approval_required: true },
        { status: 201 },
      ),
    );

    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/template-market/route");
    const req = authedRequest("http://localhost/api/miniapps/template-market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_template",
        kind: "contract",
        template_id: "contract.prediction.v2",
        version: "1.0.0",
        name: "Prediction Contract v2",
        manifest: { template: { id: "contract.prediction.v2" } },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/template-market");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.action).toBe("upsert_template");
    expect(body.template_id).toBe("contract.prediction.v2");
  });
});
