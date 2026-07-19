// @vitest-environment node
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  appendSealedIntent,
  clearPendingSealedIntent,
  readPendingSealedIntent,
  readSealedIntents,
  savePendingSealedIntent,
  type PendingSealedIntent,
  type SealedIntentStore,
} from "./src/history";

const COMMITMENT = `0x${"ab".repeat(32)}`;
const NULLIFIER = `0x${"cd".repeat(32)}`;
const CONTRACT = "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";
const CIPHERTEXT = Buffer.from(JSON.stringify({
  v: 2,
  alg: "X25519-HKDF-SHA256-AES-256-GCM",
  epk: Buffer.alloc(32, 1).toString("base64"),
  iv: Buffer.alloc(12, 2).toString("base64"),
  ct: Buffer.from("encrypted-packet").toString("base64"),
  tag: Buffer.alloc(16, 3).toString("base64"),
})).toString("base64");

function memoryStore(): SealedIntentStore {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null): T | null {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key, value) { values.set(key, value); },
    delete(key) { values.delete(key); },
  };
}

function pending(overrides: Partial<PendingSealedIntent> = {}): PendingSealedIntent {
  return {
    version: 1,
    name: `private-transfer:${COMMITMENT}`,
    ciphertext: CIPHERTEXT,
    publicEnvelope: {
      kind: "miniapp.private_transfer.intent.v1",
      app_id: "miniapp-private-transfer",
      target_chain: "neo_n3",
      note_commitment: COMMITMENT,
      nullifier_hash: NULLIFIER,
      network: "testnet",
      asset: "GAS",
      privacy_model: "morpheus_confidential_compute",
    },
    commitment: COMMITMENT,
    nullifier: NULLIFIER,
    network: "testnet",
    asset: "GAS",
    contract: CONTRACT,
    createdAt: 1_750_000_000_000,
    attempts: 1,
    ...overrides,
  };
}

describe("private-transfer production safety", () => {
  it("publishes a testnet-only, no-payment, native-workspace manifest", () => {
    const manifest = JSON.parse(fs.readFileSync(new URL("./neo-manifest.json", import.meta.url), "utf8"));
    expect(manifest.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(manifest.contracts).toEqual({});
    expect(manifest.permissions).not.toContain("invoke:primary");
    expect(manifest.permissions).toContain("read:blockchain");
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.tags).not.toContain("payments");
    expect(manifest.technologies.tee.enabled).toBe(false);
    expect(manifest.technologies.tee.description).toContain("not an enabled or verified capability");

    const main = fs.readFileSync(new URL("./src/main.tsx", import.meta.url), "utf8");
    expect(main).not.toContain("chain.invoke(");
    expect(main).not.toContain("ensureWallet(");
    // The oracle key/algorithm are read through the framework readRaw surface
    // (the declared operation-panel ops were removed by the framework refactor).
    expect(main).toContain('readRaw("oracleEncryptionPublicKey"');
    expect(main).toContain('readRaw("oracleEncryptionAlgorithm"');
    expect(main).toContain("verifyKey: verifyFreshOracleKey");
    expect(main).toContain("ctx.launchContext.network ?? SUPPORTED_NETWORK");
    expect(main).toContain("savePendingSealedIntent");
    expect(main).toContain("secretRef");

    const seal = fs.readFileSync(new URL("./src/seal.ts", import.meta.url), "utf8");
    expect(seal).toContain("PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT");
    expect(seal).toContain("PRIVATE_TRANSFER_TESTNET_ORACLE_NEF_CHECKSUM");
    expect(seal).toContain("isMorpheusCiphertextEnvelope");
  });

  it("persists and clears only the exact encrypted recovery packet", () => {
    const store = memoryStore();
    const expected = pending();
    savePendingSealedIntent(store, expected);
    expect(readPendingSealedIntent(store)).toEqual(expected);
    clearPendingSealedIntent(store);
    expect(readPendingSealedIntent(store)).toBeNull();
  });

  it("sanitizes local receipt history to public, bounded testnet metadata", () => {
    const store = memoryStore();
    appendSealedIntent(store, {
      secretRef: " secret-ref-1 ",
      commitment: COMMITMENT,
      nullifier: NULLIFIER,
      network: "testnet",
      asset: "GAS",
      ts: 1_750_000_000_000,
    });
    const values = readSealedIntents(store);
    expect(values).toEqual([{
      secretRef: "secret-ref-1",
      commitment: COMMITMENT,
      nullifier: NULLIFIER,
      network: "testnet",
      asset: "GAS",
      ts: 1_750_000_000_000,
    }]);
    expect(JSON.stringify(values)).not.toContain("recipient");
    expect(JSON.stringify(values)).not.toContain("memo");
  });

  it("rejects malformed, cross-network, mismatched, or plaintext-bearing recovery data", () => {
    const cases: unknown[] = [
      pending({ network: "mainnet" }),
      pending({ contract: "0xnot-a-contract" }),
      pending({ contract: `0x${"11".repeat(20)}` }),
      pending({ ciphertext: Buffer.from("not-an-envelope").toString("base64") }),
      pending({ name: `private-transfer:0x${"00".repeat(32)}` }),
      { ...pending(), recipient: "Nplaintext" },
      { ...pending(), publicEnvelope: { ...pending().publicEnvelope, amount: "5" } },
    ];

    for (const value of cases) {
      const store = memoryStore();
      store.set("pending-intent:v1", value);
      expect(readPendingSealedIntent(store)).toBeNull();
    }
  });
});
