describe("miniapp stats service", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("delegates live status to chain-specific query helpers", async () => {
    const chainLiveStatus = jest.fn().mockResolvedValue({
      appId: "miniapp-last-survivor",
      jackpot: "5",
      playersOnline: 9,
      nextDraw: 86400,
    });

    jest.doMock("../../lib/chain", () => ({
      FLAGSHIP_APPS: {},
      getContractStats: jest.fn(),
      getLiveStatus: chainLiveStatus,
    }));

    const { getLiveStatus } = require("../../lib/miniapp-stats/service");
    const status = await getLiveStatus(
      "miniapp-last-survivor",
      "0xf0914d411877c8393c029f48ec0c4c64d44f1b49",
      "gaming",
      "testnet",
    );

    expect(chainLiveStatus).toHaveBeenCalledWith(
      "miniapp-last-survivor",
      "0xf0914d411877c8393c029f48ec0c4c64d44f1b49",
      "gaming",
      "testnet",
    );
    expect(status).toEqual({
      appId: "miniapp-last-survivor",
      jackpot: "5",
      playersOnline: 9,
      nextDraw: 86400,
    });
  });

  it("returns shared-mode live status for bundled shared apps", async () => {
    const sharedLiveStatus = jest.fn().mockResolvedValue({
      appId: "miniapp-neo-pay-shared-example",
      tvl: "0",
      volume24h: "7",
    });

    jest.doMock("../../lib/chain", () => ({
      FLAGSHIP_APPS: {},
      getContractStats: jest.fn(),
      getLiveStatus: jest.fn(),
      getSharedModeContractStats: jest.fn(),
      getSharedModeLiveStatus: sharedLiveStatus,
    }));
    jest.doMock("../../lib/miniapp-definitions", () => ({
      loadBundledMiniAppById: jest.fn().mockResolvedValue({
        app_id: "miniapp-neo-pay-shared-example",
        category: "defi",
        contract_hash: null,
        manifest: {
          contract_composition: { mode: "shared" },
        },
      }),
    }));
    jest.doMock("../../lib/chain/shared-mode", () => ({
      isSharedModeApp: jest.fn().mockReturnValue(true),
    }));

    const { getLiveStatus } = require("../../lib/miniapp-stats/service");
    const status = await getLiveStatus(
      "miniapp-neo-pay-shared-example",
      "",
      "defi",
      "testnet",
    );

    expect(sharedLiveStatus).toHaveBeenCalled();
    expect(status).toEqual({
      appId: "miniapp-neo-pay-shared-example",
      tvl: "0",
      volume24h: "7",
    });
  });
});
