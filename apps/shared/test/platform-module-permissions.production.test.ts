import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APPS_ROOT = path.resolve(process.cwd(), "..");

const PLATFORM_ADOPTERS = {
  "asset-factory": "invoke:platform-factory",
  "miniapp-factory": "invoke:platform-factory",
  "nft-factory": "invoke:platform-factory",
  profitanchor: "invoke:platform-anchor",
  "self-loan": "invoke:platform-defi",
  "timestamp-proof": "invoke:platform-social",
  trustanchor: "invoke:platform-anchor",
} as const;

function readManifest(app: string): {
  id: string;
  mode?: string;
  moduleId?: string;
  permissions?: string[];
} {
  return JSON.parse(
    fs.readFileSync(path.join(APPS_ROOT, app, "neo-manifest.json"), "utf8"),
  ) as {
    id: string;
    mode?: string;
    moduleId?: string;
    permissions?: string[];
  };
}

describe("platform module permission declarations", () => {
  it.each(Object.entries(PLATFORM_ADOPTERS))(
    "%s declares its narrow shared-module write grant",
    (app, permission) => {
      const manifest = readManifest(app);
      const sourceManifest = fs.readFileSync(
        path.join(APPS_ROOT, app, "src/manifest.ts"),
        "utf8",
      );

      expect(manifest.permissions).toContain(permission);
      expect(sourceManifest).toContain(`"${permission}": true`);
    },
  );

  it("does not use invoke:primary as the shared PlatformGame grant", () => {
    const sharedGames = fs.readdirSync(APPS_ROOT)
      .filter((app) => fs.existsSync(path.join(APPS_ROOT, app, "neo-manifest.json")))
      .map(readManifest)
      .filter((manifest) =>
        manifest.mode === "shared" && manifest.moduleId === "platform-game");

    expect(sharedGames).toHaveLength(12);
    for (const manifest of sharedGames) {
      expect(manifest.permissions ?? []).not.toContain("invoke:primary");
    }
  });
});
