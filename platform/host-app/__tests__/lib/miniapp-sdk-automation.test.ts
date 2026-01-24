import { installMiniAppSDK } from "@/lib/miniapp-sdk";

jest.mock("@/lib/sdk/client.js", () => ({
  createMiniAppSDK: jest.fn(() => ({
    wallet: {},
    payments: {},
    governance: {},
    rng: {},
    datafeed: {},
    stats: {},
    events: {},
    transactions: {},
  })),
}));

describe("MiniApp SDK automation", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) })) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("includes credentials when calling automation endpoints", async () => {
    const sdk = installMiniAppSDK({ appId: "app-1", chainId: null, permissions: { automation: true } });
    await sdk!.automation!.register("task", "cron");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/automation/register",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
