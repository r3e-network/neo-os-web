import {
  buildCustomAnchorAppId,
  buildCustomAnchorRegistrationPlan,
  parseAnchorCandidateKeys,
} from "@/lib/custom-anchor";
import { addressToScriptHash } from "@/lib/chain";

const OWNER = "0x13ef519c362973f9a34648a9eac5b71250b2a80a";
const ANCHOR = "0x02beeef6f65c6989a121c0a0e6b23190333edb98";
const AA = "0x0268a387913b250166ddec032b03332690a1ef78";
const CANDIDATES = Array.from({ length: 21 }, (_, index) =>
  `02${String(index + 1).padStart(64, "0")}`,
);

describe("custom anchor registration plan", () => {
  it("builds compact custom app ids from user-provided slug and nonce", () => {
    expect(buildCustomAnchorAppId("My Anchor!", "Nonce 001")).toBe(
      "custom-anchor:my-anchor:nonce-001",
    );
  });

  it("parses exactly 21 compressed candidate keys", () => {
    expect(parseAnchorCandidateKeys(CANDIDATES.join("\n"))).toEqual(CANDIDATES);
    expect(() => parseAnchorCandidateKeys(CANDIDATES.slice(0, 20).join("\n"))).toThrow(
      /exactly 21/i,
    );
  });

  it("creates one atomic AA batch + anchor app + agent registration transaction plan", () => {
    const plan = buildCustomAnchorRegistrationPlan({
      anchorContractHash: ANCHOR,
      aaCoreHash: AA,
      ownerAddress: OWNER,
      slug: "demo",
      nonce: "n1",
      mode: "profit",
      candidateKeys: CANDIDATES,
    });

    expect(plan.appId).toBe("custom-anchor:demo:n1");
    expect(plan.mode).toBe(2);
    expect(plan.agents).toHaveLength(21);
    expect(plan.invocations).toHaveLength(3);
    expect(plan.invocations.map((item) => item.operation)).toEqual([
      "registerAccounts",
      "registerCustomAnchorApp",
      "registerAgents",
    ]);
    expect(plan.invocations[0]?.args[0]).toMatchObject({
      type: "Array",
      value: expect.arrayContaining([
        expect.objectContaining({ type: "Hash160", value: plan.agents[0]?.accountId }),
      ]),
    });
    expect(plan.invocations[1]?.args).toEqual([
      { type: "String", value: "custom-anchor:demo:n1" },
      { type: "Integer", value: "2" },
      { type: "Hash160", value: OWNER },
    ]);
    expect(plan.invocations[2]?.args[2]).toMatchObject({
      type: "Array",
      value: expect.arrayContaining([
        expect.objectContaining({ type: "PublicKey", value: CANDIDATES[0] }),
      ]),
    });
  });

  it("normalizes owner addresses to Hash160 before building NEP-21 invocations", () => {
    const ownerAddress = "NPAsqZkx9WhNd4P72uhZxBhLinSuNkxfB8";
    const ownerHash = addressToScriptHash(ownerAddress);
    const plan = buildCustomAnchorRegistrationPlan({
      anchorContractHash: ANCHOR,
      aaCoreHash: AA,
      ownerAddress,
      slug: "demo",
      nonce: "n1",
      mode: "trust",
      candidateKeys: CANDIDATES,
    });

    expect(plan.invocations[0]?.args[4]).toEqual({
      type: "Hash160",
      value: ownerHash,
    });
    expect(plan.invocations[1]?.args[2]).toEqual({
      type: "Hash160",
      value: ownerHash,
    });
  });
});
