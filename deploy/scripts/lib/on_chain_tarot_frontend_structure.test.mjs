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

function assertZeroLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected explicit letter-spacing declarations");
  for (const value of values) {
    assert.equal(value, "0", `unexpected letter-spacing value: ${value}`);
  }
}

test("On-Chain Tarot renders a complete wallet-style oracle reading workspace", () => {
  const playArea = read("apps/on-chain-tarot/src/PlayArea.tsx");
  const styles = read("apps/on-chain-tarot/src/PlayArea.scss");
  const messages = read("apps/on-chain-tarot/src/locale/messages.ts");

  for (const className of [
    "tarot-shell",
    "tarot-main",
    "tarot-hero",
    "tarot-hero-eyebrow",
    "tarot-hero-meta",
    "tarot-hero-stage",
    "tarot-workspace",
    "tarot-side",
    "tarot-question-panel",
    "tarot-spread-panel",
    "tarot-reading-grid",
    "tarot-card-slot",
    "tarot-verification-panel",
    "tarot-reading-summary",
  ]) {
    // Tolerate both static className="…" and template-literal className={`…`}.
    assert.match(playArea, new RegExp(`className=(?:"|\\{\`)[^"\`]*${className}`));
  }

  assert.match(playArea, /dispatch\("setQuestion",\s*event\.currentTarget\.value\)/);
  assert.match(playArea, /dispatch\("draw"\)/);
  assert.match(playArea, /dispatch\("reset"\)/);
  assert.match(playArea, /dispatch\("flipCard",\s*index\)/);
  assert.match(playArea, /readingMode === "oracle"/);
  assert.match(playArea, /allFlipped/);
  assert.match(playArea, /TAROT_CARD_BACK/);

  for (const key of [
    "tarotHeroTitle",
    "tarotHeroSubtitle",
    "oracleRequestTitle",
    "oraclePromptLabel",
    "feeLabel",
    "tarotFee",
    "verificationPanelTitle",
    "contractRouteLabel",
    "tarotContractRoute",
    "cardsDrawnCount",
    "readingSummary",
    "spreadPanelTitle",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.tarot-play-area\s*\{[^}]*#f7f8fb/s);
  // Two-column workspace shell: main reading column + fixed-min side rail.
  assert.match(
    styles,
    /\.tarot-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*0\.34fr\)/s,
  );
  // Hero pairs focused copy with a real reading-table image stage.
  assert.match(
    styles,
    /\.tarot-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.9fr\)\s+minmax\(360px,\s*0\.78fr\)/s,
  );
  assert.match(
    playArea,
    /src="\.\/tarot-reading-table\.jpg"/,
  );
  assert.match(
    styles,
    /\.tarot-hero-stage\s*\{[^}]*min-height:\s*310px/s,
  );
  // Neo Soft light hero: dark ink heading on the light gradient, not white text.
  assert.match(
    styles,
    /\.tarot-hero-copy h2\s*\{[^}]*color:\s*var\(--tarot-ink\)/s,
  );
  // Tarot labels stay uppercase but no longer use artificial tracking.
  assert.match(
    styles,
    /\.tarot-hero-copy \.tarot-hero-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(
    styles,
    /\.tarot-hero-copy \.tarot-hero-eyebrow\s*\{[^}]*letter-spacing:\s*0/s,
  );
  // Inner workspace keeps the spread and prompt side by side on desktop.
  assert.match(
    styles,
    /\.tarot-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.64fr\)\s+minmax\(300px,\s*0\.36fr\)/s,
  );
  assert.match(
    styles,
    /\.tarot-reading-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // The draw CTA keeps white text/spinner on the darker green active fill.
  assert.match(
    styles,
    /&:not\(:disabled\),\s*&\.neo-btn--loading\s*\{[\s\S]*color:\s*#ffffff/s,
  );
  assert.match(
    styles,
    /&:hover:not\(:disabled\)\s*\{[^}]*color:\s*#ffffff/s,
  );
  // Light hero glow layered behind the linear gradient (intentional Neo Soft accent).
  assert.match(
    styles,
    /\.tarot-hero\s*\{[^}]*linear-gradient\(\s*140deg,\s*rgba\(228,\s*248,\s*240,\s*0\.92\)/s,
  );
  // Two-column shell collapses to a single column at the narrow breakpoint.
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.tarot-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.tarot-card-position[\s\S]*letter-spacing:\s*0/s);

  assertZeroLetterSpacing(styles);
  // Tarot intentionally uses uppercase eyebrows/labels without extra tracking.
  assert.match(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
