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

test("AA Relay Console exposes a guarded wallet-style relay workspace", () => {
  const playArea = read("apps/aa-relay-console/src/PlayArea.tsx");
  const styles = read("apps/aa-relay-console/src/PlayArea.scss");
  const composable = read(
    "apps/aa-relay-console/src/composables/useAARelayConsole.ts",
  );
  const messages = read("apps/aa-relay-console/src/locale/messages.ts");

  assert.match(playArea, /className="relay-hero"/);
  assert.match(playArea, /className="relay-hero__metrics"/);
  assert.match(playArea, /className="relay-flow"/);
  assert.match(playArea, /className="relay-workspace"/);
  assert.match(playArea, /const canCheckSponsor =/);
  assert.match(playArea, /const canRequestSponsor =/);
  assert.match(playArea, /const canSubmitRelay =/);
  assert.match(playArea, /disabled=\{!canCheckSponsor/);
  assert.match(playArea, /disabled=\{!canRequestSponsor/);
  assert.match(playArea, /disabled=\{!canSubmitRelay/);
  assert.match(styles, /\.relay-play-area button:disabled/);
  assert.match(composable, /aa\.isCheckingSponsorship\.get\(\)/);
  assert.match(composable, /aa\.isRelaying\.get\(\)/);
  assert.doesNotMatch(
    composable,
    /get:\s*\(\)\s*=>\s*aa\.isCheckingSponsorship,/,
  );
  assert.doesNotMatch(composable, /get:\s*\(\)\s*=>\s*aa\.isRelaying,/);
  assert.match(messages, /relayHeroTitle/);
  assert.match(messages, /relayFlowSubmit/);
  assert.match(messages, /sponsorBlocked/);
  assert.match(messages, /relayBlocked/);
});
