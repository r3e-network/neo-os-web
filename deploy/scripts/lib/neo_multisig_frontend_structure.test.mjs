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

test("Neo Multisig renders a complete light wallet-style approval workspace", () => {
  const playArea = read("apps/neo-multisig/src/PlayArea.tsx");
  const styles = read("apps/neo-multisig/src/PlayArea.scss");
  const messages = read("apps/neo-multisig/src/locale/messages.ts");

  for (const className of [
    "multisig-shell",
    "multisig-main",
    "multisig-hero",
    "multisig-hero-accent",
    "multisig-stat-grid",
    "multisig-workspace",
    "multisig-request-panel",
    "multisig-activity-panel",
    "multisig-side",
    "multisig-signer-panel",
    "multisig-route-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`), className);
  }

  assert.match(playArea, /useState\(""\)/);
  assert.match(playArea, /dispatch\("navigateToCreate"\)/);
  assert.match(playArea, /dispatch\("loadTransaction",\s*idInput\.trim\(\)\)/);
  assert.match(playArea, /disabled=\{!idInput\.trim\(\)\}/);
  assert.match(playArea, /history\.map/);
  assert.match(playArea, /history\.length === 0/);
  assert.match(playArea, /statusLabel\(item\.status\)/);
  assert.match(playArea, /formatDate\(item\.createdAt\)/);

  for (const key of [
    "multisigHeroTitle",
    "multisigHeroSubtitle",
    "multisigPendingMetric",
    "multisigCompletedMetric",
    "multisigTotalMetric",
    "multisigRequestTitle",
    "multisigRouteTitle",
    "multisigSignerTitle",
    "multisigQuorumTitle",
    "multisigNetworkTitle",
    "multisigNetworkValue",
    "multisigBroadcastTitle",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.multisig-play-area\s*\{[^}]*#f5f7fa/s);
  assert.match(
    styles,
    /\.multisig-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(320px,\s*0\.42fr\)/s,
  );
  assert.match(
    styles,
    /\.multisig-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(340px,\s*0\.62fr\)/s,
  );
  assert.match(styles, /\.multisig-hero\s*\{[^}]*#ffffff/s);
  assert.match(styles, /\.multisig-hero\s*\{[^}]*#fff7ed/s);
  assert.match(
    styles,
    /\.multisig-stat-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.multisig-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(320px,\s*0\.48fr\)\s+minmax\(0,\s*0\.52fr\)/s,
  );
  assert.match(
    styles,
    /\.multisig-primary-actions\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /\.multisig-primary-actions \.neo-btn\s*\{[^}]*white-space:\s*nowrap/s,
  );
  assert.match(styles, /\.multisig-signal-row\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.multisig-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.multisig-stat-grid[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.multisig-workspace[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
