import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { manifest, messages } from "../../oracle-vrf-console/src/appConfig";

type LocalizedMessage = { en: string; zh: string };

function appPath(file: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, "oracle-vrf-console", file);
}

describe("Oracle VRF Workbench config", () => {
  it("declares a warm, storage-backed Oracle tool without a randomness dispatch permission", () => {
    expect(manifest.name).toBe("Oracle VRF Workbench");
    expect(manifest.category).toBe("oracle");
    expect(manifest.theme?.accentColor).toBe("#0f9f8f");
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.permissions).toEqual({ storage: true });
    expect(manifest.permissions?.randomness).not.toBe(true);
  });

  it("exposes service boundary, request state, and verification scope in both languages", () => {
    const appMessages = messages as Record<string, LocalizedMessage>;
    for (const [key, value] of Object.entries(appMessages)) {
      expect(value.en, `${key}.en`).toBeTruthy();
      expect(value.zh, `${key}.zh`).toBeTruthy();
    }
    for (const key of [
      "serviceBoundaryCopy",
      "draftNotSubmitted",
      "verificationSignedScope",
      "attestationLimited",
      "storageUnavailableCopy",
      "statusDraftReadyLocalOnly",
      "statusDraftClearUnconfirmed",
      "statusResponseUnbound",
      "feature3Desc",
    ]) {
      expect(appMessages[key]?.en, key).toBeTruthy();
      expect(appMessages[key]?.zh, key).toBeTruthy();
    }
    expect(appMessages.serviceBoundaryCopy.en).toContain("never POSTs");
    expect(appMessages.draftNotSubmitted.en).toContain("not submitted");
    expect(appMessages.attestationLimited.en).toContain("does not independently validate");
  });

  it("defines every statically referenced workbench translation key", () => {
    const appMessages = messages as Record<string, LocalizedMessage>;
    const source = ["src/PlayArea.tsx", "src/main.tsx"]
      .map((file) => readFileSync(appPath(file), "utf8"))
      .join("\n");
    const keys = Array.from(source.matchAll(/(?:ctx\.)?t\("([A-Za-z0-9_-]+)"/g), (match) => match[1]);
    for (const key of new Set(keys)) {
      expect(appMessages[key], key).toBeTruthy();
    }
  });

  it("removes the generic manifest form and pins both network service/RPC endpoints", () => {
    const external = JSON.parse(readFileSync(appPath("neo-manifest.json"), "utf8")) as Record<string, unknown>;
    const packageJson = JSON.parse(readFileSync(appPath("package.json"), "utf8")) as Record<string, unknown>;
    const stateSource = external.stateSource as { chain: string; endpoints: string[] };
    const features = external.features as { stateless: boolean };
    const urls = external.urls as { banner: string };
    const platform = external.platform as { transactions: boolean };

    expect(external.name).toBe("Oracle VRF Workbench");
    expect(external.version).toBe("1.1.0");
    expect(packageJson.version).toBe(external.version);
    expect(external).not.toHaveProperty("operation_panel");
    expect(external.contracts).toEqual({});
    expect(external.supported_networks).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    expect(external.default_network).toBe("neo-n3-mainnet");
    expect(external.permissions).toEqual(["read:blockchain"]);
    expect(platform.transactions).toBe(false);
    expect(features.stateless).toBe(false);
    expect(urls.banner).toBe("/miniapps/oracle-vrf-console/oracle-workspace-stage.webp");
    expect(stateSource.chain).toBe("neo-n3-mainnet");
    expect(stateSource.endpoints).toEqual(expect.arrayContaining([
      "https://neomini.app/api/morpheus/vrf/status",
      "https://oracle.meshmini.app/mainnet",
      "https://oracle.meshmini.app/testnet",
      "https://api.n3index.dev/mainnet",
      "https://api.n3index.dev/testnet",
    ]));
    expect(String(external.description)).toContain("never submits");
  });

  it("documents the exact request, read-only probes, unsigned correlation, and recovery model", () => {
    const readme = readFileSync(appPath("README.md"), "utf8");
    expect(readme).toContain('"target_chain": "neo_n3"');
    expect(readme).toContain("never proxies `/vrf/random`");
    expect(readme).toContain("request_id` and `timestamp` are correlation metadata");
    expect(readme).toContain("does not independently validate the complete AWS Nitro");
    expect(readme).toContain("distinct `oracle_verifier` role");
    expect(readme).toContain("currently different on mainnet");
    expect(readme).toContain("app.storage.local");
  });
});
