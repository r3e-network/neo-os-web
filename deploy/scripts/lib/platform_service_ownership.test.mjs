import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const auditScript = path.join(
  repoRoot,
  "deploy",
  "scripts",
  "audit_platform_unified_layers.js",
);

test("platform unified-layer audit reports no app-local PlatformServices ownership violations", () => {
  const result = spawnSync(process.execPath, [auditScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    "non-strict audit should complete successfully",
  );

  const output = `${result.stdout}\n${result.stderr}`;

  assert.doesNotMatch(
    output,
    /\[error\] service-ownership .*src\/main\.ts: miniapp entrypoint instantiates PlatformServices directly/,
  );

  const mainFiles = fs
    .readdirSync(path.join(repoRoot, "apps"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => path.join(repoRoot, "apps", entry.name, "src", "main.ts"))
    .filter((file) => fs.existsSync(file));

  for (const file of mainFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(
      source.includes("PlatformServices.create("),
      false,
      `miniapp entrypoint should not instantiate PlatformServices directly: ${path.relative(repoRoot, file)}`,
    );
  }
});

test("shared miniapp entry path owns the real PlatformServices instance", () => {
  const defineMiniAppFile = path.join(
    repoRoot,
    "apps",
    "shared",
    "utils",
    "defineMiniApp.ts",
  );
  const miniAppRootFile = path.join(
    repoRoot,
    "apps",
    "shared",
    "react",
    "MiniAppRoot.tsx",
  );
  const miniAppContextFile = path.join(
    repoRoot,
    "apps",
    "shared",
    "types",
    "miniapp-context.ts",
  );

  const defineMiniAppSource = fs.readFileSync(defineMiniAppFile, "utf8");
  const miniAppRootSource = fs.readFileSync(miniAppRootFile, "utf8");
  const miniAppContextSource = fs.readFileSync(miniAppContextFile, "utf8");

  assert.equal(
    defineMiniAppSource.includes("createStubServices"),
    false,
    "defineMiniApp should not construct stub PlatformServices instances",
  );
  assert.match(
    miniAppRootSource,
    /PlatformServices\.create\((?:props\.)?appId,/,
    "MiniAppRoot should create the real PlatformServices instance",
  );
  assert.match(
    miniAppRootSource,
    /(?:const ctx|ctxRef\.current)[\s\S]*?\bservices\b/,
    "MiniAppRoot should wire ctx.services to the real platform services object",
  );
  assert.match(
    miniAppRootSource,
    /services\.destroy\(\)/,
    "MiniAppRoot should destroy the shared PlatformServices instance on unmount",
  );
  assert.equal(
    miniAppContextSource.includes("stub"),
    false,
    "miniapp context types/docs should not describe services as a stub fallback",
  );
});

test("unified-layer audit does not flag neo-sign-anything for off-chain wallet signing", () => {
  const result = spawnSync(process.execPath, [auditScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    "non-strict audit should complete successfully",
  );

  const output = `${result.stdout}\n${result.stderr}`;

  assert.doesNotMatch(
    output,
    /\[warn\] chain-layer apps\/neo-sign-anything\/src\/composables\/useSignAnything\.ts:/,
  );
});
