import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertMessageKeys,
  assertModernTypography,
  exists,
  read,
} from "./frontend_structure_helpers.mjs";

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
  assertClasses(playArea, [
    "domain-factory",
    "domain-factory-hero",
    "domain-factory-studio-flow",
    "domain-factory-preview__nft",
    "domain-factory-drop-rail",
    "domain-factory-choice",
    "domain-factory-toggle-button",
  ], "NFT Factory");
  assert.match(playArea, /src="\.\/nft-drop-preview\.webp"/);
  assert.match(playArea, /dispatch\("generatePlan"/);
  assert.match(playArea, /dispatch\("signCurrentPlan"\)/);
  assert.match(playArea, /dispatch\("executePlan"\)/);
  assert.match(playArea, /domain-factory-drop-composer__policy/);
  assert.match(playArea, /aria-label=\{t\("previewTransferPolicy"\)\}/);
  assert.match(playArea, /transferable:\s*option\.value/);
  assert.match(styles, /\.domain-factory--nep11\s*\{/);
  assert.match(styles, /\.domain-factory-preview__art > img\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /@media \(max-width:/);
  assertMessageKeys(messages, ["dropStudio", "dropStudioHint", "previewTransferPolicy"], "Factory messages");
  assert.match(appMessages, /title:\s*\{\s*en:\s*"NFT Factory"/);
  assert.match(indexHtml, /href="\.\/logo\.webp"/);
  assert.match(indexHtml, /content="\.\/banner\.webp"/);
  assert.match(manifest, /"icon": "\/miniapps\/nft-factory\/logo\.webp"/);
  assert.match(manifest, /"banner": "\/miniapps\/nft-factory\/banner\.webp"/);
  assertAssets([
    "apps/nft-factory/public/nft-drop-preview.webp",
    "apps/nft-factory/public/banner.webp",
    "apps/nft-factory/public/logo.webp",
  ]);
  assert.ok(exists("apps/nft-factory/public/nft-drop-preview.webp"));
  assertModernTypography(styles, "NFT Factory");
});
