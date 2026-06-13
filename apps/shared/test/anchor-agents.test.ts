import { describe, expect, it } from "vitest";
import { ripemd160 } from "@noble/hashes/ripemd160.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
  ANCHOR_AGENT_COUNT,
  DEFAULT_ANCHOR_CANDIDATE,
  buildAnchorRegistrationInvocations,
  buildCustomAnchorAppId,
  defaultProfitCandidates,
  parseAnchorCandidateKeys,
  type AnchorContractArg,
} from "../utils/anchor-agents";
import { addressToScriptHash } from "../utils/neo";

const OWNER = "0x13ef519c362973f9a34648a9eac5b71250b2a80a";
const CANDIDATES = Array.from({ length: 21 }, (_, index) => `02${String(index + 1).padStart(64, "0")}`);

// --- Reference re-implementation of the host accountId derivation -----------
// platform/host-app/lib/custom-anchor.ts: the registration payload is
// aa524701 + backupOwner(20) + zero verifier(20) + zero hook(20) +
// uint32-LE(escapeTimelock) + verifierParamsHex, hashed ripemd160(sha256(.)).
const TIMELOCK = 30 * 24 * 60 * 60;
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, "").toLowerCase();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  return out;
}
function stringToHex(value: string): string {
  return Array.from(value, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}
function le32(value: number): string {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function hostAccountId(ownerHash: string, agentId: number, seedPrefix: string, appId: string, nonce: string): string {
  const vp = `anchor:${seedPrefix}:app:${appId}:agent:${String(agentId).padStart(2, "0")}:nonce:${nonce}`;
  const payload = [
    "aa524701",
    ownerHash.replace(/^0x/i, "").toLowerCase(),
    "00".repeat(20),
    "00".repeat(20),
    le32(TIMELOCK),
    stringToHex(vp),
  ].join("");
  return bytesToHex(ripemd160(sha256(hexToBytes(payload))));
}

describe("buildCustomAnchorAppId", () => {
  it("builds a compact custom anchor id from slug + nonce", () => {
    expect(buildCustomAnchorAppId("My Anchor!", "Nonce 001")).toBe("custom-anchor:my-anchor:nonce-001");
  });
  it("rejects empty slug or nonce", () => {
    expect(() => buildCustomAnchorAppId("", "n1")).toThrow(/slug is required/i);
    expect(() => buildCustomAnchorAppId("team", "")).toThrow(/nonce is required/i);
  });
});

describe("parseAnchorCandidateKeys", () => {
  it("parses exactly 21 compressed candidate keys", () => {
    expect(parseAnchorCandidateKeys(CANDIDATES.join("\n"))).toEqual(CANDIDATES);
  });
  it("splits on newlines, commas, semicolons, and whitespace", () => {
    expect(parseAnchorCandidateKeys(CANDIDATES.join(" , "))).toEqual(CANDIDATES);
  });
  it("requires exactly 21 keys", () => {
    expect(() => parseAnchorCandidateKeys(CANDIDATES.slice(0, 20).join("\n"))).toThrow(/exactly 21/i);
    expect(() => parseAnchorCandidateKeys([...CANDIDATES, CANDIDATES[0]].join("\n"))).toThrow(/exactly 21/i);
  });
  it("rejects malformed (non 02/03 or wrong length) keys", () => {
    const bad = [...CANDIDATES.slice(0, 20), "04" + "0".repeat(64)];
    expect(() => parseAnchorCandidateKeys(bad.join("\n"))).toThrow(/compressed public key/i);
  });
  it("permits duplicate candidates (matches the on-chain RegisterAgents contract + deploy default)", () => {
    const dupes = defaultProfitCandidates();
    expect(parseAnchorCandidateKeys(dupes.join("\n"))).toEqual(dupes);
  });
});

describe("defaultProfitCandidates", () => {
  it("returns 21 copies of the deploy-script default candidate", () => {
    const defaults = defaultProfitCandidates();
    expect(defaults).toHaveLength(ANCHOR_AGENT_COUNT);
    expect(new Set(defaults)).toEqual(new Set([DEFAULT_ANCHOR_CANDIDATE]));
    expect(DEFAULT_ANCHOR_CANDIDATE).toMatch(/^(02|03)[0-9a-fA-F]{64}$/);
  });
});

describe("buildAnchorRegistrationInvocations", () => {
  const plan = buildAnchorRegistrationInvocations({
    appId: "custom-anchor:demo:n1",
    mode: "profit",
    ownerAddress: OWNER,
    candidateKeys: CANDIDATES,
  });

  it("derives 21 agents and three ordered invocations", () => {
    expect(plan.appId).toBe("custom-anchor:demo:n1");
    expect(plan.mode).toBe(2);
    expect(plan.agents).toHaveLength(ANCHOR_AGENT_COUNT);
    expect(plan.invocations).toHaveLength(3);
    expect(plan.invocations.map((i) => i.operation)).toEqual([
      "registerAccounts",
      "registerCustomAnchorApp",
      "registerAgents",
    ]);
    expect(plan.invocations.map((i) => i.contract)).toEqual(["aaCore", "anchor", "anchor"]);
  });

  it("derives agent accountIds byte-identically to the host detail page", () => {
    for (const agent of plan.agents) {
      const expected = hostAccountId(OWNER, agent.agentId, "demo", "custom-anchor:demo:n1", "n1");
      expect(agent.accountIdHash).toBe(expected);
      expect(agent.accountId).toBe(`0x${expected}`);
    }
    expect(new Set(plan.agents.map((a) => a.accountIdHash)).size).toBe(ANCHOR_AGENT_COUNT);
  });

  it("registerAccounts carries the 21 agent accounts, owner hash, and escape timelock", () => {
    const accounts = plan.invocations[0]?.args[0] as AnchorContractArg;
    expect(accounts.type).toBe("Array");
    expect((accounts.value as AnchorContractArg[])).toHaveLength(ANCHOR_AGENT_COUNT);
    expect((accounts.value as AnchorContractArg[])[0]).toMatchObject({
      type: "Hash160",
      value: plan.agents[0]?.accountId,
    });
    expect(plan.invocations[0]?.args[4]).toEqual({ type: "Hash160", value: OWNER });
    expect(plan.invocations[0]?.args[5]).toEqual({ type: "Integer", value: String(TIMELOCK) });
  });

  it("registerCustomAnchorApp carries appId, mode, and owner", () => {
    expect(plan.invocations[1]?.args).toEqual([
      { type: "String", value: "custom-anchor:demo:n1" },
      { type: "Integer", value: "2" },
      { type: "Hash160", value: OWNER },
    ]);
  });

  it("registerAgents binds the 21 candidates as PublicKey args", () => {
    const candidates = plan.invocations[2]?.args[2] as AnchorContractArg;
    expect(candidates.type).toBe("Array");
    expect((candidates.value as AnchorContractArg[])).toHaveLength(ANCHOR_AGENT_COUNT);
    expect((candidates.value as AnchorContractArg[])[0]).toMatchObject({
      type: "PublicKey",
      value: CANDIDATES[0],
    });
  });

  it("normalizes a base58 owner address to a Hash160 in every invocation", () => {
    const ownerAddress = "NPAsqZkx9WhNd4P72uhZxBhLinSuNkxfB8";
    const ownerHash = addressToScriptHash(ownerAddress);
    const built = buildAnchorRegistrationInvocations({
      appId: "custom-anchor:demo:n1",
      mode: "trust",
      ownerAddress,
      candidateKeys: CANDIDATES,
    });
    expect(built.mode).toBe(1);
    expect(built.invocations[0]?.args[4]).toEqual({ type: "Hash160", value: ownerHash });
    expect(built.invocations[1]?.args[2]).toEqual({ type: "Hash160", value: ownerHash });
  });

  it("rejects an invalid mode, wrong candidate count, or empty appId", () => {
    expect(() =>
      buildAnchorRegistrationInvocations({ appId: "custom-anchor:demo:n1", mode: "vote", ownerAddress: OWNER, candidateKeys: CANDIDATES }),
    ).toThrow(/mode must be Trust or Profit/i);
    expect(() =>
      buildAnchorRegistrationInvocations({ appId: "custom-anchor:demo:n1", mode: "trust", ownerAddress: OWNER, candidateKeys: CANDIDATES.slice(0, 20) }),
    ).toThrow(/exactly 21/i);
    expect(() =>
      buildAnchorRegistrationInvocations({ appId: "  ", mode: "trust", ownerAddress: OWNER, candidateKeys: CANDIDATES }),
    ).toThrow(/appId is required/i);
  });
});
