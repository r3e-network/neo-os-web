import { describe, expect, it, vi } from "vitest";

import {
  attestDevTippingContract,
  DEV_TIPPING_BINDINGS,
  readDevTippingExecutionState,
} from "./dev-tipping-rpc";

const method = (name: string, parameters: string[], returntype: string, safe: boolean) => ({
  name,
  parameters: parameters.map((type) => ({ type })),
  returntype,
  safe,
});
const contractEvent = (name: string, parameters: string[]) => ({
  name,
  parameters: parameters.map((type) => ({ type })),
});
const manifest = {
  name: "MiniAppTipJar",
  abi: {
    methods: [
      method("onNEP17Payment", ["Hash160", "Integer", "Any"], "Void", false),
      method("registerDeveloper", ["Hash160", "String", "String"], "Integer", false),
      method("tip", ["Hash160", "Integer", "Integer", "Boolean"], "Integer", false),
      method("withdrawTips", ["Integer"], "Integer", false),
      method("withdraw", ["Hash160"], "Integer", false),
      method("totalDevelopers", [], "Integer", true),
      method("totalDonated", [], "Integer", true),
      method("tipsCount", [], "Integer", true),
      method("minTip", [], "Integer", true),
      method("creditOf", ["Hash160"], "Integer", true),
      method("developerIdOf", ["Hash160"], "Integer", true),
      method("getDeveloper", ["Integer"], "Map", true),
    ],
    events: [
      contractEvent("Credited", ["Hash160", "Integer", "Integer"]),
      contractEvent("DeveloperRegistered", ["Integer", "Hash160", "String"]),
      contractEvent("Tipped", ["Integer", "Integer", "Hash160", "Integer", "Boolean"]),
      contractEvent("TipsWithdrawn", ["Integer", "Hash160", "Integer"]),
      contractEvent("CreditWithdrawn", ["Hash160", "Integer"]),
    ],
  },
};

function response(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => ({ jsonrpc: "2.0", id: 1, result })),
  };
}

describe("dev-tipping RPC production binding", () => {
  it("accepts only the pinned MiniAppTipJar generation and ABI", async () => {
    const expected = DEV_TIPPING_BINDINGS.testnet;
    const fetcher = vi.fn(async () => response({
      hash: expected.contract,
      updatecounter: expected.updateCounter,
      nef: { checksum: expected.checksum },
      manifest,
    }));

    await expect(
      attestDevTippingContract("neo-n3-testnet", expected.contract, fetcher),
    ).resolves.toMatchObject({ compatible: true, reason: "ok" });
  });

  it("rejects a same-address contract whose checksum changed", async () => {
    const expected = DEV_TIPPING_BINDINGS.mainnet;
    const fetcher = vi.fn(async () => response({
      hash: expected.contract,
      updatecounter: expected.updateCounter,
      nef: { checksum: expected.checksum + 1 },
      manifest,
    }));

    await expect(
      attestDevTippingContract("mainnet", expected.contract, fetcher),
    ).resolves.toMatchObject({ compatible: false, reason: "checksum" });
  });

  it("distinguishes an exact transaction FAULT from a still-pending log", async () => {
    const txid = `0x${"a".repeat(64)}`;
    const faultFetcher = vi.fn(async () => response({ executions: [{ vmstate: "FAULT" }] }));
    const missingFetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: vi.fn(async () => ({ error: { code: -100, message: "Unknown transaction" } })),
    }));

    await expect(readDevTippingExecutionState("testnet", txid, faultFetcher)).resolves.toBe("fault");
    await expect(readDevTippingExecutionState("testnet", txid, missingFetcher)).resolves.toBe("pending");
  });
});
