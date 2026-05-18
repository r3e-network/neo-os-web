import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  authedRequest,
  fetchSpy,
  importRoute,
  mockJsonResponse,
} from "./api-routes.test-utils";

// ==========================================================================
// 14. POST /api/miniapps/admin/media/upload-url
// ==========================================================================

describe("POST /api/miniapps/admin/media/upload-url", () => {
  const url = "http://localhost/api/miniapps/admin/media/upload-url";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("validates media upload payload", async () => {
    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/admin/media/upload-url/route");
    const res = await POST(
      postReq({
        app_id: "INVALID!!!",
        asset_type: "logo",
        content_type: "image/png",
      }),
    );

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies upload-url request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        success: true,
        upload_url: "https://signed.example/upload",
        public_url:
          "https://meshmini.app/miniapp-assets/miniapp-a/logo.dark.png",
        key: "miniapp-assets/miniapp-a/logo.dark.png",
        expires_in: 900,
      }),
    );

    const { POST } = await importRoute<{
      POST: (r: Request) => Promise<Response>;
    }>("@/app/api/miniapps/admin/media/upload-url/route");
    const res = await POST(
      postReq({
        app_id: "miniapp-a",
        asset_type: "logo",
        content_type: "image/png",
        file_name: "logo.png",
        variant: { theme: "dark", density: "2x" },
      }),
    );

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain("/api/miniapps/admin/media/upload-url");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("miniapp-a");
    expect(body.asset_type).toBe("logo");
  });
});

// ==========================================================================
// 15. GET /api/reports/live-smoke
// ==========================================================================

describe("GET /api/reports/live-smoke", () => {
  const liveSmokeRoot = path.join(
    process.cwd(),
    "docs",
    "reports",
    "live-smoke",
  );

  afterEach(() => {
    for (const run of ["zzzz-test-live-smoke-a", "zzzz-test-live-smoke-b"]) {
      fs.rmSync(path.join(liveSmokeRoot, run), {
        recursive: true,
        force: true,
      });
    }
  });

  it("returns the latest available live smoke summary", async () => {
    fs.mkdirSync(path.join(liveSmokeRoot, "zzzz-test-live-smoke-a"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(liveSmokeRoot, "zzzz-test-live-smoke-b"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(liveSmokeRoot, "zzzz-test-live-smoke-a", "summary.json"),
      JSON.stringify({ generatedAt: "2026-03-27T00:00:00.000Z", stage: "a" }),
    );
    fs.writeFileSync(
      path.join(liveSmokeRoot, "zzzz-test-live-smoke-b", "summary.json"),
      JSON.stringify({ generatedAt: "2026-03-27T01:00:00.000Z", stage: "b" }),
    );

    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/reports/live-smoke/route");
    const res = await GET(
      authedRequest("http://localhost/api/reports/live-smoke"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.latestRun).toBe("zzzz-test-live-smoke-b");
    expect(data.run).toBe("zzzz-test-live-smoke-b");
    expect(data.availableRuns).toEqual([
      "zzzz-test-live-smoke-b",
      "zzzz-test-live-smoke-a",
    ]);
    expect(data.summary).toMatchObject({ stage: "b" });
  });

  it("supports selecting a specific run", async () => {
    fs.mkdirSync(path.join(liveSmokeRoot, "zzzz-test-live-smoke-a"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(liveSmokeRoot, "zzzz-test-live-smoke-a", "summary.json"),
      JSON.stringify({ generatedAt: "2026-03-27T00:00:00.000Z", stage: "a" }),
    );

    const { GET } = await importRoute<{
      GET: (r: Request) => Promise<Response>;
    }>("@/app/api/reports/live-smoke/route");
    const res = await GET(
      authedRequest(
        "http://localhost/api/reports/live-smoke?run=zzzz-test-live-smoke-a",
      ),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requestedRun).toBe("zzzz-test-live-smoke-a");
    expect(data.run).toBe("zzzz-test-live-smoke-a");
    expect(data.summary).toMatchObject({ stage: "a" });
  });
});
