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

test("Gov Merc renders a complete wallet-style governance market workspace", () => {
  const playArea = read("apps/gov-merc/src/PlayArea.tsx");
  const actions = read("apps/gov-merc/src/components/MercActionCards.tsx");
  const bids = read("apps/gov-merc/src/components/MercBidsList.tsx");
  const main = read("apps/gov-merc/src/main.tsx");
  const messages = read("apps/gov-merc/src/locale/messages.ts");
  const styles = [
    read("apps/gov-merc/src/PlayArea.scss"),
    read("apps/gov-merc/src/components/MercActionCards.scss"),
    read("apps/gov-merc/src/components/MercHeroStats.scss"),
    read("apps/gov-merc/src/components/MercBidsList.scss"),
  ].join("\n");

  for (const className of [
    "gov-merc-shell",
    "gov-merc-hero",
    "gov-merc-scoreboard",
    // Neo Soft redesign renamed the deposit/withdraw/bid panel from
    // `gov-merc-pool-panel` to `gov-merc-action-panel` (it wraps the
    // gov-merc-action-grid action cards).
    "gov-merc-action-panel",
    "gov-merc-action-grid",
    "gov-merc-bid-panel",
    "gov-merc-flow",
    "gov-merc-risk-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /depositAmount/);
  assert.match(playArea, /withdrawAmount/);
  assert.match(playArea, /bidAmount/);
  assert.match(playArea, /setAmountValue/);
  assert.match(playArea, /state\[key\]\?\.set\(value\)/);
  assert.match(actions, /dispatch\("depositNeo"/);
  assert.match(actions, /dispatch\("withdrawNeo"/);
  assert.match(actions, /dispatch\("placeBid"/);

  assert.doesNotMatch(actions, /useState/);
  assert.match(actions, /depositAmount:\s*string/);
  assert.match(actions, /withdrawAmount:\s*string/);
  assert.match(actions, /bidAmount:\s*string/);
  assert.match(actions, /onAmountChange:\s*\(/);
  assert.match(actions, /value=\{depositAmount\}/);
  assert.match(actions, /onChange=\{\(value\) => onAmountChange\("depositAmount", value\)\}/);
  assert.match(actions, /disabled=\{isBusy \|\| !isPositiveAmount\(depositAmount\)\}/);

  assert.doesNotMatch(bids, /<NeoCard/);
  assert.match(bids, /gov-merc-empty-bids/);
  assert.match(bids, /rank/);

  for (const stateKey of ["depositAmount", "withdrawAmount", "bidAmount"]) {
    assert.match(main, new RegExp(`${stateKey}:\\s*pool\\.${stateKey}`));
  }

  for (const key of [
    "govHeroTitle",
    "govHeroSubtitle",
    "marketSignalTitle",
    "actionDepositHint",
    "actionWithdrawHint",
    "actionBidHint",
    "flowTitle",
    "flowDeposit",
    "flowBid",
    "flowInfluence",
    "emptyBidTitle",
    "emptyBidCopy",
    "riskNoteTitle",
    "riskNoteCopy",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.gov-merc-shell\s*\{/);
  assert.match(
    styles,
    /\.gov-merc-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.74fr\)\s+minmax\(340px,\s*0\.46fr\)/s,
  );
  assert.match(
    styles,
    /\.gov-merc-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(300px,\s*0\.48fr\)/s,
  );
  // Neo Soft redesign: the hero heading lives in `.gov-merc-hero-copy { h2 { ... } }`
  // and the dark wash (#f8fffb) was replaced with the light --ns-ink token.
  assert.match(
    styles,
    /\.gov-merc-hero-copy\s*\{[\s\S]*?\bh2\s*\{[^}]*color:\s*var\(--ns-ink,\s*#102019\)/s,
  );
  assert.match(styles, /white-space:\s*nowrap/);
  assert.match(styles, /word-break:\s*normal/);
  assert.match(
    styles,
    /\.gov-merc-action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.gov-merc-flow\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 920px\)[\s\S]*\.gov-merc-shell\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.gov-merc-action-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );

  // Neo Soft design language: small eyebrow/section labels are intentionally
  // uppercased and tracked out at 0.12em. Replaces the obsolete
  // zero-letter-spacing / no-uppercase guards from the dark theme.
  assert.match(styles, /text-transform:\s*uppercase/);
  // The hero eyebrow (`.gov-merc-hero-copy span`) must be an uppercase, tracked
  // eyebrow rather than a plain caption.
  assert.match(
    styles,
    /\.gov-merc-hero-copy\s*\{[\s\S]*?\bspan\s*\{[^}]*text-transform:\s*uppercase;[^}]*letter-spacing:\s*0\.12em/s,
  );
  // The section headings that label each panel share the same uppercase +
  // 0.12em tracked eyebrow treatment.
  assert.match(
    styles,
    /\.gov-merc-section-heading\s*\{[\s\S]*?\bspan\s*\{[^}]*text-transform:\s*uppercase;[^}]*letter-spacing:\s*0\.12em/s,
  );
  // Tracked eyebrows appear in several places; ensure the canonical 0.12em
  // tracking is present and not a one-off.
  assert.ok(
    [...styles.matchAll(/letter-spacing:\s*0\.12em/g)].length >= 2,
    "expected uppercase eyebrows tracked at 0.12em (Neo Soft design language)",
  );

  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
