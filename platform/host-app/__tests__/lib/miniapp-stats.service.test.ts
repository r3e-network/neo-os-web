describe("miniapp stats service", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("delegates live status to chain-specific query helpers", async () => {
    const chainLiveStatus = jest.fn().mockResolvedValue({
      appId: "miniapp-doomsday-clock",
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
      "miniapp-doomsday-clock",
      "0xf0914d411877c8393c029f48ec0c4c64d44f1b49",
      "gaming",
      "testnet",
    );

    expect(chainLiveStatus).toHaveBeenCalledWith(
      "miniapp-doomsday-clock",
      "0xf0914d411877c8393c029f48ec0c4c64d44f1b49",
      "gaming",
      "testnet",
    );
    expect(status).toEqual({
      appId: "miniapp-doomsday-clock",
      jackpot: "5",
      playersOnline: 9,
      nextDraw: 86400,
    });
  });
});
