import { describe, expect, it } from "vitest";

import {
  classifyBreakupConfirmation,
  findMatchingBreakupEvent,
  isPendingBreakupAction,
  parseBreakupApplicationLog,
  parseBreakupInteger,
  type PendingBreakupAction,
} from "../../breakup-contract/src/composables/breakupSafety";

const CONTRACT = "0xf6769c080395f15c28013108b7af7631e1665336";
const WALLET = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const PARTNER = "0x58a5f9d3a6092c6df685bd2b0f252515d2a1ad35";
const TXID = `0x${"ab".repeat(32)}`;

function createPending(overrides: Partial<PendingBreakupAction> = {}): PendingBreakupAction {
  return {
    version: 2,
    kind: "create",
    eventName: "PactCreated",
    network: "testnet",
    contractHash: CONTRACT,
    walletHash: WALLET,
    txid: TXID,
    createdAt: 1_000,
    beforePactId: "0",
    party2Hash: PARTNER,
    stakeRaw: "100000000",
    durationSeconds: 30 * 86_400,
    title: "Our pact",
    terms: "",
    ...overrides,
  };
}

function depositPending(overrides: Partial<PendingBreakupAction> = {}): PendingBreakupAction {
  return {
    version: 2,
    kind: "deposit-create",
    eventName: "Credited",
    network: "testnet",
    contractHash: CONTRACT,
    walletHash: WALLET,
    txid: TXID,
    createdAt: 1_000,
    stakeRaw: "100000000",
    amountRaw: "60000000",
    beforeCreditRaw: "40000000",
    requiredCreditRaw: "100000000",
    assetHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    memo: "miniapp-breakup:stake",
    ...overrides,
  };
}

describe("breakup-contract pending evidence", () => {
  it("keeps unavailable and malformed reads distinct from authoritative zero", () => {
    expect(parseBreakupInteger(null)).toBeNull();
    expect(parseBreakupInteger(undefined)).toBeNull();
    expect(parseBreakupInteger("not-an-integer")).toBeNull();
    expect(parseBreakupInteger(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(parseBreakupInteger("0")).toBe(0n);
  });

  it("requires an exact version-2 intent bound to network, contract, wallet, and txid", () => {
    expect(isPendingBreakupAction(createPending())).toBe(true);
    expect(isPendingBreakupAction(createPending({ txid: "pending" }))).toBe(false);
    expect(isPendingBreakupAction(createPending({ network: "main" as "mainnet" }))).toBe(false);
    expect(isPendingBreakupAction(createPending({ contractHash: `0x${"0".repeat(40)}` }))).toBe(false);
    expect(isPendingBreakupAction(createPending({ durationSeconds: 29 * 86_400 }))).toBe(false);
  });

  it("persists the exact prepaid deficit instead of only the target stake", () => {
    expect(isPendingBreakupAction(depositPending())).toBe(true);
    expect(isPendingBreakupAction(depositPending({ amountRaw: "100000000" }))).toBe(false);
    expect(isPendingBreakupAction(depositPending({ beforeCreditRaw: "0" }))).toBe(false);
  });

  it("keeps unknown and incomplete HALT evidence pending indefinitely", () => {
    expect(classifyBreakupConfirmation("unknown", false, false)).toBe("pending");
    expect(classifyBreakupConfirmation("halt", false, true)).toBe("pending");
    expect(classifyBreakupConfirmation("halt", true, false)).toBe("pending");
    expect(classifyBreakupConfirmation("halt", true, true)).toBe("confirmed");
    expect(classifyBreakupConfirmation("fault", false, false)).toBe("fault");
  });

  it("parses only authoritative VM outcomes from getapplicationlog", () => {
    expect(parseBreakupApplicationLog({ error: { code: -100 } }).state).toBe("unknown");
    expect(parseBreakupApplicationLog({ result: { executions: [] } }).state).toBe("unknown");
    expect(parseBreakupApplicationLog({
      result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
    }).state).toBe("fault");
    expect(parseBreakupApplicationLog({
      result: { executions: [{ vmstate: "HALT", notifications: [] }] },
    }).state).toBe("halt");
  });

  it("binds a create confirmation to the exact target contract and intent", () => {
    const pending = createPending();
    const event = {
      contract: CONTRACT,
      eventName: "PactCreated",
      values: ["1", WALLET, PARTNER, "100000000", "2592001000"],
    };
    expect(findMatchingBreakupEvent(pending, { state: "halt", notifications: [event] })).toEqual(event);
    expect(findMatchingBreakupEvent(pending, {
      state: "halt",
      notifications: [{ ...event, contract: `0x${"cd".repeat(20)}` }],
    })).toBeNull();
    expect(findMatchingBreakupEvent(pending, {
      state: "halt",
      notifications: [{ ...event, values: ["1", WALLET, PARTNER, "200000000", "2592001000"] }],
    })).toBeNull();
  });

  it("requires the exact credited balance for a prepaid transfer event", () => {
    const pending = depositPending();
    const event = {
      contract: CONTRACT,
      eventName: "Credited",
      values: [WALLET, "60000000", "100000000"],
    };
    expect(findMatchingBreakupEvent(pending, { state: "halt", notifications: [event] })).toEqual(event);
    expect(findMatchingBreakupEvent(pending, {
      state: "halt",
      notifications: [{ ...event, values: [WALLET, "60000000", "99999999"] }],
    })).toBeNull();
  });
});
