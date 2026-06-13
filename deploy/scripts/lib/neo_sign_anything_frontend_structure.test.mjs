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
    "sign-details",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  // State now lives in the shared observable store via useStateBindings; the
  // string slots are read with an empty-string default (e.g. str("message", "")),
  // replacing the old local useState("") initialization.
  assert.match(playArea, /useStateBindings\(state\)/);
  assert.match(playArea, /str\("message",\s*""\)/);
  assert.match(playArea, /messageBytes/);
  assert.match(playArea, /signaturePreview/);
  assert.match(playArea, /txHashPreview/);
  assert.match(playArea, /dispatch\("signMessage",\s*message\)/);
  assert.match(playArea, /dispatch\("broadcastMessage",\s*message\)/);
  assert.match(playArea, /dispatch\("copyToClipboard",\s*signature\)/);
  assert.match(playArea, /dispatch\("copyToClipboard",\s*txHash\)/);
  assert.match(playArea, /disabled=\{!canSubmit \|\| isSigning\}/);
  assert.match(playArea, /disabled=\{!canBroadcast \|\| isBroadcasting\}/);
  // Neo Soft redesign adopts an uppercase eyebrow above the hero heading.
  assert.match(playArea, /className="sign-hero-eyebrow"/);
  assert.match(playArea, /\{t\("signHeroKicker"\)\}/);

  assert.match(main, /ctx\.registerAction\("signMessage"/);
  assert.match(main, /ctx\.registerAction\("broadcastMessage"/);
  assert.match(main, /ctx\.registerAction\("copyToClipboard"/);

  for (const key of [
    "signHeroKicker",
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

  assert.match(styles, /\.sign-play-area\s*\{[^}]*#f4f5f7/s);
  assert.match(
    styles,
    /\.sign-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(320px,\s*0\.44fr\)/s,
  );
  assert.match(
    styles,
    /\.sign-hero\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+minmax\(220px,\s*auto\)/s,
  );
  assert.match(styles, /\.sign-hero\s*\{[^}]*background:\s*var\(--sign-panel\)/s);
  assert.match(styles, /\.sign-hero\s*\{[^}]*box-shadow:\s*var\(--sign-shadow\)/s);
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
    /\.sign-hero \.sign-hero-stats span\s*\{[^}]*color:\s*var\(--sign-label\)/s,
  );
  // Neo Soft stat labels are uppercase tracked eyebrows.
  assert.match(
    styles,
    /\.sign-hero \.sign-hero-stats span\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(
    styles,
    /\.sign-hero \.sign-hero-stats strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s,
  );
  assert.match(
    styles,
    /\.sign-hero-accent\s*\{[^}]*background:\s*var\(--sign-badge-bg\)/s,
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
    /@media \(max-width: 640px\)[\s\S]*\.sign-hero-stats[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.sign-flow-strip[\s\S]*grid-template-columns:\s*1fr/s);

  // Neo Soft design language: uppercase eyebrow labels with 0.12em tracking
  // are intentional (the hero eyebrow), so we assert their presence rather
  // than the obsolete "every letter-spacing must be 0 / no uppercase" guard.
  assert.match(
    styles,
    /\.sign-hero-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(
    styles,
    /\.sign-hero-eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s,
  );
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(
    styles,
    /\.sign-hero\s*\{[^}]*rgba\(15,\s*23,\s*42,\s*0\.9/s,
  );
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
