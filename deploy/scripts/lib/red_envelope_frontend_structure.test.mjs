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

test("Red Envelope renders a complete wallet-style claim and creator workspace", () => {
  const playArea = read("apps/red-envelope/src/PlayArea.tsx");
  const styles = read("apps/red-envelope/src/PlayArea.scss");
  const main = read("apps/red-envelope/src/main.tsx");
  const messages = read("apps/red-envelope/src/locale/messages.ts");

  // Neo Soft redesign renamed the workspace regions: the hero stat strip is now
  // `redenv-metrics`, claim/create surfaces are `redenv-*-body`, the 3-step flow
  // strip became a `redenv-tabs` chooser, the safety block is a `<details>`
  // disclosure (`redenv-details`), and the envelope list is `redenv-list`.
  for (const className of [
    "redenv-shell",
    "redenv-hero",
    "redenv-metrics",
    "redenv-claim-body",
    "redenv-create-body",
    "redenv-tabs",
    "redenv-activity-panel",
    "redenv-details",
    "redenv-list",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /useState\(\{\s*amount:\s*"1"/s);
  assert.match(playArea, /setSelectedEnvelopeId\(String\(env\.id\)\)/);
  assert.match(playArea, /dispatch\("claimEnvelope",\s*\{\s*envelopeId:/s);
  assert.match(playArea, /dispatch\("createEnvelope",\s*createForm\)/);
  assert.match(playArea, /disabled=\{isLoading \|\| !selectedEnvelopeId\.trim\(\)\}/);
  assert.match(playArea, /disabled=\{isLoading \|\| !canCreateEnvelope\}/);
  assert.match(playArea, /value=\{selectedEnvelopeId\}/);
  assert.match(playArea, /value=\{createForm\.amount\}/);
  assert.match(playArea, /claimableGas/);
  assert.match(playArea, /completionRate/);

  assert.match(main, /ctx\.registerAction\("claimEnvelope"/);
  assert.match(main, /ctx\.registerAction\("createEnvelope"/);
  assert.match(main, /openingId:\s*envelope\.openingId/);

  for (const key of [
    "redEnvelopeHeroTitle",
    "redEnvelopeHeroSubtitle",
    "claimPanelTitle",
    "createPanelTitle",
    "claimRouteOne",
    "claimRouteTwo",
    "claimRouteThree",
    "safetyPanelTitle",
    "shareReadyTitle",
    "recentClaimsTitle",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  // Neo Soft light surface base.
  assert.match(styles, /\.redenv-play-area\s*\{[^}]*#f7f8fb/s);
  // The shell is a single centered grid column; the hero card is a flex row
  // (icon badge + copy) rather than the old two-column dark grid.
  assert.match(styles, /\.redenv-shell\s*\{[^}]*display:\s*grid[^}]*min-width:\s*0/s);
  assert.match(styles, /\.redenv-main\s*\{[^}]*width:\s*min\(680px,\s*100%\)/s);
  assert.match(
    styles,
    /\.redenv-hero\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/s,
  );
  // Hero heading switched from a white-on-dark wash to the Neo Soft ink token.
  assert.match(
    styles,
    /\.redenv-hero \.redenv-hero-copy\s*\{[\s\S]*>\s*h2\s*\{[^}]*color:\s*var\(--ns-ink/s,
  );
  // 3-up stat strip is now `.redenv-metrics`.
  assert.match(
    styles,
    /\.redenv-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // The claim/create flow chooser is a two-column tab strip.
  assert.match(
    styles,
    /\.redenv-tabs\s*\{[^}]*grid-template-columns:\s*1fr\s+1fr/s,
  );
  // The selected-envelope summary keeps the 3-cell grid the old flow strip had.
  assert.match(
    styles,
    /\.redenv-selected-card\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // Mobile breakpoint collapses the multi-column regions to a single column.
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.redenv-metrics[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.redenv-activity-grid[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.redenv-row\s*\{[^}]*min-height:\s*44px/s);

  // Neo Soft adopts uppercase eyebrow labels with 0.12em tracking and tightened
  // headings with negative tracking -- assert that intentional language is present
  // (replaces the obsolete zero-letter-spacing / no-uppercase guards).
  assert.match(styles, /text-transform:\s*uppercase/);
  assert.match(
    styles,
    /\.redenv-hero \.redenv-hero-copy\s*\{[\s\S]*>\s*span\s*\{[^}]*text-transform:\s*uppercase[^}]*letter-spacing:\s*0\.12em/s,
  );
  assert.match(
    styles,
    /\.redenv-hero \.redenv-hero-copy\s*\{[\s\S]*>\s*h2\s*\{[^}]*letter-spacing:\s*-0\.02em/s,
  );
  // Still-valid Neo Soft constraints: no fluid clamp typography, no radial
  // gradients, and bounded literal border radii (no 20-99px corners).
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
