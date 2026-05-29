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

test("Quadratic Funding renders a compact wallet-style grant console with complete actions", () => {
  const playArea = read("apps/quadratic-funding/src/PlayArea.tsx");
  const styles = read("apps/quadratic-funding/src/PlayArea.scss");
  const hero = read("apps/quadratic-funding/src/components/FundingHero.tsx");
  const roundForm = read("apps/quadratic-funding/src/pages/index/components/RoundForm.tsx");
  const roundList = read("apps/quadratic-funding/src/pages/index/components/RoundList.tsx");
  const page = read("apps/quadratic-funding/src/pages/index/composables/useQuadraticFundingPage.ts");
  const main = read("apps/quadratic-funding/src/main.tsx");
  const messages = read("apps/quadratic-funding/src/locale/messages.ts");

  for (const className of [
    "qf-shell",
    "qf-wallet-strip",
    "qf-action-tabs",
    "qf-content-grid",
    "qf-impact-strip",
    "qf-contribute-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  for (const className of [
    "qf-hero",
    "qf-hero-copy",
    "qf-hero-ledger",
    "qf-hero-metric",
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

  assert.match(styles, /\.qf-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.qf-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(300px,\s*0\.42fr\)/s);
  assert.match(styles, /\.qf-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(280px,\s*0\.58fr\)/s);
  assert.match(styles, /\.qf-wallet-strip\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.qf-content-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.82fr\) minmax\(300px,\s*0\.38fr\)/s);
  assert.match(styles, /\.qf-impact-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.qf-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.qf-wallet-strip[\s\S]*grid-template-columns:\s*1fr 1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
