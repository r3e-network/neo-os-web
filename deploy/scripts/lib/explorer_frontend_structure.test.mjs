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
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  assert.deepEqual(values, values.map(() => "0"));
}

test("Explorer renders a complete wallet-style chain lookup console in empty live-data states", () => {
  const playArea = read("apps/explorer/src/PlayArea.tsx");
  const styles = read("apps/explorer/src/PlayArea.scss");
  const recentTransactions = read("apps/explorer/src/components/RecentTransactions.tsx");
  const recentStyles = read("apps/explorer/src/components/RecentTransactions.scss");
  const searchPanelStyles = read("apps/explorer/src/components/SearchPanel.scss");
  const messages = read("apps/explorer/src/locale/messages.ts");

  assert.match(playArea, /className="explorer-hero"/);
  assert.match(playArea, /className="explorer-signal-card"/);
  assert.match(playArea, /className="explorer-search-primer"/);
  assert.match(playArea, /className="explorer-workflow"/);
  assert.match(playArea, /className="explorer-readonly-note"/);
  assert.match(playArea, /selectedNetwork === "mainnet"/);

  assert.match(recentTransactions, /recent-empty-state/);
  assert.match(recentTransactions, /transactions\.length === 0/);
  assert.match(recentTransactions, /explorerRecentEmptyTitle/);

  for (const key of [
    "explorerReadOnly",
    "explorerSearchScope",
    "explorerRecentEmptyTitle",
    "explorerRecentEmptyDesc",
    "explorerWorkflowTitle",
    "explorerSafetyDesc",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  assert.match(styles, /\.explorer-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.explorer-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(280px,\s*0\.7fr\)/s);
  assert.match(styles, /\.explorer-signal-card\s*\{[^}]*linear-gradient\(135deg,\s*#ffffff 0%,\s*#eefcf7 54%,\s*#f7f3ff 100%\)/s);
  assert.match(styles, /\.explorer-workflow\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.explorer-readonly-note \.neo-card__content\s*\{/);
  assert.match(recentStyles, /\.recent-empty-state\s*\{/);
  assert.match(recentStyles, /\.recent-empty-state \.neo-card__content\s*\{/);
  assert.match(recentStyles, /\.recent-empty-state \.neo-card__content > div\s*\{/);
  assert.match(searchPanelStyles, /\.search-card\s*\{[^}]*display:\s*grid/s);
  assert.match(searchPanelStyles, /\.search-card \.neo-card__content\s*\{/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.explorer-hero[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.explorer-workflow[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(`${styles}\n${recentStyles}\n${searchPanelStyles}`);
  assert.doesNotMatch(`${styles}\n${recentStyles}\n${searchPanelStyles}`, /text-transform:\s*uppercase/);
  assert.doesNotMatch(`${styles}\n${recentStyles}\n${searchPanelStyles}`, /font-size:\s*clamp\(/);
  assert.doesNotMatch(`${styles}\n${recentStyles}\n${searchPanelStyles}`, /radial-gradient/i);
});
