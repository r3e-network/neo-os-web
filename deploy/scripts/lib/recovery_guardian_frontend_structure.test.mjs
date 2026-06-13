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

test("Recovery Guardian exposes a guarded wallet-style recovery workspace", () => {
  const playArea = read("apps/recovery-guardian/src/PlayArea.tsx");
  const styles = read("apps/recovery-guardian/src/PlayArea.scss");
  const main = read("apps/recovery-guardian/src/main.tsx");
  const messages = read("apps/recovery-guardian/src/locale/messages.ts");

  assert.match(playArea, /className="guardian-hero"/);
  assert.match(playArea, /className="guardian-hero__metrics"/);
  assert.match(playArea, /className="guardian-flow"/);
  assert.match(playArea, /className="guardian-workspace"/);
  assert.match(playArea, /const canQueryState =/);
  assert.match(playArea, /const canPrepareRecovery =/);
  assert.match(playArea, /disabled=\{!canQueryState/);
  assert.match(playArea, /disabled=\{!canPrepareRecovery/);
  assert.match(styles, /\.guardian-play-area button:disabled/);
  // Neo Soft flat-design guard: no decorative gradient ornamentation.
  assert.doesNotMatch(styles, /radial-gradient/);
  // Pseudo-elements must stay minimal/functional. The only sanctioned one is the
  // verifier-diagnostic status dot; any other ::before/::after is decorative drift.
  const pseudoElements = styles.match(/[^\s{};]+::(?:before|after)\b/g) ?? [];
  for (const selector of pseudoElements) {
    assert.match(
      selector,
      /\.guardian-verifier-diagnostic::before/,
      `Unexpected decorative pseudo-element: ${selector}`,
    );
  }
  assert.match(main, /recoveryNewOwner\.get\(\)/);
  assert.match(main, /recoveryExpiryMinutes\.get\(\)/);
  assert.match(messages, /guardianHeroTitle/);
  assert.match(messages, /guardianFlowPrepare/);
  assert.match(messages, /queryBlocked/);
  assert.match(messages, /recoveryLinkBlocked/);
});
