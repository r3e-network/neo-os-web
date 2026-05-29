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

function assertOnlyZeroLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected explicit letter-spacing declarations");
  assert.deepEqual(values, values.map(() => "0"));
}

test("Forever Album renders a complete wallet-style on-chain memory vault", () => {
  const playArea = read("apps/forever-album/src/PlayArea.tsx");
  const styles = read("apps/forever-album/src/PlayArea.scss");
  const grid = read("apps/forever-album/src/components/AlbumGrid.tsx");
  const gridStyles = read("apps/forever-album/src/components/AlbumGrid.scss");
  const main = read("apps/forever-album/src/main.tsx");
  const messages = read("apps/forever-album/src/locale/messages.ts");

  for (const className of [
    "forever-album-shell",
    "forever-album-hero",
    "forever-album-vault-strip",
    "forever-album-content-grid",
    "forever-album-upload-panel",
    "forever-album-timeline",
    "forever-album-safety-strip",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /dispatch\("refreshPhotos"\)/);
  assert.match(playArea, /dispatch\("addFiles", Array\.from\(files\)\)/);
  assert.match(playArea, /dispatch\("uploadPhotos"\)/);
  assert.match(playArea, /selectedImages\.length > 0/);
  assert.match(playArea, /input[\s\S]*type="file"[\s\S]*accept="image\/\*"/);
  assert.match(playArea, /type="checkbox"[\s\S]*checked=\{isEncrypted\}/);

  assert.match(main, /ctx\.registerAction\("refreshPhotos"/);
  assert.match(main, /album\.loadPhotos\(\)/);

  for (const className of [
    "forever-album-grid-card",
    "forever-album-gallery-grid",
    "forever-album-photo-button",
    "forever-album-add-card",
    "forever-album-empty",
  ]) {
    assert.match(grid, new RegExp(`className="[^"]*${className}`));
  }
  assert.match(grid, /<button[\s\S]*className="forever-album-photo-button/);
  assert.match(grid, /<button[\s\S]*className="forever-album-add-card/);

  for (const key of [
    "vaultHeroTitle",
    "vaultHeroSubtitle",
    "refreshAlbum",
    "vaultRouteTitle",
    "vaultUploadTitle",
    "vaultPrivacyTitle",
    "vaultSafetyOne",
    "vaultSafetyTwo",
    "vaultSafetyThree",
    "emptyAction",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  assert.match(styles, /\.album-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.forever-album-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(300px,\s*0\.38fr\)/s);
  assert.match(styles, /\.forever-album-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.82fr\) minmax\(280px,\s*0\.42fr\)/s);
  assert.match(styles, /\.forever-album-vault-strip\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.forever-album-content-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.76fr\) minmax\(300px,\s*0\.44fr\)/s);
  assert.match(styles, /\.forever-album-safety-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.forever-album-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.forever-album-vault-strip[\s\S]*grid-template-columns:\s*1fr 1fr/s);

  assertOnlyZeroLetterSpacing(`${styles}\n${gridStyles}`);
  assert.doesNotMatch(`${styles}\n${gridStyles}`, /text-transform:\s*uppercase/);
  assert.doesNotMatch(`${styles}\n${gridStyles}`, /font-size:\s*clamp\(/);
  assert.doesNotMatch(`${styles}\n${gridStyles}`, /radial-gradient/i);
  assert.doesNotMatch(`${styles}\n${gridStyles}`, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
