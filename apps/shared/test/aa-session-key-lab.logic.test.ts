import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { AAService, ChainService, EventBus } from "../services";
import { useAASessionKeyLab } from "../../aa-session-key-lab/src/composables/useAASessionKeyLab";
import { getSessionKeyLaunchDefaults } from "../../aa-session-key-lab/src/launch";

// Mockable wallet so configure/revoke tests can capture invokeContract args.
const invokeContractMock = vi.fn();
vi.mock("../utils/wallet-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/wallet-sdk")>();
  return {
    ...actual,
    useWallet: () => ({
      address: { value: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32" },
      connect: vi.fn().mockResolvedValue(undefined),
      invokeContract: invokeContractMock,
    }),
  };
});

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

  describe("session key configuration arity (frozen verifier contracts)", () => {
    const PUBLIC_KEY = `03${"11".repeat(32)}`;
    const TARGET = "0xaba84da240a55410d284a656fc8dae044e6ec1a5";

    beforeEach(() => {
      invokeContractMock.mockReset();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function setupLab() {
      const aa = {
        checkSponsorship: vi.fn(),
        requestSponsorship: vi.fn(),
        isCheckingSponsorship: createObservable(false),
      } as unknown as AAService;
      // chain.read is the verifier confirmation poll; echo the pubKey so the
      // configure flow confirms immediately.
      const chain = {
        read: vi.fn().mockResolvedValue({ key: PUBLIC_KEY }),
      } as unknown as ChainService;
      const eventBus = { emit: vi.fn() } as unknown as EventBus;
      return useAASessionKeyLab({ aa, chain, eventBus, t });
    }

    it("forwards 7 inner setSessionKey args on the mainnet default network", async () => {
      vi.useFakeTimers();
      invokeContractMock.mockResolvedValue({ txid: "0xtx" });
      const lab = setupLab();
      lab.form.accountSeed = "neo-aa-001";
      lab.form.sessionPublicKey = PUBLIC_KEY;
      lab.form.targetContract = TARGET;
      lab.form.allowedMethod = "claimRewards";
      lab.form.expiresAt = String(Math.floor(Date.now() / 1000) + 3600);
      lab.form.spendingLimit = "1.5";
      lab.form.description = "rewards bot";

      const pending = lab.configureSessionKey();
      await vi.runAllTimersAsync();
      await pending;

      const call = invokeContractMock.mock.calls[0][0];
      expect(call.operation).toBe("callVerifier");
      // The inner setSessionKey arg array carries 7 entries on mainnet.
      const innerArray = call.args[2];
      expect(innerArray.type).toBe("Array");
      expect(innerArray.value).toHaveLength(7);
      // spendingLimit converted to base units (1.5 GAS -> 150000000).
      expect(innerArray.value[5]).toEqual({
        type: "Integer",
        value: "150000000",
      });
      expect(innerArray.value[6]).toEqual({
        type: "String",
        value: "rewards bot",
      });
    });

    it("revokes via clearSessionKey on the verifier", async () => {
      invokeContractMock.mockResolvedValue({ txid: "0xtx" });
      const lab = setupLab();
      lab.form.accountSeed = "neo-aa-001";

      await lab.revokeSessionKey();

      const call = invokeContractMock.mock.calls[0][0];
      expect(call.operation).toBe("callVerifier");
      expect(call.args[1]).toEqual({ type: "String", value: "clearSessionKey" });
      expect(lab.hasOnChainSession.get()).toBe(false);
    });
  });
});
