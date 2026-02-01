import { describe, it, expect, vi } from "vitest";
import { POST } from "../../app/api/admin/miniapps/publish/route";
import { edgeClient } from "../api-client";

vi.mock("../admin-auth", () => ({
  requireAdminAuth: () => null,
}));

vi.mock("../api-client", () => ({
  edgeClient: { post: vi.fn().mockResolvedValue({ success: true }) },
}));

describe("admin publish API", () => {
  it("requires submission_id", async () => {
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when service role key is missing", async () => {
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        submission_id: "submission-123",
        entry_url: "https://cdn.example.com/miniapps/app-id/v1/index.html",
        cdn_base_url: "https://cdn.example.com/miniapps/app-id/v1",
      }),
    });
    const res = await POST(req);

    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    expect(res.status).toBe(500);
  });

  it("forwards publish request with service role auth", async () => {
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const payload = {
      submission_id: "submission-123",
      entry_url: "https://cdn.example.com/miniapps/app-id/v1/index.html",
      cdn_base_url: "https://cdn.example.com/miniapps/app-id/v1",
    };
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify(payload) });

    await POST(req);

    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;

    const postMock = edgeClient.post as unknown as ReturnType<typeof vi.fn>;
    expect(postMock).toHaveBeenCalledWith(
      "/functions/v1/miniapp-publish",
      payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer service-key",
        }),
      }),
    );
  });
});
