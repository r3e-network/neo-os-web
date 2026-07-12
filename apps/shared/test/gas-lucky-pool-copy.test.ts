import { describe, expect, it } from "vitest";

import { manifest } from "../../gas-lucky-pool/src/manifest";
import { messages } from "../../gas-lucky-pool/src/locale/messages";
import gasPoolNeoManifest from "../../gas-lucky-pool/neo-manifest.json";

type LocalizedMessage = {
  en: string;
  zh: string;
  ja?: string;
};

const gasPoolMessages = messages as Record<string, LocalizedMessage>;

describe("OneGate Vault copy", () => {
  it("uses OneGate Vault as the user-facing product name while keeping the stable app id", () => {
    expect(manifest.name).toBe("OneGate Vault");
    expect(gasPoolMessages.title.en).toBe("OneGate Vault");
    expect(gasPoolMessages.title.zh).toBe("OneGate 金库");
    expect(gasPoolNeoManifest.name).toBe("OneGate Vault");
    expect(gasPoolNeoManifest.name_zh).toBe("OneGate 金库");
    expect(gasPoolNeoManifest.id).toBe("miniapp-gas-lucky-pool");
  });

  it("describes the off-chain claim-key safety model", () => {
    for (const key of ["createPoolDescription", "claimPoolDescription", "docSafetyModel"]) {
      expect(gasPoolMessages[key].en.toLowerCase()).toMatch(/backend|server|key/);
      expect(gasPoolMessages[key].zh).toMatch(/后端|服务器|key/);
    }
  });

  it("fails closed while the published hashes do not expose RangeGasPool", () => {
    expect(gasPoolNeoManifest.operation_panel.operations).toEqual([]);
    expect(manifest.operations).toEqual([]);
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.permissions).toEqual(
      expect.objectContaining({ payments: false, randomness: false, oracle: false }),
    );
    expect(gasPoolNeoManifest.permissions).toEqual([]);
    expect(gasPoolNeoManifest.platform.transactions).toBe(false);
    expect(gasPoolNeoManifest.technologies.vrf.enabled).toBe(false);
  });

  it("presents the shipping surface as local play, not a GAS promise", () => {
    expect(manifest.description).toMatch(/free local lucky-draw/i);
    expect(gasPoolNeoManifest.description).toMatch(/free local lucky-draw/i);
    expect(gasPoolNeoManifest.description).toMatch(/No wallet, GAS, contract call, or oracle/i);
    expect(gasPoolMessages.guestSubtitle.en).toMatch(/No GAS, no wallet/i);
    expect(gasPoolMessages.luckPercentLabel.zh).toContain("运气超过");
  });

  it("ships Japanese copy for the OneGate scan claim flow", () => {
    const claimFlowKeys = [
      "title",
      "subtitle",
      "claimPoolTitle",
      "claimPoolDescription",
      "claimReward",
      "scanClaimReady",
      "scanClaimReview",
      "rewardRange",
      "noPoolSelected",
      "claimProgressTitle",
      "claimProgressWallet",
      "claimProgressSubmitting",
      "claimProgressConfirming",
      "claimProgressPaid",
      "claimProgressFailed",
      "claimCongratsTitle",
      "claimCongratsBody",
      "luckPercentLabel",
      "claimCongratsPending",
      "oneGateReady",
      "docOneGateFlow",
    ];

    for (const key of claimFlowKeys) {
      expect(gasPoolMessages[key].ja, key).toEqual(expect.any(String));
      expect(gasPoolMessages[key].ja?.trim(), key).not.toBe("");
      expect(gasPoolMessages[key].ja, key).not.toBe(gasPoolMessages[key].en);
    }
  });

  it("does not expose legacy on-chain pool counters in the Vault shell", () => {
    expect(manifest.stats ?? []).toEqual([]);
    expect(manifest.sidebar).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toMatch(
      /activePools|totalPools|poolCount|activePoolCount/,
    );
  });
});
