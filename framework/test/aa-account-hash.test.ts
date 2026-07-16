/**
 * deriveAppAccountHash — the TS leg of the shared CreateContractHash triple
 * agreement (platform-contract-library-v2 §4.1 rule 4 / §8).
 *
 * Every vector in contracts/__tests__/fixtures/create-contract-hash-vectors.json
 * must reproduce byte-exactly. The same JSON is consumed by
 * contracts/__tests__/CreateContractHashVectorTests.cs, which pins neo-core's
 * Helper.GetContractHash over identical inputs, and the sender component is
 * MEASURED transaction-sender semantics (PlatformRegistryHashSemanticsTests)
 * — so a green run here means C# / TestEngine / TS agree on the derivation.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveAppAccountHash } from "../utils/aa-account";
import { scriptHashToAddress } from "../utils/neo";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

type HashVector = {
  id: string;
  source: "measured" | "synthetic";
  deployerSender: string;
  nefChecksum: number;
  manifestName: string;
  expectedHash: string;
};

const fixture = JSON.parse(
  readFileSync(
    resolve(repoRoot, "contracts/__tests__/fixtures/create-contract-hash-vectors.json"),
    "utf8",
  ),
) as { vectors: HashVector[] };

describe("deriveAppAccountHash (shared CreateContractHash vectors)", () => {
  it("fixture holds the measured vector plus synthetic coverage", () => {
    expect(fixture.vectors.length).toBeGreaterThanOrEqual(4);
    expect(fixture.vectors.filter((v) => v.source === "measured")).toHaveLength(1);
    // Duplicate expectations would let one derivation defect hide behind
    // another vector — mirror of the C# hygiene pin.
    expect(new Set(fixture.vectors.map((v) => v.expectedHash)).size).toBe(
      fixture.vectors.length,
    );
  });

  for (const vector of fixture.vectors) {
    it(`reproduces vector '${vector.id}' byte-exactly`, () => {
      expect(
        deriveAppAccountHash({
          deployerSender: vector.deployerSender,
          nefChecksum: vector.nefChecksum,
          manifestName: vector.manifestName,
        }),
      ).toBe(vector.expectedHash);
    });
  }

  it("accepts the deployer sender as a Neo N3 address too", () => {
    const measured = fixture.vectors.find((v) => v.source === "measured")!;
    const address = scriptHashToAddress(measured.deployerSender);
    expect(address).toMatch(/^N/);
    expect(
      deriveAppAccountHash({
        deployerSender: address,
        nefChecksum: measured.nefChecksum,
        manifestName: measured.manifestName,
      }),
    ).toBe(measured.expectedHash);
  });

  it("rejects malformed inputs instead of deriving a plausible-looking hash", () => {
    const measured = fixture.vectors.find((v) => v.source === "measured")!;
    expect(() =>
      deriveAppAccountHash({
        deployerSender: "not-a-sender",
        nefChecksum: measured.nefChecksum,
        manifestName: measured.manifestName,
      }),
    ).toThrow(/deployer sender/i);
    expect(() =>
      deriveAppAccountHash({
        deployerSender: measured.deployerSender,
        nefChecksum: -1,
        manifestName: measured.manifestName,
      }),
    ).toThrow(/checksum/i);
    expect(() =>
      deriveAppAccountHash({
        deployerSender: measured.deployerSender,
        nefChecksum: 0x1_0000_0000,
        manifestName: measured.manifestName,
      }),
    ).toThrow(/checksum/i);
    expect(() =>
      deriveAppAccountHash({
        deployerSender: measured.deployerSender,
        nefChecksum: 1.5,
        manifestName: measured.manifestName,
      }),
    ).toThrow(/checksum/i);
    expect(() =>
      deriveAppAccountHash({
        deployerSender: measured.deployerSender,
        nefChecksum: measured.nefChecksum,
        manifestName: "",
      }),
    ).toThrow(/manifest name/i);
    expect(() =>
      deriveAppAccountHash({
        deployerSender: measured.deployerSender,
        nefChecksum: measured.nefChecksum,
        manifestName: "x".repeat(65),
      }),
    ).toThrow(/manifest name/i);
  });
});
