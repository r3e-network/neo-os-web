import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { AAService, ChainService } from "../services";
import { createMiniAppFramework } from "../react";
import { useAARelayConsole } from "../../aa-relay-console/src/composables/useAARelayConsole";
import { getRelayLaunchDefaults } from "../../aa-relay-console/src/launch";
import { getExternalIntegrationConfig } from "../constants/rpc";

function t(key: string) {
  return key;
}

function makeApp(aa: AAService) {
  const chain = {
    address: createObservable<string | null>(null),
  } as unknown as ChainService;
  return createMiniAppFramework(
    { services: { chain, aa }, t } as never,
    { appId: "miniapp-aa-relay-console" },
  );
}

describe("AA Relay Console logic", () => {
  it("passes AA and paymaster scope into sponsorship and relay requests", async () => {
    const aa = {
      checkSponsorship: vi.fn().mockResolvedValue({ eligible: true }),
      requestSponsorship: vi.fn().mockResolvedValue({ approved: true }),
      submitRelay: vi.fn().mockResolvedValue({ txid: "0xrelay" }),
    } as unknown as AAService;
    const relay = useAARelayConsole({ app: makeApp(aa), t });

    relay.aaAddress.set("NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3");
    relay.dappId.set("miniapp-aa-relay-console");
    relay.sponsorAmount.set("0.2");
    relay.payloadJson.set('{"metaInvocation":{"operation":"transfer"}}');

    await relay.checkSponsor();
    expect(aa.checkSponsorship).toHaveBeenCalledWith({
      aaAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
      dappId: "miniapp-aa-relay-console",
    });

    await relay.requestSponsor();
    expect(aa.requestSponsorship).toHaveBeenCalledWith("0.2", {
      aaAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
      dappId: "miniapp-aa-relay-console",
    });

    await relay.submitRelay();
    expect(aa.submitRelay).toHaveBeenCalledWith(
      expect.objectContaining({
        aaAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        metaInvocation: { operation: "transfer" },
        paymaster: {
          dapp_id: "miniapp-aa-relay-console",
          network: "mainnet",
        },
      }),
    );
  });

  it("normalizes launch aliases from host action links", () => {
    const defaults = getRelayLaunchDefaults({
      params: {
        aa: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        paymaster: "miniapp-aa-relay-console",
        gas: "0.08",
        payload: '{"metaInvocation":{"operation":"transfer"}}',
      },
    });

    expect(defaults).toEqual({
      aaAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
      dappId: "miniapp-aa-relay-console",
      sponsorAmount: "0.08",
      payloadJson: '{"metaInvocation":{"operation":"transfer"}}',
    });
  });

  it("builds the default relay payload from the selected network AA core", () => {
    const mainnetHash = getExternalIntegrationConfig("mainnet").contracts.aaCore;
    const testnetHash = getExternalIntegrationConfig("testnet").contracts.aaCore;

    const mainnetDefaults = getRelayLaunchDefaults({
      network: "mainnet",
      params: {},
    });
    const testnetDefaults = getRelayLaunchDefaults({
      network: "testnet",
      params: {},
    });

    expect(mainnetDefaults.payloadJson).toContain(mainnetHash);
    expect(mainnetDefaults.payloadJson).not.toContain(testnetHash);
    expect(testnetDefaults.payloadJson).toContain(testnetHash);
    expect(testnetDefaults.payloadJson).not.toContain(mainnetHash);
  });
});
