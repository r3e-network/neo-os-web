import { __test__ } from "@/lib/oauth/store";

describe("waitForOAuthCallback", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("ignores same-origin messages that do not come from the popup window", async () => {
    const popup = {} as Window;
    const promise = __test__.waitForOAuthCallback(popup, "google");

    // Message from same origin but from window itself, NOT the popup
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://app.example.com",
        source: window,
        data: {
          type: "oauth-success",
          provider: "google",
          account: {
            provider: "google",
            id: "forged",
            linkedAt: "2026-04-06T00:00:00.000Z",
          },
        },
      }),
    );

    jest.advanceTimersByTime(120_000);
    await expect(promise).rejects.toThrow("OAuth timeout");
  });

  it("rejects when NEXT_PUBLIC_APP_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const popup = {} as Window;
    const promise = __test__.waitForOAuthCallback(popup, "google");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.com",
        source: popup,
        data: { type: "oauth-success", provider: "google", account: {} },
      }),
    );

    await expect(promise).rejects.toThrow("OAuth callback origin not configured");
  });

  it("ignores messages from wrong origin", async () => {
    const popup = {} as Window;
    const promise = __test__.waitForOAuthCallback(popup, "google");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.com",
        source: popup,
        data: {
          type: "oauth-success",
          provider: "google",
          account: { provider: "google", id: "test", linkedAt: "2026-01-01" },
        },
      }),
    );

    jest.advanceTimersByTime(120_000);
    await expect(promise).rejects.toThrow("OAuth timeout");
  });

  it("accepts messages from the correct popup and origin", async () => {
    const popup = {} as Window;
    const promise = __test__.waitForOAuthCallback(popup, "google");

    const expectedAccount = {
      provider: "google" as const,
      id: "real-user",
      linkedAt: "2026-04-06T00:00:00.000Z",
    };

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://app.example.com",
        source: popup,
        data: {
          type: "oauth-success",
          provider: "google",
          account: expectedAccount,
        },
      }),
    );

    await expect(promise).resolves.toEqual(expectedAccount);
  });
});
