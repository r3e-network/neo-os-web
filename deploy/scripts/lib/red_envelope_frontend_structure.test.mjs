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

test("Red Envelope renders a complete wallet-style claim and creator workspace", () => {
  const playArea = read("apps/red-envelope/src/PlayArea.tsx");
  const styles = read("apps/red-envelope/src/PlayArea.scss");
  const main = read("apps/red-envelope/src/main.tsx");
  const messages = read("apps/red-envelope/src/locale/messages.ts");

  for (const className of [
    "redenv-shell",
    "redenv-hero",
    "redenv-hero-stats",
    "redenv-claim-panel",
    "redenv-create-panel",
    "redenv-flow-strip",
    "redenv-activity-panel",
    "redenv-safety-panel",
    "redenv-envelope-list",
  ]) {
    assert.match(playArea, new RegExp(`className="[^"]*${className}`));
  }

  assert.match(playArea, /useState\(\{\s*amount:\s*"1"/s);
  assert.match(playArea, /setSelectedEnvelopeId\(String\(env\.id\)\)/);
  assert.match(playArea, /dispatch\("claimEnvelope",\s*\{\s*envelopeId:/s);
  assert.match(playArea, /dispatch\("createEnvelope",\s*createForm\)/);
  assert.match(playArea, /disabled=\{isLoading \|\| !selectedEnvelopeId\.trim\(\)\}/);
  assert.match(playArea, /disabled=\{isLoading \|\| !canCreateEnvelope\}/);
  assert.match(playArea, /value=\{selectedEnvelopeId\}/);
  assert.match(playArea, /value=\{createForm\.amount\}/);
  assert.match(playArea, /claimableGas/);
  assert.match(playArea, /completionRate/);

  assert.match(main, /ctx\.registerAction\("claimEnvelope"/);
  assert.match(main, /ctx\.registerAction\("createEnvelope"/);
  assert.match(main, /openingId:\s*envelope\.openingId/);

  for (const key of [
    "redEnvelopeHeroTitle",
    "redEnvelopeHeroSubtitle",
    "claimPanelTitle",
    "createPanelTitle",
    "claimRouteOne",
    "claimRouteTwo",
    "claimRouteThree",
    "safetyPanelTitle",
    "shareReadyTitle",
    "recentClaimsTitle",
  ]) {
    assert.match(messages, new RegExp(`${key}:`), key);
  }

  assert.match(styles, /\.redenv-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(
    styles,
    /\.redenv-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(320px,\s*0\.44fr\)/s,
  );
  assert.match(
    styles,
    /\.redenv-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(330px,\s*0\.54fr\)/s,
  );
  assert.match(
    styles,
    /\.redenv-hero \.redenv-hero-copy\s*\{[\s\S]*>\s*h2\s*\{[^}]*color:\s*#ffffff/s,
  );
  assert.match(
    styles,
    /\.redenv-hero-stats\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    styles,
    /\.redenv-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.62fr\)\s+minmax\(280px,\s*0\.38fr\)/s,
  );
  assert.match(
    styles,
    /\.redenv-flow-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.redenv-shell[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.redenv-flow-strip[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.redenv-row\s*\{[^}]*min-height:\s*44px/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
