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

test("AA Account Lab exposes a guarded wallet-style account registration workspace", () => {
  const playArea = read("apps/aa-account-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-account-lab/src/PlayArea.scss");
  const messages = read("apps/aa-account-lab/src/locale/messages.ts");

  assert.match(playArea, /className="account-hero"/);
  // Neo Soft redesign renamed the hero summary region account-hero__metrics ->
  // account-hero__meta (compact stat tiles: network + default verifier).
  assert.match(playArea, /className="account-hero__meta"/);
  assert.match(playArea, /className="account-hero__stat"/);
  assert.match(playArea, /className="account-workspace"/);
  // The standalone 3-step "account-flow" strip was removed in the redesign; the
  // workspace now pairs a read-only inspector card with a register card. Guard
  // both distinct regions so the inspect/register split stays intact.
  assert.match(playArea, /className="account-command"/);
  assert.match(playArea, /className="account-register-card"/);
  assert.match(playArea, /const canInspect =/);
  assert.match(playArea, /const canRegister =/);
  assert.match(playArea, /disabled=\{!canInspect/);
  assert.match(playArea, /disabled=\{!canRegister/);
  assert.match(styles, /\.aa-account-play-area button:disabled/);

  // Neo Soft light design language: the hero eyebrow is an uppercase tracked
  // kicker and the heading inks with the --ns-ink token (was a dark #f8fffb).
  assert.match(styles, /\.account-hero__eyebrow\s*\{[^}]*text-transform:\s*uppercase/);
  assert.match(styles, /\.account-hero__eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/);
  assert.match(styles, /\.account-hero__heading h2\s*\{[^}]*color:\s*var\(--ns-ink/);
  // Design-system constraints that must hold under the redesign.
  assert.doesNotMatch(styles, /radial-gradient/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);

  assert.match(messages, /accountHeroTitle/);
  assert.match(messages, /accountFlowRegister/);
  assert.match(messages, /inspectBlocked/);
  assert.match(messages, /registerBlocked/);
});
