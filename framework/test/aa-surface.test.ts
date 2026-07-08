/**
 * S10 app.aa surface spec (framework-extraction plan §2/S10).
 *
 * Covers: typed FrameworkCapabilityError when the host lacks AA,
 * sponsorship/relay/session-key passthrough to the injected service, and the
 * pure aa-account derivation helpers moved into framework/utils (shared
 * re-export identity + the UnifiedSmartWallet V3 registration vector).
 *
 * NOTE: the apps/shared import below is intentional and allowed here — the
 * boundary test only forbids shared imports from framework *sources*
 * (framework/test is excluded); it exists to prove the shared surface is a
 * re-export of the framework canonical.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createAaSurface,
  FrameworkCapabilityError,
  deriveAAAccountIdHash,
  deriveAnchorAgentAccounts,
  deriveRegistrationAccountIdHash,
  generateAASessionKeyPair,
} from "../aa";
import type {
  FrameworkAaService,
  FrameworkAaSponsorScope,
} from "../aa";
import { MiniAppError } from "../utils/errors";

// Shared re-export surface — must resolve to the SAME module instances.
import {
  deriveAAAccountIdHash as sharedDeriveAAAccountIdHash,
  deriveAnchorAgentAccounts as sharedDeriveAnchorAgentAccounts,
  deriveRegistrationAccountIdHash as sharedDeriveRegistrationAccountIdHash,
  generateAASessionKeyPair as sharedGenerateAASessionKeyPair,
} from "../../apps/shared/utils/aa-account";

function fakeAaService(overrides: Partial<FrameworkAaService> = {}): FrameworkAaService {
  return {
    checkSponsorship: vi.fn(async () => ({ eligible: true, remaining: 3 })),
    requestSponsorship: vi.fn(async () => ({ approved: true, txid: "0xsponsor" })),
    submitRelay: vi.fn(async () => ({ txid: "0xrelay", status: "accepted" })),
    createSessionKey: vi.fn(async () => ({ created: true })),
    ...overrides,
  };
}

describe("app.aa — capability gating", () => {
  it("throws a typed FrameworkCapabilityError from every method when the host lacks AA", async () => {
    const aa = createAaSurface({});

    expect(aa.available).toBe(false);
    for (const call of [
      () => aa.sponsorship.check(),
      () => aa.sponsorship.request("0.1"),
      () => aa.relay({ metaInvocation: {} }),
      () => aa.sessionKey.create({ scope: "invoke" }, Date.now() + 60_000),
    ]) {
      const error = await call().then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(FrameworkCapabilityError);
      expect(error).toBeInstanceOf(MiniAppError);
      expect((error as FrameworkCapabilityError).capability).toBe("aa");
      expect((error as FrameworkCapabilityError).code).toBe("CAPABILITY_UNAVAILABLE");
    }
  });

  it("treats an explicit null service the same as an absent one", async () => {
    const aa = createAaSurface({ aa: null });

    expect(aa.available).toBe(false);
    await expect(aa.sponsorship.check()).rejects.toBeInstanceOf(FrameworkCapabilityError);
  });

  it("tags a missing session-key lane with its own capability id", async () => {
    const service = fakeAaService();
    delete (service as { createSessionKey?: unknown }).createSessionKey;
    const aa = createAaSurface({ aa: service });

    expect(aa.available).toBe(true);
    const error = await aa.sessionKey.create({}, 1).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(FrameworkCapabilityError);
    expect((error as FrameworkCapabilityError).capability).toBe("aa.sessionKey");
  });
});

describe("app.aa — service passthrough", () => {
  it("passes sponsorship checks through with the caller's scope", async () => {
    const service = fakeAaService();
    const aa = createAaSurface({ aa: service });
    const scope: FrameworkAaSponsorScope = { aaAddress: "NAddr", dappId: "dice-game" };

    await expect(aa.sponsorship.check(scope)).resolves.toEqual({
      eligible: true,
      remaining: 3,
    });
    expect(service.checkSponsorship).toHaveBeenCalledTimes(1);
    expect(service.checkSponsorship).toHaveBeenCalledWith(scope);
  });

  it("passes sponsorship requests through with amount and scope", async () => {
    const service = fakeAaService();
    const aa = createAaSurface({ aa: service });

    await expect(aa.sponsorship.request("0.25", { dappId: "gasbox" })).resolves.toEqual({
      approved: true,
      txid: "0xsponsor",
    });
    expect(service.requestSponsorship).toHaveBeenCalledWith("0.25", { dappId: "gasbox" });
  });

  it("passes relay payloads through untouched and surfaces the relay result", async () => {
    const service = fakeAaService();
    const aa = createAaSurface({ aa: service });
    const payload = { metaInvocation: { operation: "transfer" }, simulate: true };

    await expect(aa.relay(payload)).resolves.toEqual({ txid: "0xrelay", status: "accepted" });
    expect(service.submitRelay).toHaveBeenCalledWith(payload);
  });

  it("delegates session-key creation to the host lane", async () => {
    const service = fakeAaService();
    const aa = createAaSurface({ aa: service });
    const permissions = { contracts: ["0xabc"], maxGas: "1" };

    await expect(aa.sessionKey.create(permissions, 1234)).resolves.toEqual({ created: true });
    expect(service.createSessionKey).toHaveBeenCalledWith(permissions, 1234);
  });

  it("propagates service failures instead of swallowing them", async () => {
    const service = fakeAaService({
      submitRelay: vi.fn(async () => {
        throw new Error("AA relay not submitted: quota exceeded");
      }),
    });
    const aa = createAaSurface({ aa: service });

    await expect(aa.relay({})).rejects.toThrow("quota exceeded");
  });
});

describe("aa-account pure helpers (moved into framework/utils)", () => {
  it("re-exports the SAME function identities through apps/shared", () => {
    expect(sharedDeriveAAAccountIdHash).toBe(deriveAAAccountIdHash);
    expect(sharedDeriveRegistrationAccountIdHash).toBe(deriveRegistrationAccountIdHash);
    expect(sharedDeriveAnchorAgentAccounts).toBe(deriveAnchorAgentAccounts);
    expect(sharedGenerateAASessionKeyPair).toBe(generateAASessionKeyPair);
  });

  it("still matches the UnifiedSmartWallet V3 registration vector after the move", () => {
    const accountId = deriveRegistrationAccountIdHash({
      verifierContractHash: "0x5be915aea3ce85e4752d522632f0a9520e377aaf",
      verifierParamsHex: "11223344",
      backupOwnerAddress: "0x13ef519c362973f9a34648a9eac5b71250b2a80a",
      escapeTimelock: 2_592_000,
    });

    expect(accountId).toBe("27c01243fca45e1b821dc3bb45267a579762d530");
  });

  it("passes existing 20-byte hashes through and hashes free-form seeds deterministically", () => {
    expect(deriveAAAccountIdHash("0xABCDEF0123456789abcdef0123456789ABCDEF01")).toBe(
      "abcdef0123456789abcdef0123456789abcdef01",
    );
    const first = deriveAAAccountIdHash("seed:example");
    expect(first).toMatch(/^[0-9a-f]{40}$/);
    expect(deriveAAAccountIdHash("seed:example")).toBe(first);
  });

  it("derives distinct anchor agents with 0x-prefixed account ids", () => {
    const agents = deriveAnchorAgentAccounts({
      seedPrefix: "customanchor",
      appId: "custom-anchor:demo",
      nonce: "nonce-001",
      backupOwnerAddress: "0x13ef519c362973f9a34648a9eac5b71250b2a80a",
      count: 3,
    });

    expect(agents).toHaveLength(3);
    expect(new Set(agents.map((agent) => agent.accountIdHash)).size).toBe(3);
    for (const agent of agents) {
      expect(agent.accountIdHash).toMatch(/^[0-9a-f]{40}$/);
      expect(agent.accountId).toBe(`0x${agent.accountIdHash}`);
    }
  });

  it("generates compressed p256 session key pairs", () => {
    const pair = generateAASessionKeyPair();

    expect(pair.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(pair.publicKey).toMatch(/^0[23][0-9a-f]{64}$/);
  });
});
