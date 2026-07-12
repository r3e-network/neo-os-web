import { afterEach, describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "../constants";
import {
  assertFlashloanRecoveryStorage,
  expectedFlashloanContract,
  isConfiguredFlashloanAccount,
  normalizeFlashloanNetwork,
  normalizeFlashloanTxid,
  readFlashloanPaymentOutcome,
  readFlashloanTransactionOutcome,
  requireCanonicalFlashloanContext,
  requireWritableFlashloanContext,
} from "../../flashloan/src/composables/flashloanSafety";

const MAIN = "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4";
const TEST = "0xde8e595d8d3c293731db499367ee2a768e1e458b";
const PROVIDER = "0x2222222222222222222222222222222222222222";
const TXID = `0x${"a".repeat(64)}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

function rpcResponse(vmstate: string, notifications: unknown[] = []) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { executions: [{ vmstate, notifications }] },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function fakeApp(input: {
  contract?: string;
  detected?: string;
  storageReadback?: boolean;
}) {
  const values = new Map<string, unknown>();
  return {
    chain: {
      contractAddress: { get: () => input.contract ?? TEST },
      detectNetwork: vi.fn(async () => input.detected ?? "testnet"),
    },
    storage: {
      local: {
        set: (key: string, value: unknown) => {
          if (input.storageReadback !== false) values.set(key, value);
        },
        get: <T,>(key: string, fallback: T) => (values.has(key) ? values.get(key) as T : fallback),
        delete: (key: string) => values.delete(key),
      },
    },
  } as never;
}

describe("flashloan production boundaries", () => {
  it("pins canonical contracts, network aliases, non-zero accounts and exact txids", () => {
    expect(expectedFlashloanContract("mainnet")).toBe(MAIN);
    expect(expectedFlashloanContract("testnet")).toBe(TEST);
    expect(normalizeFlashloanNetwork("neo-n3-mainnet")).toBe("mainnet");
    expect(normalizeFlashloanNetwork("neo-n3-testnet")).toBe("testnet");
    expect(isConfiguredFlashloanAccount(`0x${"0".repeat(40)}`)).toBe(false);
    expect(isConfiguredFlashloanAccount(PROVIDER)).toBe(true);
    expect(normalizeFlashloanTxid(TXID.toUpperCase())).toBe(TXID);
    expect(normalizeFlashloanTxid("0xshort")).toBe("");
  });

  it("rejects a configured contract or detected wallet network outside the launch boundary", async () => {
    expect(() => requireCanonicalFlashloanContext(
      fakeApp({ contract: MAIN }),
      "testnet",
      "mismatch",
    )).toThrow("mismatch");

    await expect(requireWritableFlashloanContext(
      fakeApp({ contract: TEST, detected: "mainnet" }),
      "testnet",
      () => "mismatch",
    )).rejects.toThrow("mismatch");
  });

  it("requires recovery storage readback before a wallet transaction can open", () => {
    expect(() => assertFlashloanRecoveryStorage(
      fakeApp({ storageReadback: true }),
      () => "storage unavailable",
    )).not.toThrow();
    expect(() => assertFlashloanRecoveryStorage(
      fakeApp({ storageReadback: false }),
      () => "storage unavailable",
    )).toThrow("storage unavailable");
  });

  it("classifies application FAULT and only accepts an exact contract event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse("FAULT", [])));
    await expect(readFlashloanTransactionOutcome(
      "testnet",
      TXID,
      "LoanExecuted",
      TEST,
    )).resolves.toEqual({ state: "fault", event: null });

    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse("HALT", [{
      contract: TEST,
      eventname: "LoanExecuted",
      state: {
        type: "Array",
        value: [
          { type: "Integer", value: "7" },
          { type: "Hash160", value: PROVIDER },
          { type: "Integer", value: "100000000" },
          { type: "Integer", value: "90000" },
          { type: "Boolean", value: true },
        ],
      },
    }])));
    const outcome = await readFlashloanTransactionOutcome(
      "testnet",
      TXID,
      "LoanExecuted",
      TEST,
    );
    expect(outcome.state).toBe("halt");
    expect((outcome.event as { state: Array<{ value: unknown }> }).state[0]?.value).toBe(7);
  });

  it("unlocks finalize-only recovery only for the exact confirmed GAS transfer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse("HALT", [{
      contract: GAS_HASH,
      eventname: "Transfer",
      state: {
        type: "Array",
        value: [
          { type: "Hash160", value: PROVIDER },
          { type: "Hash160", value: TEST },
          { type: "Integer", value: "100000000" },
        ],
      },
    }])));
    const confirmed = await readFlashloanPaymentOutcome({
      network: "testnet",
      paymentTxid: TXID,
      providerHash: PROVIDER,
      contractHash: TEST,
      amountFixed8: "100000000",
    });
    expect(confirmed.state).toBe("halt");
    expect(confirmed.event).not.toBeNull();

    const wrongAmount = await readFlashloanPaymentOutcome({
      network: "testnet",
      paymentTxid: TXID,
      providerHash: PROVIDER,
      contractHash: TEST,
      amountFixed8: "200000000",
    });
    expect(wrongAmount).toEqual({ state: "halt", event: null });
  });
});
