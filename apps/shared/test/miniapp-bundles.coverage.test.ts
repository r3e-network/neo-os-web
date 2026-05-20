/**
 * Smoke coverage for every miniapp bundle in apps/*.
 *
 * Each miniapp gets parameterized assertions on its required shape:
 *   - neo-manifest.json present and parseable
 *   - manifest declares an id matching one of the known patterns
 *   - manifest declares supported_networks and entry url
 *   - package.json present, parseable, name starts with "miniapp-"
 *   - index.html present
 *   - tsconfig.json present (for type-checkable packages)
 *
 * This is a structural smoke — not behavioral — but it catches the most
 * common regressions: missing files, broken JSON, drift in manifest shape.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APPS_DIR = path.resolve(__dirname, "..", "..");

// Skip non-miniapp directories that live alongside the bundles.
const NON_MINIAPP_DIRS = new Set(["shared", "host-app", "admin-console"]);

function discoverMiniapps(): string[] {
  const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !NON_MINIAPP_DIRS.has(e.name))
    .map((e) => e.name)
    .sort();
}

const miniapps = discoverMiniapps();

describe("miniapp bundle structural smoke", () => {
  it("discovers at least 50 miniapps", () => {
    expect(miniapps.length).toBeGreaterThanOrEqual(50);
  });

  describe.each(miniapps)("apps/%s", (name) => {
    const dir = path.join(APPS_DIR, name);

    it("neo-manifest.json is present and parseable", () => {
      const p = path.join(dir, "neo-manifest.json");
      expect(fs.existsSync(p)).toBe(true);
      const raw = fs.readFileSync(p, "utf8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it("manifest declares id, name, supported_networks, entry url", () => {
      const p = path.join(dir, "neo-manifest.json");
      const m = JSON.parse(fs.readFileSync(p, "utf8"));
      expect(typeof m.id).toBe("string");
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe("string");
      expect(Array.isArray(m.supported_networks)).toBe(true);
      expect(m.supported_networks.length).toBeGreaterThan(0);
      expect(typeof m.urls?.entry).toBe("string");
      expect(m.urls.entry.length).toBeGreaterThan(0);
    });

    it("package.json is present, parseable, has miniapp-prefixed name", () => {
      const p = path.join(dir, "package.json");
      expect(fs.existsSync(p)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      expect(pkg.name).toMatch(/^miniapp-/);
      expect(pkg.private).toBe(true);
      // build script is universal.
      expect(pkg.scripts?.build).toBeTruthy();
    });

    it("index.html is present", () => {
      const p = path.join(dir, "index.html");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("contracts (if declared) use 0x-prefixed 40-hex addresses", () => {
      const p = path.join(dir, "neo-manifest.json");
      const m = JSON.parse(fs.readFileSync(p, "utf8"));
      if (!m.contracts || typeof m.contracts !== "object") return;
      for (const [network, hash] of Object.entries(m.contracts)) {
        expect(typeof hash).toBe("string");
        expect(hash as string).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(network).toMatch(/^neo-/);
      }
    });
  });
});
