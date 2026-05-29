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

test("AA Session Key Lab exposes a wallet-style session workspace with guarded configure flow", () => {
  const playArea = read("apps/aa-session-key-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-session-key-lab/src/PlayArea.scss");
  const composable = read(
    "apps/aa-session-key-lab/src/composables/useAASessionKeyLab.ts",
  );
  const messages = read("apps/aa-session-key-lab/src/locale/messages.ts");

  assert.match(playArea, /className="session-hero"/);
  assert.match(playArea, /className="session-hero__metrics"/);
  assert.match(playArea, /className="session-workspace"/);
  assert.match(playArea, /className="session-flow"/);
  assert.match(playArea, /const canConfigure =/);
  assert.match(playArea, /disabled=\{!canConfigure/);
  assert.match(playArea, /className="session-action-grid"/);
  assert.match(styles, /\.session-play-area button:disabled/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.match(styles, /\.session-hint\s*\{[^}]*padding:\s*11px 13px/s);
  assert.match(styles, /\.session-hint\s*\{[^}]*border:\s*1px solid/s);
  assert.match(styles, /\.session-hint\s*\{[^}]*background:\s*#f8fafc/s);
  assert.match(composable, /aa\.isCheckingSponsorship\.get\(\)/);
  assert.doesNotMatch(
    composable,
    /get:\s*\(\)\s*=>\s*aa\.isCheckingSponsorship,/,
  );
  assert.match(messages, /sessionHeroTitle/);
  assert.match(messages, /sessionMetricScope/);
  assert.match(messages, /configureSessionBlocked/);
  assert.match(messages, /sessionFlowSponsor/);
});
