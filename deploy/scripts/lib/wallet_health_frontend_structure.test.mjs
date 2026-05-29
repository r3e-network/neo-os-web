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
    "wallet-health-score-card",
    "wallet-health-balance-strip",
    "wallet-health-action-grid",
    "wallet-health-checklist-panel",
    "wallet-health-recommendations-panel",
    "wallet-health-insight-grid",
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

  assert.match(styles, /\.wallet-health-shell\s*\{/);
  assert.match(
    styles,
    /\.wallet-health-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.78fr\)\s+minmax\(320px,\s*0\.42fr\)/s,
  );
  assert.match(
    styles,
    /\.wallet-health-action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.wallet-health-insight-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.wallet-health-hero\s+\.wallet-health-hero-copy\s+h2\s*\{[^}]*color:\s*#f8fffb/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 880px\)[\s\S]*\.wallet-health-shell\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.wallet-health-action-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
