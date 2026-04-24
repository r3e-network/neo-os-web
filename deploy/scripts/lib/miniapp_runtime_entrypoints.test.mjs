import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const appsDir = path.join(repoRoot, "apps");

function listMiniAppDirs() {
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => entry.name)
    .sort();
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function parseSource(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  const scriptKind = fullPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(
    fullPath,
    fs.readFileSync(fullPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
}

test("miniapp index.html entrypoints resolve to existing source files", () => {
  for (const appName of listMiniAppDirs()) {
    const relativeIndexPath = path.join("apps", appName, "index.html");
    const indexSource = read(relativeIndexPath);
    const match = indexSource.match(/<script type="module" src="\.\/src\/([^"]+)"><\/script>/);

    assert.ok(match, `missing module entrypoint in ${relativeIndexPath}`);

    const entryPath = path.join(repoRoot, "apps", appName, "src", match[1]);
    assert.ok(
      fs.existsSync(entryPath),
      `${relativeIndexPath} points to missing entrypoint ${path.relative(repoRoot, entryPath)}`,
    );
  }
});

test("flagship miniapp composables stay free of syntax errors", () => {
  for (const relativePath of [
    "apps/dev-tipping/src/composables/useDevTippingStats.ts",
    "apps/flashloan/src/composables/useFlashloanCore.ts",
    "apps/fogplay/src/composables/useCoinFlip.ts",
    "apps/last-survivor/src/composables/useLastSurvivor.ts",
    "apps/wallet-health/src/composables/useHealthScore.ts",
  ]) {
    const sourceFile = parseSource(relativePath);
    assert.deepEqual(
      sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.messageText),
      [],
      `${relativePath} contains parse errors`,
    );
  }
});

test("burn league entrypoint matches its OS-service composable and rendered state shape", () => {
  const mainSource = read("apps/burn-league/src/main.tsx");
  const playAreaSource = read("apps/burn-league/src/PlayArea.tsx");

  assert.match(mainSource, /nftService:\s*ctx\.os\.nft/);
  assert.match(mainSource, /burn\.burnTokens/);
  assert.match(mainSource, /burnCount:\s*burn\.burnCount/);
  assert.doesNotMatch(mainSource, /paymentService|storageService|burnGas/);

  assert.match(playAreaSource, /burned:\s*number/);
  assert.match(playAreaSource, /entry\.burned/);
  assert.doesNotMatch(playAreaSource, /entry\.amount/);
});
