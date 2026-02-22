import { appendPublishApprovalAuditEvent } from "@/lib/publish-approval-audit";

function makeSupabaseMock() {
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const insert = jest.fn().mockResolvedValue({ error: null });

  const from = jest.fn((table: string) => {
    if (table === "miniapp_publish_request_audit") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({ maybeSingle })),
            })),
          })),
        })),
        insert,
      };
    }
    return {
      select: jest.fn(),
      insert: jest.fn(),
    };
  });

  return {
    supabase: { from } as unknown as Parameters<typeof appendPublishApprovalAuditEvent>[0],
    insert,
  };
}

describe("publish approval audit", () => {
  it("appends immutable audit chain record", async () => {
    const { supabase, insert } = makeSupabaseMock();

    await appendPublishApprovalAuditEvent(supabase, {
      request_id: "11111111-1111-4111-8111-111111111111",
      app_id: "miniapp-market",
      actor: "reviewer-wallet",
      action: "request_approved",
      status: "approved",
      payload: {
        reason: "qa-pass",
      },
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const [payload] = insert.mock.calls[0] as [Record<string, unknown>];
    expect(payload.request_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.app_id).toBe("miniapp-market");
    expect(payload.action).toBe("request_approved");
    expect(typeof payload.chain_hash).toBe("string");
    expect(String(payload.chain_hash).length).toBeGreaterThan(0);
  });
});
