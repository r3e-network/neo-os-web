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

  assert.match(playArea, /className="relay-play-area"/);
  assert.match(playArea, /className="relay-hero"/);
  // Neo Soft redesign renamed the hero metric strip relay-hero__metrics -> relay-hero__facts.
  assert.match(playArea, /className="relay-hero__facts"/);
  // The multi-step relay-flow/relay-workspace sections were consolidated into a single
  // relay-command card whose body is the relay-form flow. Guard both regions remain.
  assert.match(playArea, /className="relay-command"/);
  assert.match(playArea, /className="relay-form"/);
  assert.match(playArea, /const canCheckSponsor =/);
  assert.match(playArea, /const canRequestSponsor =/);
  assert.match(playArea, /const canSubmitRelay =/);
  assert.match(playArea, /disabled=\{!canCheckSponsor/);
  assert.match(playArea, /disabled=\{!canRequestSponsor/);
  assert.match(playArea, /disabled=\{!canSubmitRelay/);
  assert.match(styles, /\.relay-play-area button:disabled/);
  // Neo Soft design language: hero eyebrow is an uppercase, letter-spaced kicker.
  assert.match(styles, /\.relay-hero__eyebrow\s*\{[^}]*text-transform:\s*uppercase/);
  assert.match(styles, /\.relay-hero__eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/);
  // Design-system constraints preserved: no fluid font clamp, no radial-gradient washes.
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);
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
