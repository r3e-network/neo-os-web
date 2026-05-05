import { describe, expect, it } from "vitest";

import {
  getLaunchParam,
  parseMiniAppLaunchContext,
} from "@shared/utils/launch-params";

describe("launch params", () => {
  it("merges OneGate JSON payload with direct query params and lets direct params win", () => {
    const payload = encodeURIComponent(
      JSON.stringify({
        appId: "miniapp-redenvelope",
        operation: "createEnvelope",
        network: "testnet",
        params: {
          amount: "5",
          count: "8",
          memo: "from payload",
        },
      }),
    );

    const context = parseMiniAppLaunchContext(
      `https://neomini.app/miniapps/miniapp-redenvelope?source=onegate&launchParams=${payload}&amount=9`,
      "miniapp-redenvelope",
    );

    expect(context.appId).toBe("miniapp-redenvelope");
    expect(context.source).toBe("onegate");
    expect(context.operation).toBe("createEnvelope");
    expect(context.network).toBe("testnet");
    expect(context.params).toEqual({
      amount: "9",
      count: "8",
      memo: "from payload",
    });
    expect(context.hasParams).toBe(true);
  });

  it("keeps business params from hash query while stripping shell metadata", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/memorial-shrine/index.html?appId=miniapp-memorial-shrine&network=mainnet#/open?id=tribute-42&param.recipient=Nabc&tab=play&utm_source=qr",
      "miniapp-memorial-shrine",
    );

    expect(context.appId).toBe("miniapp-memorial-shrine");
    expect(context.network).toBe("mainnet");
    expect(context.tab).toBe("play");
    expect(context.params).toEqual({
      id: "tribute-42",
      recipient: "Nabc",
    });
  });

  it("supports aliases when reading a launch value", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/miniapp-explorer?q=0xabc",
    );

    expect(getLaunchParam(context, ["query", "q"], "")).toBe("0xabc");
    expect(getLaunchParam(context, ["missing"], "fallback")).toBe("fallback");
  });
});
