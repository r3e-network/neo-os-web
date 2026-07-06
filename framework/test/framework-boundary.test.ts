import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sharedRoot = resolve(repoRoot, "apps/shared");
const frameworkRoot = resolve(repoRoot, "framework");

function frameworkSources(dir = frameworkRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "test") {
        return [];
      }
      return frameworkSources(path);
    }
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("framework package boundary", () => {
  it("registers the framework as a root workspace package", () => {
    const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
      workspaces?: string[];
    };
    const lockfile = JSON.parse(readFileSync(resolve(repoRoot, "package-lock.json"), "utf8")) as {
      packages?: Record<
        string,
        { resolved?: string; link?: boolean; name?: string; workspaces?: string[] }
      >;
    };

    expect(rootPackage.workspaces).toContain("framework");
    expect(lockfile.packages?.[""].workspaces).toContain("framework");
    expect(lockfile.packages?.framework?.name).toBe("@neo/miniapp-framework");
    expect(lockfile.packages?.["node_modules/@neo/miniapp-framework"]).toMatchObject({
      resolved: "framework",
      link: true,
    });
  });

  it("keeps SDK implementation outside apps/shared", () => {
    expect(existsSync(frameworkRoot)).toBe(true);

    for (const name of ["game", "gamefi", "logic", "phaser"]) {
      expect(
        existsSync(resolve(sharedRoot, name)),
        `${name} should live under framework/`,
      ).toBe(false);
    }
  });

  it("does not expose framework modules from the shared UI package", () => {
    const pkg = JSON.parse(readFileSync(resolve(sharedRoot, "package.json"), "utf8")) as {
      exports?: Record<string, string>;
    };
    const exported = Object.keys(pkg.exports ?? {});

    expect(exported).not.toContain("./game");
    expect(exported).not.toContain("./game/*");
    expect(exported).not.toContain("./gamefi");
    expect(exported).not.toContain("./gamefi/*");
    expect(exported).not.toContain("./logic/*");
    expect(exported).not.toContain("./phaser");
    expect(exported).not.toContain("./phaser/*");
  });

  it("does not register shared-runtime aliases inside the framework package", () => {
    const tsconfig = readFileSync(resolve(frameworkRoot, "tsconfig.json"), "utf8");
    const vitestConfig = readFileSync(resolve(frameworkRoot, "vitest.config.ts"), "utf8");

    expect(tsconfig).not.toContain("@shared");
    expect(vitestConfig).not.toContain("@shared");
    expect(vitestConfig).not.toContain("apps/shared");
  });

  it("does not import shared runtime code from framework sources", () => {
    const sharedImportPattern =
      /from\s+["'](?:@shared(?:\/|["'])|(?:\.\.\/)+apps\/shared|.*\/apps\/shared)/;

    for (const file of frameworkSources()) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} should stay independent from apps/shared`).not.toMatch(
        sharedImportPattern,
      );
    }
  });
});
