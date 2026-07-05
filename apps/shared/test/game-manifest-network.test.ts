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
    supported_networks?: string[];
    technologies?: {
      oracle?: { enabled?: boolean };
      tee?: { enabled?: boolean };
    };
  };
}

describe("new TEE game manifest network bindings", () => {
  it("only advertises networks that have deployed game contracts", () => {
    for (const slug of TEE_TESTNET_GAME_SLUGS) {
      const manifest = readManifest(slug);
      const contractNetworks = Object.keys(manifest.contracts ?? {}).sort();
      const supportedNetworks = [...(manifest.supported_networks ?? [])].sort();

      expect(
        supportedNetworks,
        `${slug} should not advertise a network without a matching contract hash`,
      ).toEqual(contractNetworks);
      expect(supportedNetworks, `${slug} should remain testnet-only until mainnet deploy`).toEqual([
        "neo-n3-testnet",
      ]);
      expect(manifest.default_network).toBe("neo-n3-testnet");
    }
  });

  it("declares Morpheus oracle and TEE dependencies for every TEE game", () => {
    for (const slug of TEE_TESTNET_GAME_SLUGS) {
      const manifest = readManifest(slug);

      expect(
        manifest.permissions,
        `${slug} should expose oracle permission for platform service wiring`,
      ).toContain("oracle");
      expect(
        manifest.technologies?.oracle?.enabled,
        `${slug} should mark the Morpheus runtime/oracle dependency as enabled`,
      ).toBe(true);
      expect(
        manifest.technologies?.tee?.enabled,
        `${slug} should mark TEE verification as enabled`,
      ).toBe(true);
    }
  });
});
