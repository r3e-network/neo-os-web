import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  attestSelfLoanContract,
  SELF_LOAN_BINDINGS,
} from "../../self-loan/src/self-loan-rpc";

const contractManifest = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), "..", "..", "contracts", "build", "MiniAppSelfLoan.manifest.json"),
    "utf8",
  ),
);

function fetcherFor(overrides: Record<string, unknown> = {}) {
  const state = {
    hash: SELF_LOAN_BINDINGS.testnet.contract,
    updatecounter: SELF_LOAN_BINDINGS.testnet.updateCounter,
    nef: { checksum: SELF_LOAN_BINDINGS.testnet.checksum },
    manifest: contractManifest,
    ...overrides,
  };
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: state }),
  }));
}

describe("SelfLoan deployed-generation attestation", () => {
  it("accepts the exact published hash, checksum, update generation, methods, and events", async () => {
    await expect(attestSelfLoanContract(
      "neo-n3-testnet",
      SELF_LOAN_BINDINGS.testnet.contract,
      fetcherFor(),
    )).resolves.toMatchObject({
      compatible: true,
      repayRecoveryCompatible: true,
      network: "testnet",
      checksum: 927_006_627,
      updateCounter: 0,
      reason: "ok",
    });
  });

  it("rejects a same-address bytecode generation drift", async () => {
    await expect(attestSelfLoanContract(
      "testnet",
      SELF_LOAN_BINDINGS.testnet.contract,
      fetcherFor({ nef: { checksum: 1 } }),
    )).resolves.toMatchObject({ compatible: false, reason: "checksum" });
  });

  it("rejects an in-place update even when the checksum fixture is otherwise unchanged", async () => {
    await expect(attestSelfLoanContract(
      "testnet",
      SELF_LOAN_BINDINGS.testnet.contract,
      fetcherFor({ updatecounter: 1 }),
    )).resolves.toMatchObject({ compatible: false, reason: "generation" });
  });

  it("rejects a missing money-moving method", async () => {
    const drifted = structuredClone(contractManifest);
    drifted.abi.methods = drifted.abi.methods.filter((method: { name?: string }) => method.name !== "withdrawRepayCredit");
    await expect(attestSelfLoanContract(
      "mainnet",
      SELF_LOAN_BINDINGS.mainnet.contract,
      fetcherFor({ manifest: drifted }),
    )).resolves.toMatchObject({ compatible: false, reason: "abi" });
  });

  it("accepts the known live v1 core ABI but marks legacy repay-credit reclaim unavailable", async () => {
    const liveV1 = structuredClone(contractManifest);
    liveV1.abi.events = liveV1.abi.events.filter(
      (event: { name?: string }) => event.name !== "RepayCreditWithdrawn",
    );
    await expect(attestSelfLoanContract(
      "testnet",
      SELF_LOAN_BINDINGS.testnet.contract,
      fetcherFor({ manifest: liveV1 }),
    )).resolves.toMatchObject({
      compatible: true,
      repayRecoveryCompatible: false,
      reason: "ok",
    });
  });

  it("rejects an ambiguous wallet network before making an RPC request", async () => {
    const fetcher = fetcherFor();
    await expect(attestSelfLoanContract(
      "neo-n3",
      SELF_LOAN_BINDINGS.testnet.contract,
      fetcher,
    )).resolves.toMatchObject({ compatible: false, reason: "network" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
