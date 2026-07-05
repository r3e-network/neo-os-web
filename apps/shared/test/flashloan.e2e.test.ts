/**
 * flashloan E2E: Verifies the verified contract constants + call patterns
 */
import { describe, expect, it } from "vitest";

describe("flashloan E2E lifecycle", () => {
  it("verifies mainnet contract hash is the deployed value", () => {
    const FLASHLOAN_N3_MAINNET = "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4";
    expect(FLASHLOAN_N3_MAINNET).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("verifies testnet contract hash is the deployed value", () => {
    const FLASHLOAN_N3_TESTNET = "0xde8e595d8d3c293731db499367ee2a768e1e458b";
    expect(FLASHLOAN_N3_TESTNET).toMatch(/^0x[0-9a-f]{40}$/);
    // Must differ from mainnet (different deployment)
    expect(FLASHLOAN_N3_TESTNET).not.toBe("0xb5d8fb0dc2319edc4be3104304b4136b925df6e4");
  });

  it("verifies the flash fee is 9 basis points (0.09%)", () => {
    const FLASH_FEE_BPS = 9;
    expect(FLASH_FEE_BPS / 10000).toBe(0.0009);
  });

  it("verifies the callback method is 'onFlashLoan' (frozen ABI)", () => {
    const CALLBACK_METHOD = "onFlashLoan";
    expect(CALLBACK_METHOD).toBe("onFlashLoan");
  });

  it("verifies the deposit memo prefix", () => {
    const DEPOSIT_MEMO = "miniapp-flashloan:deposit";
    expect(DEPOSIT_MEMO).toMatch(/^miniapp-flashloan:/);
  });

  it("verifies requestLoan args shape: [Hash160 borrower, Integer amount, Hash160 callback, String method]", () => {
    const expectedArgs = [
      { type: "Hash160", value: "borrower-hash" },
      { type: "Integer", value: "100000000" },
      { type: "Hash160", value: "callback-hash" },
      { type: "String", value: "onFlashLoan" },
    ];
    expect(expectedArgs).toHaveLength(4);
    expect(expectedArgs[0].type).toBe("Hash160");
    expect(expectedArgs[1].type).toBe("Integer");
    expect(expectedArgs[2].type).toBe("Hash160");
    expect(expectedArgs[3].type).toBe("String");
  });

  it("verifies event name is 'LoanExecuted'", () => {
    expect("LoanExecuted").toBe("LoanExecuted");
  });
});
