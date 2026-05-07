import { describe, expect, it } from "vitest";

import {
  buildOneGateDirectMiniAppUrl,
  buildOneGateLaunchUrl,
  stableOneGateDappId,
} from "@shared/utils/onegate-launch";

describe("OneGate launch urls", () => {
  it("builds a stable OneGate dApp URL with app id, source, operation, network, and business params", () => {
    const url = new URL(
      buildOneGateLaunchUrl("miniapp-gas-lucky-pool", {
        operation: "claimPool",
        network: "testnet",
        poolId: "42",
        ref: "campaign a",
      }),
    );

    expect(url.origin).toBe("https://onegate.space");
    expect(url.pathname).toBe(`/app/${stableOneGateDappId("miniapp-gas-lucky-pool")}`);
    expect(url.searchParams.get("source")).toBe("onegate");
    expect(url.searchParams.get("appId")).toBe("miniapp-gas-lucky-pool");
    expect(url.searchParams.get("operation")).toBe("claimPool");
    expect(url.searchParams.get("network")).toBe("testnet");
    expect(url.searchParams.get("poolId")).toBe("42");
    expect(url.searchParams.get("ref")).toBe("campaign a");
  });

  it("omits empty or unsafe params instead of producing noisy QR payloads", () => {
    const url = new URL(
      buildOneGateLaunchUrl("miniapp-explorer", {
        q: "0xabc",
        empty: "",
        bad: undefined,
        "bad key": "dropped",
      }),
    );

    expect(url.searchParams.get("q")).toBe("0xabc");
    expect(url.searchParams.has("empty")).toBe(false);
    expect(url.searchParams.has("bad")).toBe(false);
    expect(url.searchParams.has("bad key")).toBe(false);
  });

  it("builds a direct NeoMini dApp URL that OneGate can scan without backend catalog lookup", () => {
    const url = new URL(
      buildOneGateDirectMiniAppUrl("gas-lucky-pool", "miniapp-gas-lucky-pool", {
        operation: "claimPool",
        network: "testnet",
        poolId: "42",
      }),
    );

    expect(url.origin).toBe("https://neomini.app");
    expect(url.pathname).toBe("/miniapps/gas-lucky-pool/index.html");
    expect(url.searchParams.get("source")).toBe("onegate");
    expect(url.searchParams.get("appId")).toBe("miniapp-gas-lucky-pool");
    expect(url.searchParams.get("operation")).toBe("claimPool");
    expect(url.searchParams.get("network")).toBe("testnet");
    expect(url.searchParams.get("poolId")).toBe("42");
  });
});
