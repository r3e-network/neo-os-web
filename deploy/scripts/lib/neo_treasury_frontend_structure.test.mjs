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

test("Neo Treasury renders a complete wallet-style dashboard even before live balances load", () => {
  const playArea = read("apps/neo-treasury/src/PlayArea.tsx");
  const styles = read("apps/neo-treasury/src/PlayArea.scss");
  const messages = read("apps/neo-treasury/src/locale/messages.ts");

  assert.match(playArea, /DA_HONGFEI_ADDRESSES/);
  assert.match(playArea, /ERIK_ZHANG_ADDRESSES/);
  assert.match(playArea, /className="treasury-hero"/);
  assert.match(playArea, /className="treasury-signal-card"/);
  assert.match(playArea, /className="treasury-watchlist"/);
  assert.match(playArea, /className="treasury-group-header"/);
  assert.match(playArea, /className="treasury-route"/);
  assert.match(playArea, /className="treasury-readonly-note"/);
  assert.match(playArea, /const watchedAddressCount =/);
  assert.match(playArea, /const hasLiveData = Boolean\(data\)/);
  assert.match(playArea, /const isRefreshing = loading && hasLiveData/);

  assert.match(messages, /treasuryLivePending/);
  assert.match(messages, /treasuryReadOnlyRoute/);
  assert.match(messages, /treasuryWatchlist/);

  assert.match(styles, /\.treasury-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.treasury-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(260px,\s*0\.72fr\)/s);
  assert.match(styles, /\.treasury-hero\s*\{[^}]*border-radius:\s*16px/s);
  assert.match(styles, /\.treasury-signal-card\s*\{[^}]*linear-gradient\(135deg,\s*#ffffff 0%,\s*#eefcf7 52%,\s*#fff7ed 100%\)/s);
  assert.match(styles, /\.treasury-watchlist\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.treasury-route\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.treasury-hero[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.treasury-watchlist[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.treasury-route[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-family:\s*[^;]*(?:Cinzel|serif)/i);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
