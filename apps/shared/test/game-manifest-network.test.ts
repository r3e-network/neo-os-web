import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appsRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..");

const TEE_TESTNET_GAME_SLUGS = [
  "aim-master",
  "color-clash",
  "flappy-dash",
  "game-2048",
  "jump-rush",
  "merge-kingdom",
  "pet-potion",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

function readManifest(slug: string) {
  return JSON.parse(
    readFileSync(resolve(appsRoot, slug, "neo-manifest.json"), "utf8"),
  ) as {
    contracts?: Record<string, string>;
    default_network?: string;
    permissions?: string[];
    platform?: { transactions?: boolean };
    supported_networks?: string[];
    technologies?: {
      oracle?: { enabled?: boolean };
      tee?: { enabled?: boolean };
    };
  };
}

describe("new TEE game manifest network bindings", () => {
  it("never publishes placeholder hashes and keeps deployed game contracts testnet-only", () => {
    for (const slug of TEE_TESTNET_GAME_SLUGS) {
      const manifest = readManifest(slug);
      const contractNetworks = Object.keys(manifest.contracts ?? {}).sort();
      const supportedNetworks = [...(manifest.supported_networks ?? [])].sort();

      for (const [network, hash] of Object.entries(manifest.contracts ?? {})) {
        expect(hash, `${slug} ${network} must contain a real Hash160`).toMatch(/^0x[0-9a-f]{40}$/i);
        expect(hash, `${slug} ${network} must not use the zero-address placeholder`).not.toBe(
          "0x0000000000000000000000000000000000000000",
        );
      }
      if (contractNetworks.length > 0) {
        expect(
          supportedNetworks,
          `${slug} should not advertise a paid network without a matching deployment`,
        ).toEqual(contractNetworks);
        expect(contractNetworks, `${slug} should remain testnet-only until mainnet deploy`).toEqual([
          "neo-n3-testnet",
        ]);
      } else {
        expect(manifest.platform?.transactions, `${slug} has no contract and must be local-only`).toBe(false);
      }
      expect(supportedNetworks).toContain(manifest.default_network);
      expect(manifest.default_network).toBe("neo-n3-testnet");
    }
  });

  it("publishes Morpheus dependencies only when the paid runtime is actually exposed", () => {
    for (const slug of TEE_TESTNET_GAME_SLUGS) {
      const manifest = readManifest(slug);
      const transactionsPublished = manifest.platform?.transactions === true;
      const oraclePublished = manifest.permissions?.includes("oracle") === true;

      expect(
        oraclePublished,
        `${slug} oracle permission and transaction surface must be enabled or disabled together`,
      ).toBe(transactionsPublished);
      expect(
        manifest.technologies?.oracle?.enabled,
        `${slug} must not claim an Oracle dependency for a guest-only release`,
      ).toBe(transactionsPublished);
      expect(
        manifest.technologies?.tee?.enabled,
        `${slug} must not claim TEE verification for a guest-only release`,
      ).toBe(transactionsPublished);
    }
  });
});
