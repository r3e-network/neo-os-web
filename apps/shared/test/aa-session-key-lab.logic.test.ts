import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { AAService, ChainService, EventBus } from "../services";
import { useAASessionKeyLab } from "../../aa-session-key-lab/src/composables/useAASessionKeyLab";
import { getSessionKeyLaunchDefaults } from "../../aa-session-key-lab/src/launch";

function t(key: string) {
  return key;
}

describe("AA Session Key Lab logic", () => {
  it("passes paymaster dApp scope and sponsor amount into sponsorship requests", async () => {
    const aa = {
      checkSponsorship: vi.fn().mockResolvedValue({ eligible: true }),
      requestSponsorship: vi.fn().mockResolvedValue({ approved: true }),
      isCheckingSponsorship: createObservable(false),
    } as unknown as AAService;
    const chain = {} as ChainService;
    const eventBus = { emit: vi.fn() } as unknown as EventBus;
    const lab = useAASessionKeyLab({ aa, chain, eventBus, t });

    lab.form.dappId = "miniapp-aa-session-key-lab";
    lab.form.sponsorAmount = "0.2";

    await lab.checkSponsor();
    expect(aa.checkSponsorship).toHaveBeenCalledWith({
      dappId: "miniapp-aa-session-key-lab",
    });

    await lab.requestSponsor();
    expect(aa.requestSponsorship).toHaveBeenCalledWith("0.2", {
      dappId: "miniapp-aa-session-key-lab",
    });
  });

  it("normalizes launch aliases from host action links", () => {
    const defaults = getSessionKeyLaunchDefaults({
      params: {
        accountId: "neo-aa-001",
        publicKey: "02abcdef",
        contract: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
        method: "claimRewards",
        expiry: "1893456000",
        paymaster: "miniapp-aa-session-key-lab",
        gas: "0.2",
      },
    });

    expect(defaults).toEqual({
      accountSeed: "neo-aa-001",
      sessionPublicKey: "02abcdef",
      targetContract: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
      allowedMethod: "claimRewards",
      expiresAt: "1893456000",
      dappId: "miniapp-aa-session-key-lab",
      sponsorAmount: "0.2",
    });
  });

  it("does not expose generated private key in detail rows", () => {
    const aa = {
      checkSponsorship: vi.fn(),
      requestSponsorship: vi.fn(),
      isCheckingSponsorship: createObservable(false),
    } as unknown as AAService;
    const chain = {} as ChainService;
    const eventBus = { emit: vi.fn() } as unknown as EventBus;
    const lab = useAASessionKeyLab({ aa, chain, eventBus, t });

    lab.generateSessionKey();

    const privateKey = lab.generatedPrivateKey.get();
    const details = lab.detailItems.get();
    expect(privateKey).toMatch(/^[0-9a-f]{64}$/i);
    expect(details.map((item) => item.value)).not.toContain(privateKey);
    expect(details.map((item) => item.label)).not.toContain(
      "sessionPrivateKey",
    );
  });

  it("summarizes sponsorship state as user-facing fields instead of JSON", async () => {
    const aa = {
      checkSponsorship: vi.fn().mockResolvedValue({
        eligible: true,
        amount: "0.2",
        requestId: "sponsor-001",
      }),
      requestSponsorship: vi.fn(),
      isCheckingSponsorship: createObservable(false),
    } as unknown as AAService;
    const chain = {} as ChainService;
    const eventBus = { emit: vi.fn() } as unknown as EventBus;
    const lab = useAASessionKeyLab({ aa, chain, eventBus, t });

    await lab.checkSponsor();

    const details = lab.detailItems.get();
    expect(details).toContainEqual({
      label: "sponsorship",
      value: "sponsorEligible",
    });
    expect(details).toContainEqual({
      label: "sponsorAmount",
      value: "0.2",
    });
    expect(details).toContainEqual({
      label: "sponsorRequestId",
      value: "sponsor-001",
    });
    expect(details.map((item) => item.value)).not.toContain(
      JSON.stringify(
        { eligible: true, amount: "0.2", requestId: "sponsor-001" },
        null,
        2,
      ),
    );
  });
});
