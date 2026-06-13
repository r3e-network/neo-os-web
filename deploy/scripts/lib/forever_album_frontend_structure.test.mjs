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

// Neo Soft (commit 05ef54aab) intentionally adopts uppercase eyebrow labels with
// positive letter-spacing tracking as the design language. Replace the obsolete
// "only zero letter-spacing" guard with a positive guard that the eyebrow tracking
// is actually shipped (0.12em on the hero kicker) alongside the uppercase treatment.
function assertNeoSoftEyebrowTracking(styles) {
  assert.match(
    styles,
    /\.forever-album-kicker\s*\{[^}]*letter-spacing:\s*0\.12em[^}]*text-transform:\s*uppercase/s,
    "expected Neo Soft uppercase eyebrow with 0.12em tracking on the hero kicker",
  );
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
    "forever-album-workspace",
    "forever-album-uploader",
    "forever-album-howto",
    "forever-album-safety-strip",
  ]) {
    // Accept both the static `className="…"` form and the template-literal
    // `className={`…`}` form. The workspace NeoCard now appends a
    // `forever-album-workspace--empty` modifier via a template literal, so a
    // strict double-quote-only guard no longer fits while the class is still
    // rendered. Either an opening `"` or an opening backtick may precede it.
    assert.match(playArea, new RegExp(`className=\\{?["\`][^"\`]*${className}`));
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
    "forever-album-empty-line",
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

  // Neo Soft light base surface: the play area sits on the --ns-bg token.
  assert.match(styles, /\.album-play-area\s*\{[\s\S]*var\(--ns-bg,\s*#f4f5f7\)/s);
  // Shell + hero became stacked flex columns (no more side-by-side grid templates).
  assert.match(styles, /\.forever-album-shell\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.forever-album-hero\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
  // Hero heading uses the Neo Soft ink token instead of the old dark wash.
  assert.match(styles, /\.forever-album-hero\s*\{[\s\S]*h1\s*\{[^}]*color:\s*var\(--fa-ink\)/s);
  assert.match(styles, /\.forever-album-vault-strip\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  // The two-column content layout now lives on the workspace NeoCard's content slot.
  assert.match(styles, /\.forever-album-workspace \.neo-card__content\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(280px,\s*0\.62fr\)/s);
  assert.match(styles, /\.forever-album-safety-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  // Workspace content grid collapses to a single column on the medium breakpoint.
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.forever-album-workspace \.neo-card__content[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.forever-album-vault-strip[\s\S]*grid-template-columns:\s*1fr 1fr/s);

  // Neo Soft adopts uppercase eyebrows + 0.12em tracking as the intentional design
  // language, so assert the new language is present rather than forbidding it.
  assertNeoSoftEyebrowTracking(styles);
  assert.match(`${styles}\n${gridStyles}`, /text-transform:\s*uppercase/);
  // These design-system constraints still hold and remain real guards.
  assert.doesNotMatch(`${styles}\n${gridStyles}`, /font-size:\s*clamp\(/);
  assert.doesNotMatch(`${styles}\n${gridStyles}`, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);

  // The Neo Soft redesign introduced soft radial accent washes (hero/background/
  // locked-photo placeholder), so the old blanket "no radial-gradient" ban no longer
  // fits. Replace it with a bounded guard: every radial-gradient must fade to
  // transparent — a soft wash. An opaque radial-gradient (no transparent stop) would
  // be an off-theme heavy-wash regression and still fails here.
  const radialSegments = `${styles}\n${gridStyles}`.split(/radial-gradient\(/).slice(1);
  assert.ok(radialSegments.length > 0, "expected soft radial accent washes in the Neo Soft sheet");
  for (const segment of radialSegments) {
    const declaration = segment.split(";")[0];
    assert.match(
      declaration,
      /transparent/,
      "each radial-gradient must fade to transparent (soft accent wash only, no opaque wash)",
    );
  }
});
