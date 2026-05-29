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

test("Neo Sign Anything renders a complete light wallet-style signature workspace", () => {
  const playArea = read("apps/neo-sign-anything/src/PlayArea.tsx");
  const styles = read("apps/neo-sign-anything/src/PlayArea.scss");
  const main = read("apps/neo-sign-anything/src/main.tsx");
  const messages = read("apps/neo-sign-anything/src/locale/messages.ts");

  for (const className of [
    "sign-shell",
    "sign-main",
    "sign-hero",
    "sign-hero-accent",
    "sign-hero-stats",
    "sign-workspace",
    "sign-message-panel",
    "sign-result-panel",
    "sign-flow-strip",
    "sign-safety-panel",
    "sign-broadcast-panel",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /useState\(""\)/);
  assert.match(playArea, /messageBytes/);
  assert.match(playArea, /signaturePreview/);
  assert.match(playArea, /txHashPreview/);
  assert.match(playArea, /dispatch\("signMessage",\s*message\)/);
  assert.match(playArea, /dispatch\("broadcastMessage",\s*message\)/);
  assert.match(playArea, /dispatch\("copyToClipboard",\s*signature\)/);
  assert.match(playArea, /dispatch\("copyToClipboard",\s*txHash\)/);
  assert.match(playArea, /disabled=\{!canSubmit \|\| isSigning\}/);
  assert.match(playArea, /disabled=\{!canBroadcast \|\| isBroadcasting\}/);
  assert.doesNotMatch(playArea, /signHeroKicker/);

  assert.match(main, /ctx\.registerAction\("signMessage"/);
  assert.match(main, /ctx\.registerAction\("broadcastMessage"/);
  assert.match(main, /ctx\.registerAction\("copyToClipboard"/);

  for (const key of [
    "signHeroTitle",
    "signHeroSubtitle",
    "signatureDeskTitle",
    "signFlowTitle",
    "signFlowStepOne",
    "signFlowStepTwo",
    "signFlowStepThree",
    "signCount",
    "broadcastCount",
    "walletAddress",
    "safetyPanelTitle",
    "signContractRoute",
    "broadcastContractRoute",
    "resultPanelTitle",
    "broadcastPanelTitle",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.sign-play-area\s*\{[^}]*#f5f7fa/s);
  assert.match(
    styles,
    /\.sign-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(320px,\s*0\.44fr\)/s,
  );
  assert.match(
    styles,
    /\.sign-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(340px,\s*0\.62fr\)/s,
  );
  assert.match(styles, /\.sign-hero\s*\{[^}]*#ffffff/s);
  assert.match(styles, /\.sign-hero\s*\{[^}]*#fff7ed/s);
  assert.match(
    styles,
    /\.sign-hero \.sign-hero-copy\s*>\s*h2\s*\{[^}]*color:\s*var\(--sign-ink\)/s,
  );
  assert.match(
    styles,
    /\.sign-hero \.sign-hero-copy\s*>\s*p\s*\{[^}]*color:\s*var\(--sign-muted\)/s,
  );
  assert.match(
    styles,
    /\.sign-hero \.sign-hero-stats span\s*\{[^}]*color:\s*#8a94a6/s,
  );
  assert.match(
    styles,
    /\.sign-hero \.sign-hero-stats strong\s*\{[^}]*white-space:\s*nowrap/s,
  );
  assert.match(
    styles,
    /\.sign-hero-accent\s*\{[^}]*background:\s*#fef3c7/s,
  );
  assert.match(
    styles,
    /\.sign-flow-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.sign-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(320px,\s*0\.46fr\)\s+minmax\(0,\s*0\.54fr\)/s,
  );
  assert.match(
    styles,
    /\.sign-action-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /\.sign-action-grid \.neo-btn\s*\{[^}]*white-space:\s*nowrap/s,
  );
  assert.match(styles, /\.sign-signal-row\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.sign-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.sign-hero-stats[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.sign-flow-strip[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(
    styles,
    /\.sign-hero\s*\{[^}]*rgba\(15,\s*23,\s*42,\s*0\.9/s,
  );
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
