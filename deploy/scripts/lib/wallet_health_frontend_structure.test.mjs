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

test("Wallet Health renders a complete wallet-style safety workspace", () => {
  const playArea = read("apps/wallet-health/src/PlayArea.tsx");
  const styles = read("apps/wallet-health/src/PlayArea.scss");
  const main = read("apps/wallet-health/src/main.tsx");
  const hook = read("apps/wallet-health/src/composables/useHealthScore.ts");
  const analysis = read("apps/wallet-health/src/composables/useWalletAnalysis.ts");
  const messages = read("apps/wallet-health/src/locale/messages.ts");

  for (const className of [
    "wallet-health-shell",
    "wallet-health-hero",
    "wallet-health-score-ring",
    "wallet-health-balance-strip",
    "wallet-health-balance-grid",
    "wallet-health-primary-actions",
    "wallet-health-checklist-panel",
    "wallet-health-recommendations-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /checklistItems/);
  assert.match(playArea, /recommendations/);
  assert.match(playArea, /completedChecklistCount/);
  assert.match(playArea, /totalChecklistCount/);
  assert.match(playArea, /dispatch\("toggleChecklist"/);
  assert.match(playArea, /dispatch\("refreshBalances"/);
  assert.match(playArea, /dispatch\("connectWallet"/);
  assert.match(playArea, /NeoButton/);

  assert.match(main, /checklistItems:\s*health\.checklistItems/);
  assert.match(main, /completedChecklistCount:\s*health\.completedChecklistCount/);
  assert.match(main, /recommendations:\s*health\.recommendations/);
  assert.match(main, /toggleChecklist:\s*\{/);
  assert.match(main, /handler:\s*\(\.\.\.args: unknown\[\]\)/);

  assert.match(hook, /checklistRevision\s*=\s*createObservable/);
  assert.match(hook, /checklistRevision\.set/);
  assert.match(hook, /checklistItems = createDerived[\s\S]*checklistRevision/s);
  assert.match(analysis, /balanceRevision\s*=\s*createObservable/);
  assert.match(analysis, /balanceRevision\.set/);
  assert.match(analysis, /neoDisplay = createDerived[\s\S]*balanceRevision/s);
  assert.match(analysis, /gasDisplay = createDerived[\s\S]*balanceRevision/s);

  for (const key of [
    "walletHeroTitle",
    "walletHeroSubtitle",
    "connectHint",
    "riskInsights",
    "balanceStripTitle",
    "checklistProgress",
    "recommendationsTitle",
    "networkReadiness",
    "refreshBalances",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  // Two-column workspace: wide main column + sticky side rail.
  assert.match(styles, /\.wallet-health-shell\s*\{/);
  assert.match(
    styles,
    /\.wallet-health-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.78fr\)\s+minmax\(320px,\s*0\.42fr\)/s,
  );
  // Balance strip exposes a connection + NEO + GAS grid.
  assert.match(
    styles,
    /\.wallet-health-balance-grid\s*\{[^}]*grid-template-columns:\s*minmax\(150px,\s*1\.15fr\)\s+repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // Primary connect/refresh actions sit in a two-up grid.
  assert.match(
    styles,
    /\.wallet-health-primary-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // Neo Soft light hero heading uses the ink token (not the legacy dark wash).
  assert.match(
    styles,
    /\.wallet-health-hero-copy\s*\{[\s\S]*?h2\s*\{[\s\S]*?color:\s*var\(--ns-ink/s,
  );
  // Conic score ring is the signature hero element.
  assert.match(
    styles,
    /\.wallet-health-score-ring\s*\{[\s\S]*?conic-gradient/s,
  );
  // Responsive collapse: single column on tablet, stacked actions on phone.
  assert.match(
    styles,
    /@media \(max-width: 880px\)[\s\S]*\.wallet-health-shell\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.wallet-health-primary-actions\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );

  // Neo Soft design language: uppercase eyebrow labels with tracking are
  // intentional; the accent is a flat conic/solid green, never a radial wash;
  // type stays at fixed sizes (no clamp); radii stay within the soft token scale.
  assert.match(
    styles,
    /\.wallet-health-kicker\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(styles, /letter-spacing:\s*0\.12em/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
