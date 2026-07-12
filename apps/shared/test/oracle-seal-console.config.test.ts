import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { manifest, messages } from "../../oracle-seal-console/src/appConfig";

type LocalizedMessage = { en: string; zh: string };
const appMessages = messages as Record<string, LocalizedMessage>;
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../oracle-seal-console");

describe("Oracle Seal Console product contract", () => {
  it("declares a real local-encryption and ciphertext-storage boundary", () => {
    expect(manifest.description).toMatch(/Encrypt.+locally/i);
    expect(manifest.description).toMatch(/store only its ciphertext/i);
    expect(manifest.permissions).toMatchObject({
      payments: false,
      oracle: true,
      compute: false,
      confidential: true,
      storage: true,
    });
    expect(appMessages.receiptBoundaryCopy.en).toMatch(/does not submit a Neo transaction/i);
    expect(appMessages.receiptBoundaryCopy.en).toMatch(/TEE attestation/i);
    expect(appMessages.receiptBoundaryCopy.en).toMatch(/not proof of account ownership/i);
    expect(appMessages.plaintextBoundaryCopy.en).toMatch(/component memory/i);
    expect(appMessages.plaintextBoundaryCopy.en).toMatch(/never written to app storage/i);
  });

  it("keeps the platform manifest honest and removes the generic operation form", () => {
    const manifestJson = JSON.parse(readFileSync(
      path.join(appDir, "neo-manifest.json"),
      "utf8",
    ));
    const packageJson = JSON.parse(readFileSync(
      path.join(appDir, "package.json"),
      "utf8",
    ));

    expect(manifestJson.version).toBe("2.0.0");
    expect(packageJson.version).toBe(manifestJson.version);
    expect(manifestJson.features.stateless).toBe(false);
    expect(manifestJson.operation_panel.operations).toEqual([]);
    expect(manifestJson.platform.transactions).toBe(false);
    expect(manifestJson.permissions).toEqual(expect.arrayContaining([
      "read:blockchain",
      "oracle",
      "confidential",
    ]));
    expect(manifestJson.permissions).not.toContain("compute");
    expect(manifestJson.technologies.tee.enabled).toBe(false);
    expect(manifestJson.description).not.toMatch(/preview|checksum only/i);
  });

  it("defines bilingual recovery and failure copy without success-by-default wording", () => {
    for (const key of [
      "statusRecoveryReady",
      "recoveryCopy",
      "retryAction",
      "sealErrorKey",
      "sealErrorEncrypt",
      "sealErrorStore",
      "sealErrorStorage",
      "statusCompletionReady",
      "statusRecoveryInvalid",
      "receiptEmptyCopy",
    ]) {
      expect(appMessages[key]?.en, `${key}.en`).toBeTruthy();
      expect(appMessages[key]?.zh, `${key}.zh`).toBeTruthy();
    }
    expect(appMessages.receiptEmptyCopy.en).toMatch(/only after.+valid non-zero reference/i);
    expect(appMessages.sealErrorStore.en).toMatch(/exact ciphertext remains/i);
  });

  it("uses wallet-free contract evidence and one cross-action operation lane", () => {
    const main = readFileSync(path.join(appDir, "src/main.tsx"), "utf8");
    const chain = readFileSync(path.join(appDir, "src/oracle-seal-chain.ts"), "utf8");
    const coordinator = readFileSync(path.join(appDir, "src/operation-coordinator.ts"), "utf8");

    expect(main).toContain("readOracleSealContractEvidence(network)");
    expect(main).toContain("createOracleSealOperationCoordinator");
    expect(main).toContain("assertOracleSealStorageAvailable");
    expect(main).not.toContain("app.chain.detectNetwork");
    expect(main).not.toContain("app.chain.read<");
    expect(chain).toContain('method: "getcontractstate"');
    expect(chain).toContain('method: "invokefunction"');
    expect(coordinator).toContain("OracleSealOperationConflictError");
  });
});
