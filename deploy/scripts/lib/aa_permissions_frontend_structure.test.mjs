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

// Neo Soft adopts uppercase eyebrow labels with positive letter-spacing
// tracking (0.12em) as the intentional design language. The old design
// philosophy (zero letter-spacing, no uppercase) was deliberately replaced,
// so this guards the new language instead.
function assertNeoSoftEyebrowTracking(styles) {
  const eyebrows = [
    ".permissions-hero__eyebrow",
    ".permissions-section-heading span",
  ];
  for (const selector of eyebrows) {
    const block = styles.match(
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "s"),
    );
    assert.ok(block, `expected style block for ${selector}`);
    assert.match(
      block[1],
      /letter-spacing:\s*0\.12em/,
      `${selector} must use 0.12em eyebrow tracking`,
    );
    assert.match(
      block[1],
      /text-transform:\s*uppercase/,
      `${selector} must be an uppercase eyebrow`,
    );
  }
}

test("AA Permissions Lab exposes a guarded wallet-style permissions workspace", () => {
  const playArea = read("apps/aa-permissions-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-permissions-lab/src/PlayArea.scss");
  const messages = read("apps/aa-permissions-lab/src/locale/messages.ts");

  assert.match(playArea, /className="permissions-hero"/);
  // Neo Soft redesign: hero metrics grid replaced by an uppercase eyebrow
  // label that renders the permission-state copy. The visible eyebrow now
  // binds its own dedicated key (permissionsHeroEyebrow) so an edit to the
  // metrics aria-label (permissionsMetricsLabel) can't silently rewrite the
  // header — assert the eyebrow span still renders the permission-state copy.
  assert.match(playArea, /className="permissions-hero__eyebrow"/);
  assert.match(playArea, /\{t\("permissionsHeroEyebrow"\)\}/);
  // The permission-update "flow" heading is now the write-column heading
  // (renders permissionsFlowLabel); the two-column workspace is the grid.
  assert.match(playArea, /className="permissions-write-heading"/);
  assert.match(playArea, /\{t\("permissionsFlowLabel"\)\}/);
  assert.match(playArea, /className="permissions-grid"/);
  assert.match(playArea, /const canRefresh =/);
  assert.match(playArea, /const canUpdateVerifier =/);
  assert.match(playArea, /const canUpdateHook =/);
  assert.match(playArea, /disabled=\{!canRefresh/);
  assert.match(playArea, /disabled=\{!canUpdateVerifier/);
  assert.match(playArea, /disabled=\{!canUpdateHook/);
  assert.match(styles, /\.aa-permissions-play-area button:disabled/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /border-radius:\s*2[2-9]px/);
  assertNeoSoftEyebrowTracking(styles);
  // Neo Soft redesign: the inline hint box is now the warn caption variant.
  assert.match(
    styles,
    /\.permissions-caption--warn\s*\{[^}]*padding:\s*11px 13px/s,
  );
  assert.match(
    styles,
    /\.permissions-caption--warn\s*\{[^}]*border:\s*1px solid/s,
  );
  assert.match(
    styles,
    /\.permissions-caption--warn\s*\{[^}]*background:\s*var\(--ns-surface-subtle/s,
  );
  assert.match(messages, /permissionsHeroTitle/);
  assert.match(messages, /permissionsFlowVerifier/);
  assert.match(messages, /verifierUpdateBlocked/);
  assert.match(messages, /hookUpdateBlocked/);
});
