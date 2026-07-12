import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { AAService, ChainService } from "../services";
import { createMiniAppFramework } from "../react";
import { getExternalIntegrationConfig } from "../constants/rpc";
import { useAARelayConsole } from "../../aa-relay-console/src/composables/useAARelayConsole";
import { getRelayLaunchDefaults } from "../../aa-relay-console/src/launch";
import {
  inspectRelayReceipt,
  parseRelayDraft,
  parseRelayReceipt,
  prepareRelayReviewPackage,
  previewRelayDraft,
  type RelayValidationPreview,
} from "../../aa-relay-console/src/relay-job";

const NOW = 1_800_000_000_000;
const ACCOUNT = `0x${"11".repeat(20)}`;
const TARGET = `0x${"22".repeat(20)}`;
const SPONSOR = `0x${"33".repeat(20)}`;
const TXID = `0x${"ab".repeat(32)}`;
const MAINNET = getExternalIntegrationConfig("mainnet");

function t(key: string) {
  return key;
}

function makeApp(aa: AAService, network = "neo-n3-mainnet") {
  const chain = { address: createObservable<string | null>(null) } as unknown as ChainService;
  return createMiniAppFramework(
    { services: { chain, aa }, t, launchContext: { network } } as never,
    { appId: "miniapp-aa-relay-console" },
  );
}

function payload(options: { account?: string; core?: string; deadline?: number; operation?: string } = {}) {
  return JSON.stringify({
    metaInvocation: {
      scriptHash: options.core ?? MAINNET.contracts.aaCore,
      operation: options.operation ?? "executeUserOp",
      args: [
        { type: "Hash160", value: options.account ?? "$AA_ACCOUNT" },
        {
          type: "Struct",
          value: [
            { type: "Hash160", value: TARGET },
            { type: "String", value: "transfer" },
            { type: "Array", value: [{ type: "String", value: "memo" }] },
            { type: "Integer", value: "0" },
            { type: "Integer", value: String(options.deadline ?? NOW + 60_000) },
            { type: "ByteArray", value: "aabb" },
          ],
        },
      ],
    },
  });
}

const READY_PREVIEW: RelayValidationPreview = {
  state: "ready",
  deadlineValid: true,
  nonceValid: true,
  verifierConfigured: true,
  verifier: `0x${"44".repeat(20)}`,
  hook: "",
  reason: "core-preview-ready",
  checkedAt: NOW,
};

function stackHash(displayHash: string) {
  const bytes = Buffer.from(displayHash.slice(2), "hex").reverse();
  return { type: "ByteString", value: bytes.toString("base64") };
}

function rpcFetcher() {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body || "{}")) as { method?: string };
    if (request.method === "invokefunction") {
      return new Response(JSON.stringify({
        result: {
          state: "HALT",
          stack: [{
            type: "Array",
            value: [
              { type: "Boolean", value: "true" },
              { type: "Boolean", value: "true" },
              { type: "Boolean", value: "true" },
              stackHash(`0x${"44".repeat(20)}`),
              stackHash(`0x${"55".repeat(20)}`),
            ],
          }],
        },
      }), { status: 200 });
    }
    if (request.method === "getapplicationlog") {
      return new Response(JSON.stringify({
        result: {
          executions: [{
            vmstate: "HALT",
            notifications: [{
              contract: MAINNET.contracts.aaCore,
              eventname: "UserOpExecuted",
              state: {
                type: "Array",
                value: [
                  stackHash(ACCOUNT),
                  stackHash(TARGET),
                  { type: "ByteString", value: Buffer.from("transfer").toString("base64") },
                  { type: "Integer", value: "0" },
                ],
              },
            }],
          }],
        },
      }), { status: 200 });
    }
    if (request.method === "getrawtransaction") {
      return new Response(JSON.stringify({ result: { confirmations: 3, blockindex: 123 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { code: -32601, message: "unsupported" } }), { status: 200 });
  });
}

describe("AA Relay Console production logic", () => {
  it("normalizes the canonical V3 review request and substitutes only $AA_ACCOUNT", () => {
    const draft = parseRelayDraft({
      network: "mainnet",
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      dappId: "miniapp-aa-relay-console",
      payloadJson: payload(),
      now: NOW,
    });

    expect(draft.accountId).toBe(ACCOUNT);
    expect(draft.metaInvocation.operation).toBe("executeUserOp");
    expect(draft.metaInvocation.args[0]).toEqual({ type: "Hash160", value: ACCOUNT });
    expect(draft.targetContract).toBe(TARGET);
    expect(draft.targetMethod).toBe("transfer");
    expect(draft.signaturePresent).toBe(true);
  });

  it("rejects read calls, wrong AA cores, account mismatches, and expired deadlines", () => {
    const base = {
      network: "mainnet" as const,
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      now: NOW,
    };
    expect(() => parseRelayDraft({ ...base, payloadJson: payload({ operation: "getNonce" }) }))
      .toThrow(/canonical V3/i);
    expect(() => parseRelayDraft({ ...base, payloadJson: payload({ core: `0x${"99".repeat(20)}` }) }))
      .toThrow(/canonical AA Core/i);
    expect(() => parseRelayDraft({ ...base, payloadJson: payload({ account: `0x${"77".repeat(20)}` }) }))
      .toThrow(/do not match/i);
    expect(() => parseRelayDraft({ ...base, payloadJson: payload({ deadline: NOW - 1 }) }))
      .toThrow(/deadline is expired/i);
  });

  it("uses the safe AA Core preview and keeps signature validity outside the preview claim", async () => {
    const draft = parseRelayDraft({
      network: "mainnet",
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      payloadJson: payload(),
      now: NOW,
    });
    const fetcher = rpcFetcher();
    const preview = await previewRelayDraft(draft, fetcher, NOW);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));

    expect(body.method).toBe("invokefunction");
    expect(body.params.slice(0, 2)).toEqual([MAINNET.contracts.aaCore, "previewUserOpValidation"]);
    expect(preview).toMatchObject({
      state: "ready",
      deadlineValid: true,
      nonceValid: true,
      verifierConfigured: true,
      reason: "core-preview-ready",
    });
  });

  it("creates a deterministic review digest but leaves submission disabled", async () => {
    const first = await prepareRelayReviewPackage({
      network: "mainnet",
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      dappId: "miniapp-aa-relay-console",
      payloadJson: payload(),
      preview: READY_PREVIEW,
      now: NOW,
    });
    const second = await prepareRelayReviewPackage({
      network: "mainnet",
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      dappId: "miniapp-aa-relay-console",
      payloadJson: payload(),
      preview: { ...READY_PREVIEW, checkedAt: NOW + 1 },
      now: NOW + 1,
    });

    expect(first.packageDigest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(second.packageDigest).toBe(first.packageDigest);
    expect(first.submission).toMatchObject({ enabled: false, mode: "external-authorized-relay" });
    expect(first.authorization.required).toBe(true);
  });

  it("requires receipt network/digest binding and never accepts a short fake txid", async () => {
    const review = await prepareRelayReviewPackage({
      network: "mainnet",
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      payloadJson: payload(),
      preview: READY_PREVIEW,
      now: NOW,
    });
    expect(() => parseRelayReceipt(JSON.stringify({
      network: "testnet",
      packageDigest: review.packageDigest,
      txid: TXID,
    }), { network: "mainnet", packageDigest: review.packageDigest, now: NOW })).toThrow(/network/i);
    expect(() => parseRelayReceipt(JSON.stringify({
      network: "banana",
      packageDigest: review.packageDigest,
      txid: TXID,
    }), { network: "mainnet", packageDigest: review.packageDigest, now: NOW })).toThrow(/network/i);
    expect(() => parseRelayReceipt(JSON.stringify({
      network: "mainnet",
      packageDigest: review.packageDigest,
      txid: "0xrelay",
      status: "success",
    }), { network: "mainnet", packageDigest: review.packageDigest, now: NOW })).toThrow(/accepted status/i);

    const accepted = parseRelayReceipt(JSON.stringify({
      network: "mainnet",
      packageDigest: review.packageDigest,
      status: "accepted",
      requestId: "operator-request-42",
    }), { network: "mainnet", packageDigest: review.packageDigest, now: NOW });
    expect(accepted).toMatchObject({ status: "accepted", txid: "", requestId: "operator-request-42" });
  });

  it("reports confirmation only when the AA Core UserOpExecuted event matches the package", async () => {
    const review = await prepareRelayReviewPackage({
      network: "mainnet",
      aaCore: MAINNET.contracts.aaCore,
      paymaster: MAINNET.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      payloadJson: payload(),
      preview: READY_PREVIEW,
      now: NOW,
    });
    const receipt = parseRelayReceipt(JSON.stringify({
      network: "mainnet",
      packageDigest: review.packageDigest,
      txid: TXID,
    }), { network: "mainnet", packageDigest: review.packageDigest, now: NOW });
    const outcome = await inspectRelayReceipt(review, receipt, rpcFetcher(), NOW);

    expect(outcome).toEqual({
      status: "confirmed",
      txid: TXID,
      vmState: "HALT",
      confirmations: 3,
      blockIndex: 123,
      reason: "userop-confirmed",
      checkedAt: NOW,
    });
  });

  it("never calls relay submit or sponsorship request from the MiniApp workflow", async () => {
    const aa = {
      checkSponsorship: vi.fn().mockResolvedValue({
        eligible: true,
        remaining: 0.08,
        dailyLimit: "0.1",
        usedToday: "0.02",
      }),
      requestSponsorship: vi.fn(),
      submitRelay: vi.fn(),
    } as unknown as AAService;
    const relay = useAARelayConsole({ app: makeApp(aa), t, fetcher: rpcFetcher(), now: () => NOW });
    relay.aaAddress.set(ACCOUNT);
    relay.dappId.set("miniapp-aa-relay-console");
    relay.payloadJson.set(payload());

    const review = await relay.prepareReview();
    await relay.checkSponsor();

    expect(review.submission.enabled).toBe(false);
    expect(aa.checkSponsorship).toHaveBeenCalledWith({
      aaAddress: ACCOUNT,
      dappId: "miniapp-aa-relay-console",
    });
    expect(aa.requestSponsorship).not.toHaveBeenCalled();
    expect(aa.submitRelay).not.toHaveBeenCalled();
    expect(relay.sponsorState.get()).toBe("eligible");
  });

  it("keeps launch aliases but defaults to the current network AA Core review template", () => {
    const defaults = getRelayLaunchDefaults({
      network: "testnet",
      params: { aa: ACCOUNT, paymaster: "miniapp-aa-relay-console" },
    });

    expect(defaults.aaAddress).toBe(ACCOUNT);
    expect(defaults.dappId).toBe("miniapp-aa-relay-console");
    expect(defaults.payloadJson).toContain(getExternalIntegrationConfig("testnet").contracts.aaCore);
    expect(defaults.payloadJson).toContain("executeUserOp");
    expect(defaults.payloadJson).toContain("$AA_ACCOUNT");
  });

  it("binds runtime state to the explicit host launch network", () => {
    const aa = { checkSponsorship: vi.fn() } as unknown as AAService;
    const relay = useAARelayConsole({ app: makeApp(aa, "neo-n3-testnet"), t, fetcher: rpcFetcher() });

    expect(relay.networkDisplay.get()).toBe("testnet");
    expect(relay.aaCoreDisplay.get()).toBe(getExternalIntegrationConfig("testnet").contracts.aaCore);
    expect(relay.payloadJson.get()).toContain(getExternalIntegrationConfig("testnet").contracts.aaCore);
  });

  it("rejects sponsored jobs on networks without a published canonical paymaster", () => {
    const testnet = getExternalIntegrationConfig("testnet");
    const sponsored = JSON.parse(payload()) as { metaInvocation: { operation: string; args: unknown[] } };
    sponsored.metaInvocation.scriptHash = testnet.contracts.aaCore;
    sponsored.metaInvocation.operation = "executeSponsoredUserOp";
    sponsored.metaInvocation.args.push(
      { type: "Hash160", value: `0x${"55".repeat(20)}` },
      { type: "Hash160", value: SPONSOR },
      { type: "Integer", value: "1000000" },
    );
    expect(() => parseRelayDraft({
      network: "testnet",
      aaCore: testnet.contracts.aaCore,
      paymaster: testnet.contracts.aaPaymaster,
      aaAddress: ACCOUNT,
      payloadJson: JSON.stringify(sponsored),
      now: NOW,
    })).toThrow(/No canonical on-chain AA paymaster/i);
  });
});
