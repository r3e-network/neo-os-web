import { sendPublishReminders } from "@/lib/publish-reminder";

describe("publish reminder sender", () => {
  const originalWebhook = process.env.MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL;
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;

  afterEach(() => {
    process.env.MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL = originalWebhook;
    if (originalFetch) {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
    jest.restoreAllMocks();
  });

  it("returns disabled channel when webhook missing", async () => {
    process.env.MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL = "";

    const result = await sendPublishReminders({
      dryRun: true,
      requests: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          app_id: "miniapp-market",
          status: "pending",
          timing: {
            ageMinutes: 200,
            isSlaBreached: true,
            isEscalated: true,
          },
        },
      ] as any,
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("disabled");
    expect(result.reminders.length).toBe(1);
  });

  it("posts reminder payload when webhook configured", async () => {
    process.env.MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL = "https://example.com/webhook";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    } as Response);
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const result = await sendPublishReminders({
      dryRun: false,
      requests: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          app_id: "miniapp-market",
          status: "pending",
          timing: {
            ageMinutes: 200,
            isSlaBreached: true,
            isEscalated: false,
          },
        },
      ] as any,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.channel).toBe("webhook");
  });
});
