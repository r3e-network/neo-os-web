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

// Neo Soft redesign adopts uppercase eyebrow/label tracking as the intentional
// design language. Guard that the tracked declarations all use the canonical
// 0.12em / 0.08em / 0 values rather than asserting everything is zero.
function assertNeoSoftLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected explicit letter-spacing declarations");
  const allowed = new Set(["0", "0.12em", "0.08em", "0.04em", "-0.02em"]);
  for (const value of values) {
    assert.ok(
      allowed.has(value),
      `unexpected letter-spacing value: ${value}`,
    );
  }
  // Neo Soft eyebrow tracking must actually be present (not collapsed to 0).
  assert.ok(
    values.includes("0.12em"),
    "expected Neo Soft eyebrow tracking letter-spacing: 0.12em",
  );
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
    "tarot-hero-metrics",
    "tarot-question-panel",
    "tarot-spread-panel",
    "tarot-reading-grid",
    "tarot-card-slot",
    "tarot-verification-panel",
    "tarot-reading-summary",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
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
  assert.match(
    styles,
    /\.tarot-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(320px,\s*0\.44fr\)/s,
  );
  assert.match(
    styles,
    /\.tarot-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(220px,\s*0\.4fr\)/s,
  );
  // Neo Soft light hero: dark ink heading on the light gradient, not white text.
  assert.match(
    styles,
    /\.tarot-hero-copy h2\s*\{[^}]*color:\s*var\(--tarot-ink\)/s,
  );
  // Neo Soft eyebrow kicker: uppercase + 0.12em tracking in the green accent.
  assert.match(
    styles,
    /\.tarot-hero-copy \.tarot-hero-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(
    styles,
    /\.tarot-hero-copy \.tarot-hero-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s,
  );
  assert.match(
    styles,
    /\.tarot-hero-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.tarot-reading-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // Light hero glow layered behind the linear gradient (intentional Neo Soft accent).
  assert.match(
    styles,
    /\.tarot-hero\s*\{[^}]*linear-gradient\(160deg,\s*var\(--tarot-violet-soft\)/s,
  );
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.tarot-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.tarot-card-position[\s\S]*letter-spacing:\s*0\.04em/s);

  assertNeoSoftLetterSpacing(styles);
  // Neo Soft intentionally uses uppercase eyebrows/labels with tracking.
  assert.match(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
