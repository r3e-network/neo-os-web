import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

test("NFT Factory renders an NFT-native drop studio with real assets", () => {
  const playArea = read("apps/shared/factory/FactoryPlayArea.tsx");
  const styles = read("apps/shared/factory/FactoryPlayArea.scss");
  const messages = read("apps/shared/factory/messages.ts");
  const appMessages = read("apps/nft-factory/src/locale/messages.ts");
  const manifest = read("apps/nft-factory/neo-manifest.json");
  const indexHtml = read("apps/nft-factory/index.html");
  const main = read("apps/nft-factory/src/main.tsx");

  assert.match(main, /createFactoryPlayArea\(kind, appId\)/);
  assert.match(main, /const kind = "nep11"/);
  assert.match(playArea, /domain-factory--\$\{kind\}/);
  assert.match(playArea, /src="\.\/nft-drop-preview\.jpg"/);
  assert.match(playArea, /className="domain-factory-drop-rail"/);
  assert.match(playArea, /dispatch\("generatePlan"/);
  assert.match(playArea, /dispatch\("signCurrentPlan"\)/);
  assert.match(playArea, /dispatch\("executePlan"\)/);
  assert.match(playArea, /<NeoInput[\s\S]{0,120}label=\{t\("collectionName"\)\}/);
  assert.match(playArea, /<ToggleField[\s\S]{0,160}label=\{t\("transferable"\)\}/);

  assert.match(styles, /\.domain-factory--nep11\s*\{/);
  assert.match(styles, /\.domain-factory--nep11 \.domain-factory-preview__nft\s*\{[^}]*grid-template-columns/s);
  assert.match(styles, /\.domain-factory-preview__art img\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.domain-factory-preview__art-overlay\s*\{/);
  assert.match(styles, /\.domain-factory-drop-rail__stats\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width: 860px\)[\s\S]*\.domain-factory--nep11 \.domain-factory-preview__nft[\s\S]*grid-template-columns:\s*1fr/s);

  assert.match(messages, /dropStudio:/);
  assert.match(messages, /dropStudioHint:/);
  assert.match(appMessages, /title:\s*\{\s*en:\s*"NFT Factory"/);
  assert.match(indexHtml, /href="\.\/logo\.jpg"/);
  assert.match(indexHtml, /content="\.\/banner\.jpg"/);
  assert.match(manifest, /"icon": "\/miniapps\/nft-factory\/logo\.jpg"/);
  assert.match(manifest, /"banner": "\/miniapps\/nft-factory\/banner\.jpg"/);

  assert.ok(exists("apps/nft-factory/public/nft-drop-preview.jpg"));
  assert.ok(exists("apps/nft-factory/public/banner.jpg"));
  assert.ok(exists("apps/nft-factory/public/logo.jpg"));

  assert.doesNotMatch(styles, /letter-spacing:\s*-/);
  assert.doesNotMatch(styles, /letter-spacing:\s*0\.[0-9]+em/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
});
