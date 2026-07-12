import { describe, expect, it } from "vitest";

import {
  GOVERNANCE_PENDING_KEY,
  clearPendingGovernanceOperation,
  governanceEventTxid,
  governancePendingMatchesScope,
  readPendingGovernanceOperation,
  savePendingGovernanceOperation,
  type PendingGovernanceOperation,
} from "./governance-operation";

class MemoryStore {
  values = new Map<string, unknown>();
  get<T>(key: string, fallback: T | null = null): T | null {
    return this.values.has(key) ? this.values.get(key) as T : fallback;
  }
  set(key: string, value: unknown) { this.values.set(key, value); }
  delete(key: string) { this.values.delete(key); }
}

const pending: PendingGovernanceOperation = {
  version: 1,
  operation: "vote",
  eventName: "VoteCast",
  txid: `0x${"ab".repeat(32)}`,
  network: "testnet",
  contract: `0x${"11".repeat(20)}`,
  wallet: "NdemoCouncilWallet",
  submittedAt: 1_800_000_000_000,
  proposalId: 13,
  support: true,
};

describe("governance pending operation", () => {
  it("persists only a fully bound operation and verifies storage readback", () => {
    const store = new MemoryStore();
    expect(savePendingGovernanceOperation(store, pending)).toBe(true);
    expect(readPendingGovernanceOperation(store)).toEqual(pending);
    expect(clearPendingGovernanceOperation(store)).toBe(true);
    expect(store.values.has(GOVERNANCE_PENDING_KEY)).toBe(false);
  });

  it("rejects malformed or event-mismatched recovery state", () => {
    const store = new MemoryStore();
    store.set(GOVERNANCE_PENDING_KEY, { ...pending, eventName: "ProposalCreated" });
    expect(readPendingGovernanceOperation(store)).toBeNull();
    expect(savePendingGovernanceOperation(store, { ...pending, txid: "0x1234" })).toBe(false);
  });

  it("binds recovery to network, contract, and wallet", () => {
    expect(governancePendingMatchesScope(pending, {
      network: "testnet",
      contract: pending.contract.toUpperCase().replace("0X", "0x"),
      wallet: pending.wallet,
    })).toBe(true);
    expect(governancePendingMatchesScope(pending, { ...pending, network: "mainnet" })).toBe(false);
    expect(governancePendingMatchesScope(pending, { ...pending, wallet: "Nother" })).toBe(false);
    expect(governancePendingMatchesScope(pending, { ...pending, wallet: pending.wallet.toLowerCase() })).toBe(false);
  });

  it("extracts only explicit transaction identifiers from indexed events", () => {
    expect(governanceEventTxid({ tx_hash: pending.txid })).toBe(pending.txid);
    expect(governanceEventTxid({ transactionHash: pending.txid })).toBe(pending.txid);
    expect(governanceEventTxid({ state: [] })).toBe("");
  });

  it("persists the exact create payload needed for authoritative recovery", () => {
    const store = new MemoryStore();
    const createPending: PendingGovernanceOperation = {
      ...pending,
      operation: "createProposal",
      eventName: "ProposalCreated",
      proposalId: undefined,
      support: undefined,
      proposalType: 1,
      title: "Tune storage price",
      description: "Review one exact Neo policy parameter.",
      policyMethod: "setStoragePrice",
      policyValue: "42",
      durationMs: 900_000,
    };
    expect(savePendingGovernanceOperation(store, createPending)).toBe(true);
    expect(readPendingGovernanceOperation(store)).toEqual(createPending);
    expect(savePendingGovernanceOperation(store, { ...createPending, durationMs: 0 })).toBe(false);
    expect(savePendingGovernanceOperation(store, { ...createPending, policyMethod: "" })).toBe(false);
  });
});
