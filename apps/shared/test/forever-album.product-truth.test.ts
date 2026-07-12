import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot(), relativePath), "utf8");
}

describe("Forever Album product truth", () => {
  it("declares the real device-local, non-transactional product boundary", () => {
    const manifest = JSON.parse(read("apps/forever-album/neo-manifest.json")) as Record<string, unknown> & {
      contracts: Record<string, unknown>;
      permissions: string[];
      platform: { transactions: boolean };
      operation_panel: { operations: unknown[] };
    };

    expect(manifest.contracts).toEqual({});
    expect(manifest.permissions).toEqual([]);
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest).not.toHaveProperty("stateSource");
    expect(String(manifest.description)).toMatch(/this browser|this device/i);
    expect(String(manifest.description)).toMatch(/no transaction/i);
  });

  it("does not reintroduce chain, payment, or remote-storage behavior", () => {
    const logic = read("apps/forever-album/src/composables/useForeverAlbum.ts");
    const runtimeManifest = read("apps/forever-album/src/manifest.ts");
    const host = read("platform/host-app/components/playarea/PlayAreaMedia.tsx");

    expect(logic).not.toMatch(/app\.chain|app\.storage\.(?:remote|hybrid)|invokeWithPayment/);
    expect(runtimeManifest).toMatch(/chainWarning:\s*false/);
    expect(runtimeManifest).toMatch(/permissions:\s*\{\}/);
    expect(runtimeManifest).not.toMatch(/payments:\s*true|contract:\s*\{/);
    expect(host).toContain("wallet address separates local albums; it does not sign a transaction");
    expect(host).not.toContain("Sign storage write");
  });

  it("gives the trusted first-party embed the storage capability the product requires", () => {
    const host = read("platform/host-app/components/playarea/PlayAreaMedia.tsx");
    expect(host).toMatch(/title="Forever Album local photo workspace"[\s\S]*sandbox="[^"]*allow-same-origin/);
  });

  it("uses product-specific album art for the catalog cover", () => {
    const manifest = JSON.parse(read("apps/forever-album/neo-manifest.json")) as {
      urls: { banner: string };
    };
    expect(manifest.urls.banner).toBe("/miniapps/forever-album/forever-album-memory-stage.webp");
  });
});
