import {
  buildLaunchParamValues,
  getLaunchParam,
  parseMiniAppLaunchContext,
} from "@/lib/miniapp-launch-params";

describe("miniapp-launch-params", () => {
  it("parses OneGate URL params into a stable launch context", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/miniapp-neo-pay?source=onegate&operation=createStream&recipient=Ntest&amount=12.5&network=testnet",
      "miniapp-neo-pay",
    );

    expect(context.source).toBe("onegate");
    expect(context.operation).toBe("createStream");
    expect(context.network).toBe("testnet");
    expect(context.params).toEqual({
      recipient: "Ntest",
      amount: "12.5",
    });
    expect(context.signature).toContain("amount=12.5");
  });

  it("maps launch params onto operation defaults by param name", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/miniapp-fogplay?side=tails&amount=0.25",
    );

    expect(
      buildLaunchParamValues(
        [
          { name: "side", type: "select", options: ["heads", "tails"] },
          { name: "amount", type: "amount", default_value: "0.1" },
          { name: "memo", type: "string", default_value: "default memo" },
        ],
        context.params,
      ),
    ).toEqual({
      side: "tails",
      amount: "0.25",
      memo: "default memo",
    });
  });

  it("maps concise OneGate QR aliases onto operation param names", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/gas-lucky-pool/index.html?pool=campaign-a&key=ogv_user_42&source=onegate",
      "miniapp-gas-lucky-pool",
    );

    expect(
      buildLaunchParamValues(
        [
          { name: "poolId", type: "string", required: true },
          { name: "claimKey", type: "string", required: true },
        ],
        context.params,
      ),
    ).toEqual({
      poolId: "campaign-a",
      claimKey: "ogv_user_42",
    });
  });

  it("maps legacy GasBox machine params onto the explicit machineId field", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/gasbox/index.html?operation=prepareMiniAppOperation&machine=1",
      "miniapp-gasbox",
    );

    expect(
      buildLaunchParamValues(
        [{ name: "machineId", type: "string" }],
        context.params,
      ),
    ).toEqual({ machineId: "1" });
  });

  it("maps AA account aliases onto the accountIdHash field", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/aa-permissions-lab/index.html?operation=prepareMiniAppOperation&accountId=0x1111111111111111111111111111111111111111",
      "miniapp-aa-permissions-lab",
    );

    expect(
      buildLaunchParamValues(
        [{ name: "accountIdHash", type: "hash160", required: true }],
        context.params,
      ),
    ).toEqual({
      accountIdHash: "0x1111111111111111111111111111111111111111",
    });
  });

  it("maps AA session key aliases onto explicit session fields", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/aa-session-key-lab/index.html?operation=prepareMiniAppOperation&accountId=neo-aa-001&publicKey=02abcdef&contract=0xaba84da240a55410d284a656fc8dae044e6ec1a5&method=claimRewards&expiry=1893456000&paymaster=miniapp-aa-session-key-lab&gas=0.2",
      "miniapp-aa-session-key-lab",
    );

    expect(
      buildLaunchParamValues(
        [
          { name: "accountSeed", type: "string", required: true },
          { name: "sessionPublicKey", type: "string" },
          { name: "targetContract", type: "hash160", required: true },
          { name: "allowedMethod", type: "string", required: true },
          { name: "expiresAt", type: "integer", required: true },
          { name: "dappId", type: "string" },
          { name: "sponsorAmount", type: "amount" },
        ],
        context.params,
      ),
    ).toEqual({
      accountSeed: "neo-aa-001",
      sessionPublicKey: "02abcdef",
      targetContract: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
      allowedMethod: "claimRewards",
      expiresAt: "1893456000",
      dappId: "miniapp-aa-session-key-lab",
      sponsorAmount: "0.2",
    });
  });

  it("reads launch param aliases without treating shell metadata as params", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/miniapp-explorer?appId=miniapp-explorer&op=search&q=12345&source=onegate",
    );

    expect(context.operation).toBe("search");
    expect(context.params).toEqual({ q: "12345" });
    expect(getLaunchParam(context, ["query", "q"], "")).toBe("12345");
  });
});
