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

  it("reads launch param aliases without treating shell metadata as params", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/miniapp-explorer?appId=miniapp-explorer&op=search&q=12345&source=onegate",
    );

    expect(context.operation).toBe("search");
    expect(context.params).toEqual({ q: "12345" });
    expect(getLaunchParam(context, ["query", "q"], "")).toBe("12345");
  });
});
