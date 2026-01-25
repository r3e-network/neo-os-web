import { describe, it, expect, vi } from "vitest";
import { POST } from "../../app/api/admin/miniapps/publish/route";

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
});
