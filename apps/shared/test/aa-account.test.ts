import { describe, expect, it } from "vitest";
import {
  buildAnchorAgentVerifierParam,
  deriveAnchorAgentAccounts,
  deriveRegistrationAccountIdHash,
} from "../utils/aa-account";

describe("AA registration-bound account helpers", () => {
  it("matches the UnifiedSmartWallet V3 registration vector", () => {
    const accountId = deriveRegistrationAccountIdHash({
      verifierContractHash: "0x5be915aea3ce85e4752d522632f0a9520e377aaf",
      verifierParamsHex: "11223344",
      backupOwnerAddress: "0x13ef519c362973f9a34648a9eac5b71250b2a80a",
      escapeTimelock: 2_592_000,
    });

    expect(accountId).toBe("27c01243fca45e1b821dc3bb45267a579762d530");
  });

  it("derives the 21 deterministic Custom Anchor AA agents from app and nonce material", () => {
    const agents = deriveAnchorAgentAccounts({
      seedPrefix: "customanchor",
      appId: "custom-anchor:demo",
      nonce: "nonce-001",
      backupOwnerAddress: "0x13ef519c362973f9a34648a9eac5b71250b2a80a",
    });

    expect(agents).toHaveLength(21);
    expect(new Set(agents.map((agent) => agent.accountIdHash)).size).toBe(21);
    expect(agents[0]).toMatchObject({
      agentId: 1,
      verifierParams: "anchor:customanchor:app:custom-anchor:demo:agent:01:nonce:nonce-001",
      verifierParamsHex: "616e63686f723a637573746f6d616e63686f723a6170703a637573746f6d2d616e63686f723a64656d6f3a6167656e743a30313a6e6f6e63653a6e6f6e63652d303031",
    });
    expect(agents[20]?.verifierParams).toBe(
      "anchor:customanchor:app:custom-anchor:demo:agent:21:nonce:nonce-001",
    );
    for (const agent of agents) {
      expect(agent.accountIdHash).toMatch(/^[0-9a-f]{40}$/);
      expect(agent.accountId).toBe(`0x${agent.accountIdHash}`);
    }
  });

  it("rejects invalid agent ids before building verifier params", () => {
    expect(() =>
      buildAnchorAgentVerifierParam({
        seedPrefix: "customanchor",
        appId: "custom-anchor:demo",
        agentId: 22,
        nonce: "nonce-001",
      }),
    ).toThrow(/agent id/i);
  });
});
