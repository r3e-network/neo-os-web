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

// The Neo Soft redesign (commit 05ef54aab) intentionally adopts uppercase
// eyebrow labels with 0.12em tracking as the design language. Assert the new
// language is present rather than the obsolete "every letter-spacing is 0" rule.
function assertNeoSoftEyebrow(styles) {
  // The eyebrow/kicker carries the uppercase + tracking treatment.
  assert.match(
    styles,
    /\.qf-hero-kicker\s*\{[^}]*letter-spacing:\s*0\.12em;[^}]*text-transform:\s*uppercase;/s,
    "expected the hero kicker to use the Neo Soft uppercase + 0.12em tracking eyebrow",
  );
  // Tracking is shared by other small-caps labels (e.g. admin group titles).
  const trackedLabels = [
    ...styles.matchAll(/letter-spacing:\s*0\.12em;/g),
  ];
  assert.ok(
    trackedLabels.length >= 2,
    "expected at least two 0.12em tracked eyebrow labels in the redesign",
  );
}

test("Quadratic Funding renders a compact wallet-style grant console with complete actions", () => {
  const playArea = read("apps/quadratic-funding/src/PlayArea.tsx");
  const styles = read("apps/quadratic-funding/src/PlayArea.scss");
  const hero = read("apps/quadratic-funding/src/components/FundingHero.tsx");
  const roundForm = read("apps/quadratic-funding/src/pages/index/components/RoundForm.tsx");
  const roundList = read("apps/quadratic-funding/src/pages/index/components/RoundList.tsx");
  const page = read("apps/quadratic-funding/src/pages/index/composables/useQuadraticFundingPage.ts");
  const main = read("apps/quadratic-funding/src/main.tsx");
  const messages = read("apps/quadratic-funding/src/locale/messages.ts");

  // The redesign retired the standalone qf-wallet-strip / qf-impact-strip stat
  // bands; their funding-metric intent now lives in the hero ledger and the
  // count-badged action tabs. Guard the current structural regions instead.
  for (const className of [
    "qf-shell",
    "qf-main-column",
    "qf-action-tabs",
    "qf-content-grid",
    "qf-side-stack",
    "qf-contribute-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  // Hero regions were renamed in the redesign: qf-hero-copy/-ledger/-metric ->
  // qf-hero-intro (badge + eyebrow), qf-hero-kicker (eyebrow), qf-hero-facts
  // (the inline matching-pool / live-round ledger). Progress bar is unchanged.
  for (const className of [
    "qf-hero",
    "qf-hero-intro",
    "qf-hero-kicker",
    "qf-hero-facts",
    "qf-progress-bar",
  ]) {
    assert.match(hero, new RegExp(`className="[^"]*${className}`));
  }
  assert.doesNotMatch(hero, /hero-container/);
  assert.match(hero, /onRefresh/);
  assert.match(hero, /onContribute/);

  assert.match(playArea, /dispatch\("switchTab", tab\)/);
  assert.match(playArea, /dispatch\("selectRound", round\)/);
  assert.match(playArea, /contributionMemo/);
  assert.match(playArea, /memo: contributionMemo/);

  assert.match(main, /ctx\.registerAction\("switchTab"/);
  assert.match(main, /qf\.onTabChange\(String\(args\[0\]/);
  assert.match(main, /ctx\.registerAction\("selectRound"/);
  assert.match(main, /qf\.handleSelectRound/);
  assert.match(main, /roundCount: qf\.roundCount/);
  assert.match(main, /matchingPoolDisplay: qf\.matchingPoolDisplay/);

  assert.match(page, /const roundCount = createDerived/);
  assert.match(page, /const projectCount = createDerived/);
  assert.match(page, /const matchingPoolDisplay = createDerived/);
  assert.match(page, /const handleSelectRound = async/);
  assert.match(page, /await refreshProjects\(\)/);

  assert.match(roundForm, /NeoCard[\s\S]*className="qf-form-panel"/);
  assert.match(roundForm, /className="qf-form-grid"/);
  assert.match(roundForm, /matchingPoolHint/);

  assert.match(roundList, /className="qf-round-panel"/);
  assert.match(roundList, /className="qf-empty-ledger"/);
  assert.match(roundList, /<button[\s\S]*className=\{`qf-round-card/);
  assert.doesNotMatch(roundList, /<div[^>]*className="round-card"/);

  for (const key of [
    "qfHeroTitle",
    "qfHeroSubtitle",
    "qfPrimaryAction",
    "qfRefreshAction",
    "qfLiveRound",
    "qfNoRoundTitle",
    "qfNoRoundBody",
    "qfTrustItemOne",
    "qfTrustItemTwo",
    "qfTrustItemThree",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  // The redesign moved to light --ns-* design tokens; the play-area canvas now
  // uses the Neo Soft background token (var(--ns-bg, #f4f5f7)).
  assert.match(styles, /\.qf-play-area\s*\{[^}]*var\(--ns-bg,\s*#f4f5f7\)/s);
  // qf-shell is now a centered max-width column wrapper, not a 2-track grid.
  assert.match(styles, /\.qf-shell\s*\{[^}]*max-width:\s*1080px;[^}]*margin:\s*0 auto;/s);
  // The hero stacks its copy/ledger/actions vertically (flex column) rather
  // than the retired two-track grid layout.
  assert.match(styles, /\.qf-hero\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  // The primary content layout grid is unchanged.
  assert.match(styles, /\.qf-content-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.82fr\) minmax\(300px,\s*0\.38fr\)/s);
  // The 4-up wallet strip and 3-up impact strip were retired; the surviving
  // metric grids are the 2-up form / round-card grids and the 3-up project stats.
  assert.match(styles, /\.qf-form-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.qf-project-stats\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  // Responsive collapse: content grid stacks at <=980px; the inner metric grids
  // collapse to a single column at <=760px.
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.qf-content-grid[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.qf-form-grid[\s\S]*grid-template-columns:\s*1fr/s);

  // Neo Soft design language: uppercase eyebrows with 0.12em tracking are now
  // intentional (replaces the obsolete zero-letter-spacing / no-uppercase rules).
  assertNeoSoftEyebrow(styles);
  assert.match(styles, /text-transform:\s*uppercase/);
  // Still-valid design-system constraints: no fluid clamp typography, no radial
  // gradients, and radii stay token-bounded (no bare 20px+ literal radii).
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
