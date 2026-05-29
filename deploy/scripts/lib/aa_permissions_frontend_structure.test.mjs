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

test("AA Permissions Lab exposes a guarded wallet-style permissions workspace", () => {
  const playArea = read("apps/aa-permissions-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-permissions-lab/src/PlayArea.scss");
  const messages = read("apps/aa-permissions-lab/src/locale/messages.ts");

  assert.match(playArea, /className="permissions-hero"/);
  assert.match(playArea, /className="permissions-hero__metrics"/);
  assert.match(playArea, /className="permissions-flow"/);
  assert.match(playArea, /className="permissions-workspace"/);
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
  assertOnlyZeroLetterSpacing(styles);
  assert.match(styles, /\.permissions-hint\s*\{[^}]*padding:\s*11px 13px/s);
  assert.match(styles, /\.permissions-hint\s*\{[^}]*border:\s*1px solid/s);
  assert.match(styles, /\.permissions-hint\s*\{[^}]*background:\s*#f8fafc/s);
  assert.match(messages, /permissionsHeroTitle/);
  assert.match(messages, /permissionsFlowVerifier/);
  assert.match(messages, /verifierUpdateBlocked/);
  assert.match(messages, /hookUpdateBlocked/);
});
