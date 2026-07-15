import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const appDir = path.join(repoRoot, "apps/oracle-seal-console");
const read = (file) => readFileSync(path.join(appDir, file), "utf8");

test("Oracle Seal Console keeps a resource-led production surface", () => {
  const manifest = JSON.parse(read("neo-manifest.json"));
  const pkg = JSON.parse(read("package.json"));
  const main = read("src/main.tsx");
  const playArea = read("src/PlayArea.tsx");
  const styles = read("src/PlayArea.scss");
  const source = [main, playArea, read("src/appConfig.ts")].join("\n");

  assert.equal(pkg.version, manifest.version);
  assert.equal(manifest.features.stateless, false);
  assert.deepEqual(manifest.operation_panel.operations, []);
  assert.equal(manifest.platform.transactions, false);
  assert.ok(manifest.permissions.includes("confidential"));
  assert.ok(manifest.permissions.includes("read:blockchain"));
  assert.match(main, /readOracleSealContractEvidence\(network\)/);
  assert.match(main, /createOracleSealOperationCoordinator/);
  assert.match(main, /assertOracleSealStorageAvailable/);
  assert.doesNotMatch(main, /app\.chain\.(?:detectNetwork|read)/);
  assert.match(playArea, /seal-reference-stage\.webp/);
  assert.doesNotMatch(source, /<svg\b|data:image\/svg\+xml/i);
  assert.doesNotMatch(source, /\p{Extended_Pictographic}/u);
  assert.match(styles, /--seal-canvas:\s*#faf9f3/i);
  assert.match(styles, /object-fit:\s*contain/);
  assert.doesNotMatch(styles, /backdrop-filter|radial-gradient/i);

  for (const asset of [
    "public/seal-reference-stage.webp",
    "public/banner.webp",
    "public/banner.avif",
    "public/logo.webp",
    "public/logo.avif",
  ]) {
    const file = path.join(appDir, asset);
    assert.ok(existsSync(file), asset);
    assert.ok(statSync(file).size > 1_000, asset);
  }
  assert.equal(existsSync(path.join(appDir, "public/banner.svg")), false);
  assert.equal(existsSync(path.join(appDir, "public/logo.svg")), false);
  for (const document of [
    "README.md",
    "PRODUCTION_STATUS.md",
    "NETWORK_STATUS.md",
    "ASSET_PROVENANCE.md",
  ]) {
    assert.ok(existsSync(path.join(appDir, document)), document);
  }
});
