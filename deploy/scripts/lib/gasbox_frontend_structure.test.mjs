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

// The "Neo Soft" light redesign (commit 05ef54aab) adopted uppercase eyebrow
// labels with 0.12em letter-spacing tracking as the intentional design language.
// This positive guard asserts that language is present (replacing the obsolete
// "only zero letter-spacing" / "no uppercase" guards from the old dark design).
function assertNeoSoftEyebrowLanguage(styles) {
  const trackingValues = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(
    trackingValues.includes("0.12em"),
    "expected Neo Soft eyebrow tracking (letter-spacing: 0.12em) to be present",
  );
  assert.match(
    styles,
    /\.gasbox-eyebrow[\s\S]*letter-spacing:\s*0\.12em;[\s\S]*text-transform:\s*uppercase;/,
    "expected .gasbox-eyebrow to carry the uppercase + 0.12em tracking eyebrow style",
  );
}

test("GasBox renders a complete wallet-style market console even with no active machines", () => {
  const playArea = read("apps/gasbox/src/PlayArea.tsx");
  const styles = read("apps/gasbox/src/PlayArea.scss");
  const messages = read("apps/gasbox/src/locale/messages.ts");
  const main = read("apps/gasbox/src/main.tsx");

  assert.match(playArea, /className="gasbox-hero"/);
  // Neo Soft redesign: the live-market "signal" surface is the hero status line
  // (renders signalLabel) rather than a standalone gasbox-signal-card.
  assert.match(playArea, /className="gasbox-hero__status"/);
  assert.match(playArea, /className="gasbox-market-empty"/);
  // Neo Soft redesign: the 4-cell "player route" became the pull-decision strip
  // (cost / inventory / prize focus / odds coverage) inside the gasbox-decision section.
  assert.match(playArea, /className="gasbox-decision"/);
  assert.match(playArea, /className="gasbox-decision-strip"/);
  // Neo Soft redesign: escrow/odds safety is enforced through the pull checklist
  // (machine active / prize inventory / odds readable) rather than a safety-card.
  assert.match(playArea, /className="gasbox-checklist"/);
  // machineCount placeholder switched from t("gasboxPending") to the em-dash glyph.
  assert.match(playArea, /machineCount > 0 \? machineCount\.toLocaleString\(\) : "—"/);
  assert.match(playArea, /const selectedMachineReady = Boolean/);
  assert.match(playArea, /dispatch\("refreshMachines"\)/);
  assert.match(playArea, /dispatch\("openStudio"\)/);
  assert.match(main, /ctx\.registerAction\("refreshMachines"/);
  assert.match(main, /ctx\.registerAction\("openStudio"/);
  assert.match(main, /gasbox\.loadAll\(\)/);

  for (const key of [
    "gasboxPending",
    "gasboxLiveStatus",
    "gasboxMarketEmptyTitle",
    "gasboxMarketEmptyDesc",
    "gasboxPlayerRoute",
    "gasboxEscrowSafetyTitle",
    "gasboxEscrowSafetyDesc",
    "openStudio",
    "studioGuidance",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  // Neo Soft light surface: page background token --ns-bg with #f4f5f7 fallback.
  assert.match(styles, /\.gasbox-play-area\s*\{[^}]*var\(--ns-bg,\s*#f4f5f7\)/s);
  assert.match(styles, /\.gasbox-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(300px,\s*0\.62fr\)/s);
  // The hero itself carries the soft brand-tinted gradient (no separate signal-card).
  assert.match(styles, /\.gasbox-hero\s*\{[^}]*linear-gradient\(135deg,\s*#ffffff 0%,\s*var\(--ns-brand-soft,\s*#e4f8f0\) 100%\)/s);
  // The 4-column player route is the decision strip.
  assert.match(styles, /\.gasbox-decision-strip\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  // gasbox-market-empty is now a plain grid block (no longer a NeoCard wrapper).
  assert.match(styles, /\.gasbox-market-empty\s*\{[^}]*display:\s*grid/s);
  // The escrow/odds safety checklist styling block.
  assert.match(styles, /\.gasbox-checklist\s*\{[^}]*display:\s*grid/s);
  // Hero collapses to a single column at the 900px breakpoint.
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.gasbox-hero[\s\S]*grid-template-columns:\s*1fr/s);
  // The decision strip collapses to a single column at the 480px breakpoint.
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*\.gasbox-decision-strip[\s\S]*grid-template-columns:\s*1fr/s);

  // Neo Soft intentionally uses uppercase eyebrows + 0.12em tracking, so assert
  // that language is present instead of forbidding it.
  assertNeoSoftEyebrowLanguage(styles);
  assert.match(styles, /text-transform:\s*uppercase/);
  // Still-valid design-system constraints under Neo Soft.
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
